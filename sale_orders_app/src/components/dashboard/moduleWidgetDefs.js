import { generateFinanceOverviewKpis, generateTaxRegisters, formatMoney } from '../../utils/financeEngine';

export const WIDGET_MODULES = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'salesOrders', label: 'Sales Orders', icon: 'shopping_cart' },
  { key: 'oms', label: 'OMS', icon: 'account_tree' },
  { key: 'productionPlanning', label: 'Production', icon: 'precision_manufacturing' },
  { key: 'inventory', label: 'Inventory', icon: 'inventory_2' },
  { key: 'delivery', label: 'Delivery', icon: 'local_shipping' },
  { key: 'finance', label: 'Finance', icon: 'account_balance_wallet' },
  { key: 'hr', label: 'HR', icon: 'badge' },
  { key: 'chat', label: 'Chats', icon: 'chat' },
  { key: 'userManagement', label: 'User Control', icon: 'manage_accounts' },
  { key: 'settings', label: 'Settings', icon: 'settings' }
];

const getFinanceCurrency = (state) => {
  return state?.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';
};

const getOmsPendingStats = (state) => {
  const soPending = (state?.saleOrders || []).flatMap(order =>
    (order.items || [])
      .map(item => {
        const statusLower = (item.status || '').toLowerCase();
        if (statusLower !== 'pending' && statusLower !== 'in process' && statusLower !== 'in production') return null;
        const remainingToPlan = (item.quantity || 0) - (item.producedQty || 0);
        if (remainingToPlan <= 0) return null;
        return { remainingToPlan };
      })
      .filter(Boolean)
  );

  const customPending = (state?.customOmsItems || [])
    .map(item => {
      const statusLower = (item.status || '').toLowerCase();
      if (statusLower !== 'pending' && statusLower !== 'in process' && statusLower !== 'in production') return null;
      const remainingToPlan = (item.quantity || 0) - (item.producedQty || 0);
      if (remainingToPlan <= 0) return null;
      return { remainingToPlan };
    })
    .filter(Boolean);

  const all = [...soPending, ...customPending];
  const count = all.length;
  const totalRemaining = all.reduce((sum, item) => sum + (Number(item.remainingToPlan) || 0), 0);
  return { count, totalRemaining };
};

const getHrAttendanceStats = (state) => {
  const employees = state?.hr_employees_list || [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = days[today.getDay()];

  const active = employees.filter(emp => !emp.joiningDate || emp.joiningDate <= todayStr);

  const getEmployeeStatusOnDate = (emp, dateStr) => {
    const rec = emp.attendance?.[dateStr];
    if (rec && ['present', 'absent', 'leave', 'holiday', 'off day'].includes(rec.status)) {
      return rec.status;
    }
    const dayRec = emp.attendance?.[weekday];
    if (dayRec && dayRec.explicitStatus) {
      return dayRec.status;
    }
    return 'absent';
  };

  let present = 0;
  let leave = 0;
  let absent = 0;

  active.forEach(emp => {
    const status = getEmployeeStatusOnDate(emp, todayStr);
    if (status === 'present' || status === 'late') {
      present++;
    } else if (status === 'leave' || status === 'on leave' || status === 'halfday') {
      leave++;
    } else if (status === 'absent') {
      absent++;
    }
  });

  return {
    activeCount: active.length,
    present,
    leave,
    absent
  };
};

export const MODULE_STAT_WIDGETS = {
  // FINANCE
  fin_net_revenue: {
    id: 'fin_net_revenue',
    module: 'finance',
    name: 'Net Sales Revenue',
    hint: 'Total net sales revenue from posted sales — same figure as the Finance Overview card.',
    icon: 'trending_up',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const code = getFinanceCurrency(state);
      const k = generateFinanceOverviewKpis(state);
      return {
        value: formatMoney(k.netRevenue, code),
        sub: `Gross Margin: ${k.grossMargin}%`
      };
    }
  },
  fin_cash_bank: {
    id: 'fin_cash_bank',
    module: 'finance',
    name: 'Cash & Bank Liquidity',
    hint: 'Combined cash-in-hand and bank balance right now.',
    icon: 'account_balance',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const code = getFinanceCurrency(state);
      const k = generateFinanceOverviewKpis(state);
      return {
        value: formatMoney(k.cashAndBank, code),
        sub: `Quick Ratio: ${k.quickRatio}x`
      };
    }
  },
  fin_receivables: {
    id: 'fin_receivables',
    module: 'finance',
    name: 'Total Receivable (AR)',
    hint: 'Total amount customers still owe you (Accounts Receivable).',
    icon: 'pending_actions',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const code = getFinanceCurrency(state);
      const k = generateFinanceOverviewKpis(state);
      return {
        value: formatMoney(k.totalReceivables, code),
        sub: `DSO: ${k.dso} Days`
      };
    }
  },
  fin_payables: {
    id: 'fin_payables',
    module: 'finance',
    name: 'Total Payable (AP)',
    hint: 'Total amount you owe suppliers and vendors (Accounts Payable).',
    icon: 'receipt_long',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const code = getFinanceCurrency(state);
      const k = generateFinanceOverviewKpis(state);
      return {
        value: formatMoney(k.totalPayables, code),
        sub: `Current Ratio: ${k.currentRatio}x`
      };
    }
  },
  fin_net_profit: {
    id: 'fin_net_profit',
    module: 'finance',
    name: 'Net Operating Profit',
    hint: 'Profit after all operating costs — same figure as the Finance Overview profit card.',
    icon: 'savings',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const code = getFinanceCurrency(state);
      const k = generateFinanceOverviewKpis(state);
      return {
        value: formatMoney(k.netProfit, code),
        sub: `${k.netMargin}% Net Margin · Gross Profit: ${formatMoney(k.grossProfit, code)}`
      };
    }
  },
  fin_tax_net: {
    id: 'fin_tax_net',
    module: 'finance',
    name: 'Net Sales Tax Payable',
    hint: 'Output tax on sales minus input tax on purchases — net payable to (or receivable from) FBR.',
    icon: 'account_balance_wallet',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const code = getFinanceCurrency(state);
      const t = generateTaxRegisters(state);
      return {
        value: formatMoney(t.netSalesTaxPayable, code),
        sub: `Output: ${formatMoney(t.totalOutputTax, code)} · Input: ${formatMoney(t.totalInputTax, code)}`
      };
    }
  },
  fin_wht: {
    id: 'fin_wht',
    module: 'finance',
    name: 'WHT Deducted',
    hint: 'Total withholding tax deducted on vouchers (WHT register total).',
    icon: 'percent',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const code = getFinanceCurrency(state);
      const t = generateTaxRegisters(state);
      return {
        value: formatMoney(t.totalWht, code),
        sub: 'Withholding Tax Register'
      };
    }
  },

  // SALES ORDERS
  so_total_orders: {
    id: 'so_total_orders',
    module: 'salesOrders',
    name: 'Total Sale Orders',
    hint: 'All sale orders on record (excluding deleted).',
    icon: 'shopping_cart',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const active = (state?.saleOrders || []).filter(o => o && o.status !== 'Deleted');
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const curr = active.filter(o => new Date(o.date) >= currentMonthStart).length;
      const last = active.filter(o => {
        const d = new Date(o.date);
        return d >= lastMonthStart && d < currentMonthStart;
      }).length;
      const mom = last === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - last) / last) * 100);
      return {
        value: String(active.length),
        sub: `${mom >= 0 ? '+' : ''}${mom}% from last month`
      };
    }
  },
  so_processing: {
    id: 'so_processing',
    module: 'salesOrders',
    name: 'Processing Orders',
    hint: 'Orders currently in production or with output started.',
    icon: 'bolt',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const active = (state?.saleOrders || []).filter(o => o && o.status !== 'Deleted');
      const plans = state?.productionPlans || [];
      const count = active.filter(o => {
        if (o.status === 'Completed' || o.status === 'Cancelled') return false;
        const inProduction = plans.some(plan => plan.orderId === o.id);
        const hasOutput = (o.items || []).some(i => (Number(i.producedQty) || 0) > 0);
        return inProduction || hasOutput;
      }).length;
      return {
        value: String(count),
        sub: 'Active in Production'
      };
    }
  },
  so_revenue: {
    id: 'so_revenue',
    module: 'salesOrders',
    name: 'Revenue (Total)',
    hint: 'Total value of all non-cancelled orders (quantity × rate).',
    icon: 'payments',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const active = (state?.saleOrders || []).filter(o => o && o.status !== 'Deleted');
      let rev = 0;
      active.forEach(o => {
        if (o.status !== 'Cancelled') {
          (o.items || []).forEach(i => {
            if (i.status !== 'Cancelled' && i.status !== 'Deleted') {
              rev += ((Number(i.quantity) || 0) * (Number(i.price) || 0));
            }
          });
        }
      });
      return {
        value: rev.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        sub: 'Live settlement estimation'
      };
    }
  },

  // OMS
  oms_pending_items: {
    id: 'oms_pending_items',
    module: 'oms',
    name: 'Pending Items',
    hint: 'Order items still waiting to be planned for production.',
    icon: 'account_tree',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const { count, totalRemaining } = getOmsPendingStats(state);
      return {
        value: String(count),
        sub: `${totalRemaining.toLocaleString()} m remaining to plan`
      };
    }
  },
  oms_pending_qty: {
    id: 'oms_pending_qty',
    module: 'oms',
    name: 'Pending Quantity',
    hint: 'Total meters still to be produced against pending items.',
    icon: 'straighten',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const { count, totalRemaining } = getOmsPendingStats(state);
      return {
        value: totalRemaining.toLocaleString(),
        sub: `${count} items pending`
      };
    }
  },

  // INVENTORY
  inv_stock_value: {
    id: 'inv_stock_value',
    module: 'inventory',
    name: 'Total Stock Value',
    hint: 'Total value of all stock on hand (stock × item price) — same figure as the Inventory Dashboard.',
    icon: 'payments',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const items = state?.items || [];
      const sym = state?.adminSetup?.baseCurrency?.match(/\(([^)]+)\)/)?.[1] || 'Rs';
      const total = items.reduce((acc, item) => {
        const priceStr = String(item.price || '0').replace(/[^0-9.]/g, '');
        const price = parseFloat(priceStr) || 0;
        return acc + ((Number(item.stock) || 0) * price);
      }, 0);
      return {
        value: `${sym} ${(total / 1000).toFixed(1)}k`,
        sub: `${items.length} Items`
      };
    }
  },
  inv_items_count: {
    id: 'inv_items_count',
    module: 'inventory',
    name: 'Total Items',
    hint: 'Total number of item records (FG, raw material, machines).',
    icon: 'inventory_2',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const items = state?.items || [];
      const outOfStock = items.filter(i => (Number(i.stock) || 0) <= 0).length;
      return {
        value: String(items.length),
        sub: `${outOfStock} out of stock`
      };
    }
  },

  // HR
  hr_workforce: {
    id: 'hr_workforce',
    module: 'hr',
    name: 'Total Workforce',
    hint: 'Total active employees (joined on or before today).',
    icon: 'groups',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const { activeCount } = getHrAttendanceStats(state);
      return {
        value: String(activeCount),
        sub: 'Active Employees'
      };
    }
  },
  hr_present: {
    id: 'hr_present',
    module: 'hr',
    name: 'Present Today',
    hint: "Employees marked present today, with today's attendance rate.",
    icon: 'check_circle',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const { activeCount, present } = getHrAttendanceStats(state);
      const rate = activeCount ? Math.round((present / activeCount) * 100) : 0;
      return {
        value: String(present),
        sub: `${rate}% Attendance Rate`
      };
    }
  },
  hr_leave: {
    id: 'hr_leave',
    module: 'hr',
    name: 'On Leave Today',
    hint: 'Employees on leave today.',
    icon: 'flight_takeoff',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const { absent, leave } = getHrAttendanceStats(state);
      return {
        value: String(leave),
        sub: `${absent} Absent Today`
      };
    }
  },
  hr_absent: {
    id: 'hr_absent',
    module: 'hr',
    name: 'Absent Today',
    hint: 'Employees absent today (no present/leave record).',
    icon: 'cancel',
    defaultWidth: 3,
    defaultHeight: 3,
    compute: (state) => {
      const { activeCount, absent } = getHrAttendanceStats(state);
      return {
        value: String(absent),
        sub: `of ${activeCount} Workforce`
      };
    }
  }
};
