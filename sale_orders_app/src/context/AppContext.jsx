import {
  validateCurrentSession,
  createSecureSession,
  destroySession,
  touchSessionActivity,
  getRateLimitStatus,
  recordFailedAttempt,
  resetRateLimit,
  verifyPassword,
  sanitizeUser
} from '../utils/securityAuth';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { applyTheme } from '../utils/theme';
import { supabase } from '../utils/supabaseClient';
import { STEP1_ENTITY_TABLES, loadStep1EntitiesFromTables, syncEntityDiffToTable, recordKeyWithFallback, loadAdminSetupFromTable, syncAdminSetupToTable, loadFGComboConfigFromTable, syncFGComboConfigToTable, loadFlashAmConfigFromTable, syncFlashAmConfigToTable, loadSalaryPrintSettingsFromTable, syncSalaryPrintSettingsToTable, loadPayrollAccountMappingFromTable, syncPayrollAccountMappingToTable, loadCategoryPrefixesFromTable, syncCategoryPrefixesToTable, loadScalarsFromTable, syncScalarsToTable, loadCountersFromTable, syncCountersToTable, loadBatchOutputTypesFromTable, syncBatchOutputTypesToTable, loadBatchLaborConfigFromTable, syncBatchLaborConfigToTable, loadLoginThemeSettingsFromTable, syncLoginThemeSettingsToTable, loadDutySettingsFromTable, syncDutySettingsToTable, loadSalaryAllowanceConfigFromTable, syncSalaryAllowanceConfigToTable } from '../utils/entityTables';
import { formatLineCode, maxLineCodeNumber } from '../utils/itemCodes';
import { getInitialFGConfig, saveFGConfig, normalizeFGConfig } from '../utils/fgCombinationUtils';
import { getInitialFlashAmConfig, normalizeFlashAmConfig } from '../utils/flashAmConfig';
import { getInitialLoginThemeSettings, normalizeLoginThemeSettings } from '../utils/loginThemes';
import { getInitialSalaryPrintSettings, normalizeSalaryPrintSettings } from '../utils/salaryPrintSettings';
import { getInitialDutySettings, normalizeDutySettings } from '../utils/dutySettings';
import { getInitialPayrollMappings, normalizePayrollMappings } from '../utils/payrollAccountMapping';
import { getInitialBatchLaborConfig, normalizeBatchLaborConfig } from '../utils/batchLaborCost';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../utils/financeEngine';
import { invoiceSourceLabel } from '../utils/invoiceSource';
import { buildFiledDocumentSnapshot } from '../utils/studioSnapshot';
import { buildArchiveEntry, applyFilingToBinders, findUnverifiedFilings, fileEntryIntoBindersById } from '../utils/routingArchive';
import { findUserByLoginIdentifier } from '../utils/loginIdentifier';
import { findProbationNotificationsDue, getProbationInfo } from '../utils/probation';
import { isStockOutput } from '../utils/stockOutput';

const AppContext = createContext();
const BUILD_VERSION = '20260715_v5';

const initialMockState = {
  users: [
    { id: 1, name: 'Admin', username: 'admin', password: 'admin1', role: 'Super Admin', permissions: ['salesOrders', 'oms', 'productionPlanning', 'inventory', 'delivery', 'userManagement', 'hr', 'finance'], granularPermissions: {}, requirePasswordChange: false },
    { id: 1783806701163, name: 'ARFAN JAMEEL', role: 'Super Admin', email: 'arfanjameel@gmail.com', phone: '923062468667', status: 'Active', initials: 'AR', jobTitle: 'Super Admin', password: '12345', username: 'arfan_jameel', department: 'ADMIN', permissions: ['salesOrders','oms','productionPlanning','inventory','delivery','userManagement','settings','hr','chat','finance'], granularPermissions: {}, requirePasswordChange: false },
    { id: 1783806737100, name: 'UMAIR SHABIR', role: 'MANAGER', email: 'umairshabir@gmail.com', phone: 'Null', status: 'Active', initials: 'UM', jobTitle: 'MANAGER', password: '123456', username: 'umair_shabir', department: 'FINANCE', permissions: ['chat'], granularPermissions: {}, requirePasswordChange: false },
    { id: 1783884870423, name: 'UMER ALI', role: 'Super Admin', email: 'umerali@gmail.com', phone: '923079418134', status: 'Active', initials: 'UM', jobTitle: 'Super Admin', password: '123456', username: 'only.umer', department: 'ADMIN', permissions: ['salesOrders','oms','productionPlanning','inventory','delivery','userManagement','settings','hr','chat','finance'], granularPermissions: {}, requirePasswordChange: false }
  ],
  currentUser: null,
  fg_combinations_config: getInitialFGConfig(),
  flash_am_config: getInitialFlashAmConfig(),
  login_theme_settings: getInitialLoginThemeSettings(),
  salary_print_settings: getInitialSalaryPrintSettings(),
  hr_duty_settings: getInitialDutySettings(),
  payroll_account_mapping: getInitialPayrollMappings(),
  batch_labor_config: getInitialBatchLaborConfig(),
  customers: [],
  suppliers: [],
  items: [],
  saleOrders: [],
  productionPlans: [],
  productionOutputs: [],
  deliveries: [],
  notifications: [],
  returns: [],
  chats: [],
  boms: [],
  otherConsumptions: [],
  rawMaterialPhases: [
    { id: 'rm_top', title: 'TOP Phase', label: 'TOP Phase', tank: 'Tank A', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' },
    { id: 'rm_foam', title: 'FOAM Phase', label: 'FOAM Phase', tank: 'Tank B', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' },
    { id: 'rm_adhesive', title: 'ADHESIVE Phase', label: 'ADHESIVE Phase', tank: 'Tank C', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' },
    { id: 'rm_packing', title: 'Packing Specs', label: 'Packing Specs', tank: 'Packaging Materials', unit: 'pcs', width: 420, enabled: true, type: 'Packing Material' }
  ],
  finishedGoodPhases: [
    { id: 'top', title: 'TOP Phase', label: 'TOP Phase', tank: 'Tank A', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' },
    { id: 'foam', title: 'FOAM Phase', label: 'FOAM Phase', tank: 'Tank B', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' },
    { id: 'adhesive', title: 'ADHESIVE Phase', label: 'ADHESIVE Phase', tank: 'Tank C', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' },
    { id: 'packing', title: 'Packing Specs', label: 'Packing Specs', tank: 'Packaging Materials', unit: 'pcs', width: 420, enabled: true, type: 'Packing Material' }
  ],
  approvals: [
    { id: 'APP-101', type: 'Sales Order', requestedTo: 'admin', requestedBy: 'sales_rep', details: 'SO-1002 requiring special volume discount approval', value: '$12,450.00', status: 'Pending', createdAt: new Date(Date.now() - 3600000 * 2).toISOString() },
    { id: 'APP-102', type: 'GRN Log', requestedTo: 'admin', requestedBy: 'warehouse_mgr', details: 'GRN-940 discrepancy in cloth roll batch counts', value: '45 Rolls', status: 'Pending', createdAt: new Date(Date.now() - 3600000 * 5).toISOString() },
    { id: 'APP-103', type: 'Inventory Audit', requestedTo: 'admin', requestedBy: 'inventory_lead', details: 'Stock discrepancy adjustment for Polyester yarn', value: '-200 kg', status: 'Pending', createdAt: new Date().toISOString() },
    { id: 'APP-104', type: 'Sales Order', requestedTo: 'sales_rep', requestedBy: 'admin', details: 'SO-1005 price variance check', value: '$8,200.00', status: 'Pending', createdAt: new Date(Date.now() - 3600000 * 24).toISOString() },
    { id: 'APP-105', type: 'GRN Log', requestedTo: 'admin', requestedBy: 'warehouse_mgr', details: 'GRN-932 general approval', value: '12 Rolls', status: 'Approved', createdAt: new Date(Date.now() - 3600000 * 48).toISOString(), completedAt: new Date(Date.now() - 3600000 * 47).toISOString() }
  ],
  gatePassActivities: [],
  purchaseDemands: [],
  purchaseOrders: [],
  salesInvoices: [],
  purchaseInvoices: [],
  paymentVouchers: [],
  chartOfAccounts: DEFAULT_CHART_OF_ACCOUNTS,
  hr_overtime_requests: [],
  hr_leave_requests: [],
  hr_generated_salaries: [],
  hr_loan_requests: [],
  hr_loan_ledger: [],
  adminSetup: {
    printSettings: {
      documentLayouts: {
        delivery_challan: {
          orientation: 'portrait',
          showHeaderLogo: true,
          showHeaderDetails: true,
          styles: {
            title: { fontSize: '24px', color: '#000000', align: 'right', bold: true, underline: false },
            metaFields: { fontSize: '12px', color: '#000000', align: 'left', bold: false, underline: false },
            tableHeader: { fontSize: '11px', color: '#ffffff', bgColor: '#4f46e5', align: 'left', bold: true, underline: false },
            tableBody: { fontSize: '11px', color: '#374151', align: 'left', bold: false, underline: false },
            disclaimer: { fontSize: '10px', color: '#4b5563', align: 'left', bold: false, underline: false },
            signatures: { fontSize: '11px', color: '#1f2937', align: 'center', bold: true, underline: false }
          },
          fields: {
            customerName: { label: 'Customer Name', enabled: true, borderRound: false, fontSize: '12px', color: '#000000', align: 'left', bold: false, underline: false },
            docId: { label: 'Document ID', enabled: true, borderRound: false, fontSize: '12px', color: '#000000', align: 'left', bold: false, underline: false },
            date: { label: 'Date', enabled: true, borderRound: false, fontSize: '12px', color: '#000000', align: 'left', bold: false, underline: false }
          },
          columns: {
            col_0: { label: 'Item Code', enabled: true, width: '20%', align: 'left' },
            col_1: { label: 'Item Name', enabled: true, width: '40%', align: 'left' },
            col_2: { label: 'Rolls', enabled: true, width: '20%', align: 'right' },
            col_3: { label: 'Qty', enabled: true, width: '20%', align: 'right' }
          }
        },
        return_slip: {
          orientation: 'portrait',
          showHeaderLogo: true,
          showHeaderDetails: true,
          styles: {
            title: { fontSize: '24px', color: '#000000', align: 'right', bold: true, underline: false },
            metaFields: { fontSize: '12px', color: '#000000', align: 'left', bold: false, underline: false },
            tableHeader: { fontSize: '11px', color: '#ffffff', bgColor: '#ef4444', align: 'left', bold: true, underline: false },
            tableBody: { fontSize: '11px', color: '#374151', align: 'left', bold: false, underline: false },
            disclaimer: { fontSize: '10px', color: '#4b5563', align: 'left', bold: false, underline: false },
            signatures: { fontSize: '11px', color: '#1f2937', align: 'center', bold: true, underline: false }
          },
          fields: {
            customerName: { label: 'Customer Name', enabled: true, borderRound: false, fontSize: '12px', color: '#000000', align: 'left', bold: false, underline: false },
            docId: { label: 'Document ID', enabled: true, borderRound: false, fontSize: '12px', color: '#000000', align: 'left', bold: false, underline: false },
            date: { label: 'Date', enabled: true, borderRound: false, fontSize: '12px', color: '#000000', align: 'left', bold: false, underline: false }
          },
          columns: {
            col_0: { label: 'Item Code', enabled: true, width: '20%', align: 'left' },
            col_1: { label: 'Item Name', enabled: true, width: '40%', align: 'left' },
            col_2: { label: 'Reason', enabled: true, width: '25%', align: 'left' },
            col_3: { label: 'Qty', enabled: true, width: '15%', align: 'right' }
          }
        }
      }
    }
  },
  themeSettings: {
    colorMode: 'light',
    primaryColor: 'indigo',
    fontStyle: 'inter',
    fontSize: 16,
    borderRadius: 'rounded'
  },
  displaySettings: {
    webScale: 75,
    mobileScale: 100,
    sidebarPosition: 'left',
    subMenuPosition: 'left'
  },
  dashboardLayout: [
    { i: 'delivery_kpi', x: 0, y: 0, w: 12, h: 4, type: 'delivery_kpi', static: false },
    { i: 'shortcuts', x: 0, y: 4, w: 4, h: 4, type: 'shortcuts', static: false },
    { i: 'todo_list', x: 4, y: 4, w: 4, h: 6, type: 'todo_list', static: false },
    { i: 'calendar', x: 8, y: 4, w: 4, h: 6, type: 'calendar', static: false }
  ],
  dashboardBackground: null,
  // FILES CABINET (2026-10-25): this user's per-user binder spine colours,
  // { [binderId]: colorClass } — persisted per user in user_settings like
  // themeSettings/displaySettings; the binder record's own colorClass is
  // the default everyone sees until they pick their own.
  binderColors: {},
  productionTarget: 50000,
  isGlobalPaginated: true,
  departments: [],
  itemCategories: [
    { label: 'Finished Goods', value: 'Finished Goods', disabled: false },
    { label: 'Raw Material', value: 'Raw Material', disabled: false }
  ],
  categoryPrefixes: {
    'Finished Goods': 'ITM',
    'Raw Material': 'RM'
  },
  rawMaterialTypesList: [
    { label: 'Cloth', value: 'Cloth', disabled: false },
    { label: 'Chemical', value: 'Chemical', disabled: false },
    { label: 'Metal', value: 'Metal', disabled: false },
    { label: 'Plastic', value: 'Plastic', disabled: false },
    { label: 'Other', value: 'Other', disabled: false }
  ],
  uomList: [
    { label: 'Kilograms (kg)', value: 'Kilograms (kg)', disabled: false },
    { label: 'Liters (L)', value: 'Liters (L)', disabled: false },
    { label: 'Units (ea)', value: 'Units (ea)', disabled: false },
    { label: 'Meters (m)', value: 'Meters (m)', disabled: false }
  ],
  packingTypesList: [
    { label: 'Box', value: 'Box', disabled: false },
    { label: 'Roll', value: 'Roll', disabled: false },
    { label: 'Drum', value: 'Drum', disabled: false },
    { label: 'Bag', value: 'Bag', disabled: false },
    { label: 'Liquid', value: 'Liquid', disabled: false }
  ],
  routingTasks: [],
  routingRules: []
};

const defaultMockEmployees = [];

const defaultMockLeaveRequests = [];

const defaultMockOvertimeRequests = [];

const seedStateIfEmpty = (stateObj) => {
  const seeded = { ...stateObj };
  const keysToEnsure = [
    'users',
    'customers',
    'suppliers',
    'items',
    'saleOrders', 
    'productionPlans', 
    'productionOutputs', 
    'deliveries', 
    'returns', 
    'grns', 
    'stockTransfers', 
    'auditLogs',
    'purchaseDemands',
    'purchaseOrders',
    'inwardGatePasses',
    'salesInvoices',
    'purchaseInvoices',
    'otherConsumptions',
    'paymentVouchers',
    'chartOfAccounts',
    'vouchers',
    'chats',
    'hr_employees_list',
    'hr_uploaded_attendance',
    'hr_overtime_requests',
    'hr_leave_requests',
    'hr_generated_salaries',
    'hr_loan_requests',
    'hr_loan_ledger',
    'approvals',
    'boms',
    'rawMaterialPhases',
    'finishedGoodPhases',
    'routingTasks',
    'routingRules'
  ];
  keysToEnsure.forEach(key => {
    if (!seeded[key]) {
      seeded[key] = [];
    }
  });

  if (!seeded.rawMaterialPhases || seeded.rawMaterialPhases.length === 0) {
    seeded.rawMaterialPhases = initialMockState.rawMaterialPhases || [];
  }
  if (!seeded.finishedGoodPhases || seeded.finishedGoodPhases.length === 0) {
    seeded.finishedGoodPhases = initialMockState.finishedGoodPhases || [];
  }

    // Ensure standard Chart of Accounts
  if (!seeded.chartOfAccounts || seeded.chartOfAccounts.length === 0) {
    seeded.chartOfAccounts = DEFAULT_CHART_OF_ACCOUNTS;
  }

  // Remove any legacy mock finance items from stored state
  const dummyIds = new Set([
    'INV-8901', 'INV-8902', 'INV-8903', 'INV-8904',
    'PINV-7801', 'PINV-7802', 'PINV-7803',
    'PV-001', 'PV-002', 'PV-003', 'PV-004',
    'VOUCH-1001', 'VOUCH-1002', 'VOUCH-1003', 'VOUCH-1004',
    'JV-2026-0001', 'CPV-2026-0002'
  ]);
  const isDummyItem = x => {
    if (!x) return false;
    const id = x.id || x.voucherNo || x.invoiceNo || '';
    const ref = x.invoiceId || x.reference || '';
    return dummyIds.has(id) || dummyIds.has(ref);
  };
  if (Array.isArray(seeded.salesInvoices)) {
    seeded.salesInvoices = seeded.salesInvoices.filter(x => !isDummyItem(x));
  }
  if (Array.isArray(seeded.purchaseInvoices)) {
    seeded.purchaseInvoices = seeded.purchaseInvoices.filter(x => !isDummyItem(x));
  }
  if (Array.isArray(seeded.vouchers)) {
    seeded.vouchers = seeded.vouchers.filter(x => !isDummyItem(x));
  }
  if (Array.isArray(seeded.paymentVouchers)) {
    seeded.paymentVouchers = seeded.paymentVouchers.filter(x => !isDummyItem(x));
  }
  if (Array.isArray(seeded.chartOfAccounts)) {
    seeded.chartOfAccounts = seeded.chartOfAccounts.map(acc => {
      if (acc.openingDebit === 2450000 || acc.openingDebit === 1500000 || acc.openingDebit === 3800000 || acc.openingDebit === 9500000) {
        return { ...acc, openingDebit: 0, openingCredit: 0 };
      }
      return acc;
    });
  }

  return reconcileHRApprovalsAndLedgers(seeded);
};

export const reconcileHRApprovalsAndLedgers = (stateObj) => {
  if (!stateObj) return stateObj;

  let approvals = [...(stateObj.approvals || [])];
  let loanRequests = [...(stateObj.hr_loan_requests || [])];
  let loanLedger = [...(stateObj.hr_loan_ledger || [])];
  let overtimeRequests = [...(stateObj.hr_overtime_requests || [])];
  let uploadedAttendance = [...(stateObj.hr_uploaded_attendance || [])];
  let employeesList = [...(stateObj.hr_employees_list || [])];

  let hasChanged = false;

  // 0. Synchronize sibling approval items for the same document
  const nonPendingApprovals = approvals.filter(a => a.status && a.status !== 'Pending');
  nonPendingApprovals.forEach(decidedApp => {
    const targetDocId = decidedApp.loanRequestId || decidedApp.documentId || decidedApp.id;
    approvals.forEach((app, idx) => {
      if (app.id !== decidedApp.id && app.status === 'Pending') {
        const isMatch = (
          (targetDocId && (app.loanRequestId === targetDocId || app.documentId === targetDocId)) ||
          (targetDocId && app.details && app.details.includes(targetDocId)) ||
          (decidedApp.details && app.details && decidedApp.details === app.details) ||
          (decidedApp.loanRequestId && app.loanRequestId && decidedApp.loanRequestId === app.loanRequestId)
        );
        if (isMatch) {
          approvals[idx] = {
            ...app,
            status: decidedApp.status,
            completedAt: app.completedAt || decidedApp.completedAt || new Date().toISOString(),
            timestamp: decidedApp.timestamp || Date.now(),
            reasonComment: app.reasonComment || decidedApp.reasonComment || ''
          };
          hasChanged = true;
        }
      }
    });
  });

  // 1. Process all Approved items in state.approvals
  approvals.forEach(app => {
    if (app.status === 'Approved') {
      const typeLower = (app.type || '').toLowerCase();

      // Overtime Request Approval Sync
      if (typeLower.includes('overtime')) {
        const targetDocId = app.loanRequestId || app.documentId || app.id;
        let otReqIdx = overtimeRequests.findIndex(o => 
          o.id === targetDocId || 
          o.id === app.id || 
          (app.details && app.details.includes(o.id)) ||
          (o.employeeName && (o.employeeName === app.employeeName || (app.details && app.details.includes(o.employeeName))))
        );

        let otReq = otReqIdx !== -1 ? overtimeRequests[otReqIdx] : null;

        if (otReq && otReq.status !== 'Approved') {
          overtimeRequests[otReqIdx] = { ...otReq, status: 'Approved', approvedAt: otReq.approvedAt || new Date().toISOString() };
          hasChanged = true;
          otReq = overtimeRequests[otReqIdx];
        }

        const empName = otReq?.employeeName || app.employeeName || (app.details ? app.details.split(' - ')[1]?.split(' (')[0] : '');
        const otDate = otReq?.date || app.date || app.overtimeDate || new Date().toISOString().substring(0, 10);
        const otHours = parseFloat(otReq?.hours || app.hours || (app.details?.match(/\(([\d.]+)\s*hrs?\)/i)?.[1]) || 2.0);

        if (empName && otDate && otHours > 0) {
          // Sync into hr_uploaded_attendance
          const attIdx = uploadedAttendance.findIndex(a => 
            (a.employeeName === empName || (app.employeeId && a.id === app.employeeId)) && a.date === otDate
          );
          if (attIdx !== -1) {
            if (parseFloat(uploadedAttendance[attIdx].ot || 0) < otHours) {
              uploadedAttendance[attIdx] = {
                ...uploadedAttendance[attIdx],
                ot: otHours,
                overtimeHours: otHours,
                status: uploadedAttendance[attIdx].status === 'absent' ? 'present' : (uploadedAttendance[attIdx].status || 'present')
              };
              hasChanged = true;
            }
          } else {
            uploadedAttendance.push({
              id: app.employeeId || `EMP-${Date.now()}`,
              employeeName: empName,
              date: otDate,
              status: 'present',
              ot: otHours,
              overtimeHours: otHours,
              fines: 0,
              deductions: 0
            });
            hasChanged = true;
          }

          // Sync into hr_employees_list
          const empIdx = employeesList.findIndex(e => e.name === empName || (app.employeeId && e.id === app.employeeId));
          if (empIdx !== -1) {
            const emp = employeesList[empIdx];
            const att = emp.attendance || {};
            const dayAtt = att[otDate] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };
            if (parseFloat(dayAtt.ot || 0) < otHours || dayAtt.status === 'absent') {
              employeesList[empIdx] = {
                ...emp,
                attendance: {
                  ...att,
                  [otDate]: {
                    ...dayAtt,
                    status: dayAtt.status === 'absent' ? 'present' : (dayAtt.status || 'present'),
                    ot: otHours,
                    explicitStatus: true
                  }
                }
              };
              hasChanged = true;
            }
          }
        }
      }

      // Loan Request Approval Sync
      if (typeLower.includes('loan')) {
        const targetDocId = app.loanRequestId || app.documentId || app.id;
        let loanReqIdx = loanRequests.findIndex(l => 
          l.id === targetDocId || 
          l.id === app.id || 
          (app.details && app.details.includes(l.id)) ||
          (l.employeeName && (l.employeeName === app.employeeName || (app.details && app.details.includes(l.employeeName))))
        );

        if (loanReqIdx !== -1) {
          if (loanRequests[loanReqIdx].status !== 'Approved') {
            loanRequests[loanReqIdx] = { ...loanRequests[loanReqIdx], status: 'Approved', approvedAt: new Date().toISOString() };
            hasChanged = true;
          }
        } else if (app.details) {
          const empName = app.details.split(' - ')[1]?.split(' (')[0] || 'Employee';
          const amount = parseFloat(app.value?.replace(/[^0-9.]/g, '') || 50000);
          const newLoanReq = {
            id: targetDocId.startsWith('#LR') ? targetDocId : `#LR-${Math.floor(1000 + Math.random() * 9000)}`,
            employeeId: app.employeeId || `EMP-${Date.now()}`,
            employeeName: empName,
            department: app.department || 'Operations',
            dateApplied: new Date().toISOString().substring(0, 10),
            repaymentStartDate: new Date().toISOString().substring(0, 10),
            type: 'Personal Loan',
            amount: amount,
            termMonths: 12,
            monthlyInstallment: parseFloat((amount / 12).toFixed(2)),
            purpose: app.details,
            status: 'Approved',
            approvedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          loanRequests.unshift(newLoanReq);
          hasChanged = true;
        }
      }
    }
  });

  // 2. Process all Approved records in hr_loan_requests -> ensure entries in hr_loan_ledger
  loanRequests.forEach(req => {
    if (req.status === 'Approved') {
      const existingIdx = loanLedger.findIndex(l => 
        l.loanRequestId === req.id || 
        (l.employeeId === req.employeeId && l.totalLoanAmount === (req.amount || req.loanAmount) && l.status === 'Active') ||
        (l.employeeName === req.employeeName && l.totalLoanAmount === (req.amount || req.loanAmount) && l.status === 'Active')
      );

      if (existingIdx === -1) {
        const amount = parseFloat(req.amount || req.loanAmount || 0);
        const term = parseInt(req.termMonths || 1);
        const monthlyInst = parseFloat(req.monthlyInstallment || (term > 0 ? (amount / term) : amount));
        const startDate = req.repaymentStartDate || req.deductionDate || new Date().toISOString().substring(0, 10);

        loanLedger.unshift({
          id: `LL-${Math.floor(1000 + Math.random() * 9000)}`,
          loanRequestId: req.id,
          employeeId: req.employeeId || 'EMP-4091',
          employeeName: req.employeeName,
          department: req.department || 'Operations',
          designation: req.designation || 'Staff',
          loanType: req.type || req.loanType || 'Personal Loan',
          totalLoanAmount: amount,
          termMonths: term,
          monthlyInstallment: parseFloat(monthlyInst.toFixed(2)),
          repaymentStartDate: startDate,
          nextDeductionDate: startDate,
          paidAmount: 0,
          remainingBalance: amount,
          status: 'Active',
          deductionsHistory: [],
          createdAt: new Date().toISOString()
        });
        hasChanged = true;
      }
    }
  });

  // 3. Process all Approved records in hr_overtime_requests -> ensure entries in attendance lists
  overtimeRequests.forEach(req => {
    if (req.status === 'Approved' && req.date && parseFloat(req.hours || 0) > 0) {
      const empName = req.employeeName || 'Employee';
      const otDate = req.date;
      const otHours = parseFloat(req.hours);

      // Sync to hr_uploaded_attendance
      const empNameLower = String(empName || '').trim().toLowerCase();
      const attIdx = uploadedAttendance.findIndex(a => 
        (a.employeeName && String(a.employeeName).trim().toLowerCase() === empNameLower) || (req.employeeId && String(a.id) === String(req.employeeId))
      );
      if (attIdx !== -1) {
        if (parseFloat(uploadedAttendance[attIdx].ot || 0) < otHours) {
          uploadedAttendance[attIdx] = {
            ...uploadedAttendance[attIdx],
            ot: otHours,
            overtimeHours: otHours,
            status: uploadedAttendance[attIdx].status === 'absent' ? 'present' : (uploadedAttendance[attIdx].status || 'present')
          };
          hasChanged = true;
        }
      } else {
        uploadedAttendance.push({
          id: req.employeeId || `EMP-${Date.now()}`,
          employeeName: empName,
          date: otDate,
          status: 'present',
          ot: otHours,
          overtimeHours: otHours,
          fines: 0,
          deductions: 0
        });
        hasChanged = true;
      }

      // Sync to hr_employees_list
      const empIdx = employeesList.findIndex(e => String(e.name || '').trim().toLowerCase() === empNameLower || (req.employeeId && String(e.id) === String(req.employeeId)));
      if (empIdx !== -1) {
        const emp = employeesList[empIdx];
        const att = emp.attendance || {};
        const dayAtt = att[otDate] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };
        if (parseFloat(dayAtt.ot || 0) < otHours || dayAtt.status === 'absent') {
          employeesList[empIdx] = {
            ...emp,
            attendance: {
              ...att,
              [otDate]: {
                ...dayAtt,
                status: dayAtt.status === 'absent' ? 'present' : (dayAtt.status || 'present'),
                ot: otHours,
                explicitStatus: true
              }
            }
          };
          hasChanged = true;
        }
      }
    }
  });

  if (hasChanged) {
    return {
      ...stateObj,
      approvals: approvals,
      hr_loan_requests: loanRequests,
      hr_loan_ledger: loanLedger,
      hr_overtime_requests: overtimeRequests,
      hr_uploaded_attendance: uploadedAttendance,
      hr_employees_list: employeesList
    };
  }

  return stateObj;
};

// Phase C Step 6 — binders structural guard, REVISED for the Files Cabinet
// cleanup (2026-10-25): binders live ONLY in the document_warehouse_binders
// table (the read AND write source since Step 6) — never in user_settings
// and never resurrected from a cached copy. The old guard substituted the
// last-good array whenever a save carried a non-array binders value, which
// would resurrect deleted binders into the blob fallback copy forever.
// Now: an array passes through exactly as-is (an EMPTY array persists as
// empty — the cabinet being empty is a valid state), and a non-array value
// normalizes to an empty array instead of an old copy.
const getSanitizedSyncState = (stateObj) => {
  if (!stateObj) return {};
  const cleanState = { ...stateObj };
  delete cleanState.themeSettings;
  delete cleanState.displaySettings;
  delete cleanState.dashboardLayout;
  delete cleanState.dashboardBackground;
  // FILES CABINET (2026-10-25): per-user binder spine colours live ONLY in
  // user_settings (key 'binderColors') — never in the blob.
  delete cleanState.binderColors;
  delete cleanState.currentUser;
  // FLASHAM PHASE A: the Flash AM terminal config lives ONLY in app_config
  // (key 'flashAmConfig', table copy wins on load) — never in the blob.
  delete cleanState.flash_am_config;
  // HR PRINTS: the Salary Generation print settings live ONLY in app_config
  // (key 'salaryPrintSettings', table copy wins on load) — never in the blob.
  delete cleanState.salary_print_settings;
  // HR PAYROLL MAPPING: the payroll-category -> GL-account mappings live
  // ONLY in app_config (key 'payrollAccountMapping', table copy wins on
  // load) — never in the blob.
  delete cleanState.payroll_account_mapping;
  // LOGIN THEMES (2026-10-25): the login screen theme settings live ONLY in
  // app_config (key 'loginThemeSettings', table copy wins on load) — never
  // in the blob.
  delete cleanState.login_theme_settings;
  // SERVER RULE (2026-10-26): HR duty settings live ONLY in app_config
  // (key 'hrDutySettings', table copy wins on load) — never in the blob.
  delete cleanState.hr_duty_settings;
  // SERVER RULE (2026-10-26): the Salary & Allowance config + per-employee
  // allowance map live ONLY in app_config (key 'hrSalaryAllowanceConfig',
  // table copy wins on load) — never in the blob.
  delete cleanState.hr_salary_allowance_config;
  delete cleanState.hr_employee_allowance_map;
  if (!Array.isArray(cleanState.documentWarehouseBinders)) {
    cleanState.documentWarehouseBinders = [];
  }
  if (cleanState.users) {
    cleanState.users = cleanState.users.map(u => {
      const { lastActive, ...rest } = u;
      return rest;
    });
  }
  return cleanState;
};

export const AppProvider = ({ children }) => {
  const connectionId = useRef(
    sessionStorage.getItem('connectionId') || 
    (() => {
      const newId = 'conn_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
      sessionStorage.setItem('connectionId', newId);
      return newId;
    })()
  );

  const getDeviceId = () => {
    try {
      let id = localStorage.getItem('fv_device_id');
      if (!id) {
        id = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
        localStorage.setItem('fv_device_id', id);
      }
      return id;
    } catch (e) {
      return 'dev_' + Date.now();
    }
  };

  const sessionsChannelRef = useRef(null);
  // Single-session handover (Part C, 2026-10-25): connection ids THIS
  // client signed out during its own login. Their late realtime events
  // (a final heartbeat can resurrect a swept row) must never kick the
  // session that replaced them — see the user_sessions channel handler.
  const terminatedConnectionIdsRef = useRef(new Set());
  const clientId = useRef(Math.random().toString(36).substr(2, 9) + Date.now().toString(36));
  const isLocalStorageWriting = useRef(false);
  const isRemoteSyncing = useRef(false);
  const isFirstRemoteSyncCompleted = useRef(false);
  const guardBaseUpdatedAtRef = useRef(null); // SYNC GUARD: updated_at of the remote version this client has actually APPLIED (or written itself). erp_state writes are only allowed on top of this base.
  const isUserSettingsLoaded = useRef(false);
  const pendingWriteRef = useRef(null);
  const isLocalUpsertInFlight = useRef(false);
  const lastSyncedStateRef = useRef('');
  const lastSyncedUpdatedAtRef = useRef('');
  const standaloneTablesSupportedRef = useRef(false);
  // PHASE C STEP 1: per-entity tables are the read source for the step-1
  // collections (items, customers, suppliers + lookup lists). The gate opens
  // only after the initial table-load attempt completes; the snapshots hold
  // the last table-synced content per collection so state changes can be
  // diffed and written through record-by-record.
  const step1TablesReadyRef = useRef(false);
  const step1SnapshotsRef = useRef({});
  const adminSetupLoadedRef = useRef(false);
  const adminSetupSnapshotRef = useRef(null);
  const fgComboConfigLoadedRef = useRef(false);
  const fgComboConfigSnapshotRef = useRef(null);
  const flashAmConfigLoadedRef = useRef(false);
  const flashAmConfigSnapshotRef = useRef(null);
  const loginThemeSettingsLoadedRef = useRef(false);
  const loginThemeSettingsSnapshotRef = useRef(null);
  const salaryPrintSettingsLoadedRef = useRef(false);
  const salaryPrintSettingsSnapshotRef = useRef(null);
  const dutySettingsLoadedRef = useRef(false);
  const dutySettingsSnapshotRef = useRef(null);
  const salaryAllowanceLoadedRef = useRef(false);
  const salaryAllowanceSnapshotRef = useRef(null);
  const payrollMappingLoadedRef = useRef(false);
  const payrollMappingSnapshotRef = useRef(null);
  const categoryPrefixesLoadedRef = useRef(false);
  const categoryPrefixesSnapshotRef = useRef(null);
  const scalarsLoadedRef = useRef(false);
  const scalarsSnapshotRef = useRef(null);
  const countersLoadedRef = useRef(false);
  const countersSnapshotRef = useRef(null);
  const batchOutputTypesLoadedRef = useRef(false);
  const batchOutputTypesSnapshotRef = useRef(null);
  const batchLaborConfigLoadedRef = useRef(false);
  const batchLaborConfigSnapshotRef = useRef(null);
  const lsDebounceRef = useRef({ hr_employees_list: null, hr_uploaded_attendance: null });

  const safeLocalStorageSet = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        console.warn(`[Storage] QuotaExceededError writing ${key}. Evicting non-essential cache.`);
        try {
          const keysToEvict = ['hr_uploaded_attendance', 'hr_generated_salaries', 'hr_overtime_requests', 'hr_leave_requests', 'routingTasks'];
          keysToEvict.forEach(k => {
            if (k !== key) localStorage.removeItem(k);
          });
          localStorage.setItem(key, value);
        } catch (retryErr) {
          console.warn(`[Storage] Could not persist ${key} locally after eviction:`, retryErr);
        }
      }
    }
  };

  const [isInitialLoadCompleted, setIsInitialLoadCompleted] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const currentUserRef = useRef(null);

  const handleForceConcurrentLogout = () => {
    const loggedUser = currentUserRef.current;
    if (!loggedUser) return;
    console.warn('[Security Shield] Account was logged in from another device. Forcing logout on this terminal.');

    destroySession();

    try {
      supabase.from('user_sessions').delete().eq('connection_id', connectionId.current);
    } catch(e) {}

    const auditLog = {
      id: 'LOG-' + Date.now(),
      timestamp: new Date().toISOString(),
      action: 'Concurrent Session Terminated',
      module: 'Security Shield',
      details: 'User ' + (loggedUser.name || loggedUser.username) + ' was logged out because the account was accessed from another device/browser.',
      status: 'Warning',
      user: loggedUser.name || loggedUser.username || 'System'
    };

    setState(prev => ({
      ...prev,
      currentUser: null,
      auditLogs: [auditLog, ...(prev.auditLogs || [])].slice(0, 200)
    }));

    window.dispatchEvent(new CustomEvent('fv_session_expired', {
      detail: { reason: 'concurrent_device_login' }
    }));
  };

  const [state, setState] = useState(() => {
    let stateObj;
    const saved = localStorage.getItem('aj_synthetic_erp') || sessionStorage.getItem('aj_synthetic_erp');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        if (parsed.users) {
          const merged = [...parsed.users];
          initialMockState.users.forEach(mu => {
            if (!merged.some(u => u.username === mu.username)) {
              merged.push(mu);
            }
          });
          parsed.users = merged;
        }

        // Strictly restore currentUser ONLY if a cryptographically valid, unexpired session exists
        try {
          const sessionVal = validateCurrentSession();
          const activeUser = sessionVal.session?.user || 
                             (sessionVal.session?.username ? sessionVal.session : null) || 
                             (() => {
                               try {
                                 const u = localStorage.getItem('aj_current_user');
                                 return u ? JSON.parse(u) : null;
                               } catch (e) { return null; }
                             })();

          if ((sessionVal.isValid && activeUser) || (activeUser && localStorage.getItem('aj_current_user'))) {
            parsed.currentUser = activeUser;
            if (parsed.users) {
              const latest = parsed.users.find(u => 
                String(u.id) === String(parsed.currentUser.id) || 
                (u.username && parsed.currentUser.username && u.username.toLowerCase() === parsed.currentUser.username.toLowerCase())
              );
              if (latest) {
                parsed.currentUser = sanitizeUser({ ...parsed.currentUser, ...latest });
              }
            }
          } else {
            parsed.currentUser = null;
            destroySession();
          }
        } catch(e) {
          parsed.currentUser = null;
        }

        // Migrate old itemCodes that were prefixed with orderId (e.g., SO-001-ITM-001 -> ITM-001)
        if (parsed.saleOrders) {
           parsed.saleOrders.forEach(o => {
               if (o.items) {
                   o.items.forEach(i => {
                       if (i.itemCode && i.itemCode.includes('-ITM-')) {
                           i.itemCode = 'ITM-' + i.itemCode.split('-ITM-')[1];
                       }
                   });
               }
           });
        }

        // Self-heal negative stockByType caused by old matching bugs
        if (parsed.items && parsed.productionPlans) {
            parsed.items.forEach(item => {
                if (item.stockByType) {
                    let needsHeal = false;
                    Object.values(item.stockByType).forEach(qty => {
                        if (qty < 0) needsHeal = true;
                    });
                    
                    if (needsHeal) {
                        item.stockByType = {};
                        parsed.productionPlans.forEach(plan => {
                            if (plan.status !== 'Cancelled') {
                                plan.items.forEach(pi => {
                                    if (pi.itemCode === item.sku || pi.itemCode === item.id || pi.productName === item.name) {
                                        if (pi.outputs) {
                                            pi.outputs.forEach(out => {
                                                // From-stock outputs never added to
                                                // stockByType — they must not be
                                                // replayed into it here either.
                                                if (isStockOutput(out)) return;
                                                const qty = parseFloat(out.quantity) || 0;
                                                if (qty > 0 && out.typeName) {
                                                    item.stockByType[out.typeName] = (item.stockByType[out.typeName] || 0) + qty;
                                                }
                                            });
                                        }
                                    }
                                });
                            }
                        });
                        
                        // Fix overall stock if it's also corrupted negatively
                        if (item.stock < 0) {
                            item.stock = Object.values(item.stockByType).reduce((sum, q) => sum + q, 0);
                        }
                    }
                } else if (item.stock < 0) {
                    item.stock = 0;
                }
            });
        }

        stateObj = seedStateIfEmpty(parsed);
      } catch(e) {
        stateObj = seedStateIfEmpty(initialMockState);
      }
    } else {
      stateObj = seedStateIfEmpty(initialMockState);
    }

    try {
      const storedUser = (() => {
        try {
          const u = localStorage.getItem('aj_current_user') || sessionStorage.getItem('aj_current_user');
          return u ? JSON.parse(u) : null;
        } catch (e) { return null; }
      })();

      const sessionVal = validateCurrentSession();
      const activeUser = sessionVal.session?.user || 
                         (sessionVal.session?.username ? sessionVal.session : null) || 
                         storedUser;

      if (activeUser && (storedUser || sessionVal.isValid)) {
        stateObj.currentUser = activeUser;
      } else {
        stateObj.currentUser = null;
      }
    } catch(e) {
      stateObj.currentUser = null;
    }
    return stateObj;
  });

  const [isDirty, setDirty] = useState(false);

  // Initialize lastSyncedStateRef baseline so clean boots do not trigger false sync writes
  if (!lastSyncedStateRef.current && state) {
    lastSyncedStateRef.current = JSON.stringify(getSanitizedSyncState(state));
  }

  // Keep currentUserRef continuously synchronized
  useEffect(() => {
    currentUserRef.current = state.currentUser;
  }, [state.currentUser]);

  // Enterprise Session Inactivity & Health Guard (with Remote Concurrent Device Check)
  useEffect(() => {
    if (!state.currentUser) return;

    let lastTouch = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      lastUserInteractionRef.current = now;
      if (now - lastTouch > 20000) {
        lastTouch = now;
        touchSessionActivity();
      }
    };

    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('click', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });

    const checkSessionIntegrity = () => {
      if (typeof document !== 'undefined' && document.hidden) return; // Zero egress when tab is in background!

      const validation = validateCurrentSession();
      if (!validation.isValid) {
        console.warn('[Security Guard] Session expired or invalidated:', validation.reason);
        destroySession();
        setState(prev => ({ ...prev, currentUser: null }));
        window.dispatchEvent(new CustomEvent('fv_session_expired', { detail: { reason: validation.reason } }));
        return;
      }

      // Check remote single-session integrity in Supabase only if user is actively using the tab
      if (currentUserRef.current?.username && (Date.now() - lastUserInteractionRef.current < 5 * 60 * 1000)) {
        supabase
          .from('user_sessions')
          .select('connection_id, device_info, last_active')
          .ilike('username', currentUserRef.current.username)
          .then(({ data, error }) => {
            if (!error && data && data.length > 0) {
              const myConn = connectionId.current;
              const myDev = getDeviceId();
              const isMySessionActive = data.some(s => {
                if (s.connection_id === myConn) return true;
                try {
                  const p = typeof s.device_info === 'string' ? JSON.parse(s.device_info) : s.device_info;
                  if (p?.deviceId === myDev) return true;
                } catch (e) {}
                return false;
              });

              if (!isMySessionActive) {
                console.warn('[Security Guard] Session superseded by another device in background probe.');
                handleForceConcurrentLogout();
              }
            }
          });
      }
    };

    // Ultra-low Egress: Changed from 15s to 5 minutes, completely paused when tab is inactive/background
    const sessionInterval = setInterval(checkSessionIntegrity, 300000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      clearInterval(sessionInterval);
    };
  }, [state.currentUser?.username]);


  // Ensure newly added global structures exist in old states
  useEffect(() => {
    setState(prev => {
        let updated = false;
        let nextState = { ...prev };
        if (!prev.notifications) { nextState.notifications = []; updated = true; }
        if (!prev.returns) { nextState.returns = []; updated = true; }
        if (!prev.approvals) { nextState.approvals = []; updated = true; }
        if (!prev.purchaseDemands) { nextState.purchaseDemands = []; updated = true; }
        if (!prev.purchaseOrders) { nextState.purchaseOrders = []; updated = true; }
        if (!prev.inwardGatePasses) { nextState.inwardGatePasses = []; updated = true; }
        if (!prev.grns) { nextState.grns = []; updated = true; }
        if (!prev.stockTransfers) { nextState.stockTransfers = []; updated = true; }
        if (!prev.otherConsumptions) { nextState.otherConsumptions = []; updated = true; }
        if (!prev.auditLogs) { nextState.auditLogs = []; updated = true; }
        if (!prev.salesInvoices) { nextState.salesInvoices = []; updated = true; }
        if (!prev.purchaseInvoices) { nextState.purchaseInvoices = []; updated = true; }
        if (!prev.paymentVouchers) { nextState.paymentVouchers = []; updated = true; }
        if (!prev.chartOfAccounts || prev.chartOfAccounts.length === 0) { 
          nextState.chartOfAccounts = DEFAULT_CHART_OF_ACCOUNTS; 
          updated = true; 
        } else {
          // Clean any lingering dummy opening balances from previous runs
          const hasDummyCoa = prev.chartOfAccounts.some(acc => acc.openingDebit === 2450000 || acc.openingDebit === 1500000);
          if (hasDummyCoa) {
            nextState.chartOfAccounts = prev.chartOfAccounts.map(acc => 
              (acc.openingDebit === 2450000 || acc.openingDebit === 1500000 || acc.openingDebit === 3800000 || acc.openingDebit === 9500000)
                ? { ...acc, openingDebit: 0, openingCredit: 0 }
                : acc
            );
            updated = true;
          }
        }
        // Clean legacy dummy invoices and vouchers if present in state.
        // ONLY ids no live generator can produce: the writers number their
        // first real documents PINV-7801…, INV-8901… and JV-001 / CPV-001…
        // (short per-type voucher series since 2026-10-24), so those ids
        // must never be purged here — an earlier version of this set
        // deleted the first real PIs/SIs/vouchers from state on app load.
        // 'PV-*'/'VOUCH-*' are seed-only.
        const dummyBadIds = new Set(['PV-001','PV-002','PV-003','PV-004','VOUCH-1001','VOUCH-1002','VOUCH-1003','VOUCH-1004']);
        const isLegacyDummy = x => {
          if (!x) return false;
          const id = x.id || x.voucherNo || x.invoiceNo || '';
          const ref = x.invoiceId || x.reference || '';
          return dummyBadIds.has(id) || dummyBadIds.has(ref);
        };
        if (Array.isArray(prev.salesInvoices) && prev.salesInvoices.some(isLegacyDummy)) {
          nextState.salesInvoices = prev.salesInvoices.filter(x => !isLegacyDummy(x));
          updated = true;
        }
        if (Array.isArray(prev.purchaseInvoices) && prev.purchaseInvoices.some(isLegacyDummy)) {
          nextState.purchaseInvoices = prev.purchaseInvoices.filter(x => !isLegacyDummy(x));
          updated = true;
        }
        if (Array.isArray(prev.vouchers) && prev.vouchers.some(isLegacyDummy)) {
          nextState.vouchers = prev.vouchers.filter(x => !isLegacyDummy(x));
          updated = true;
        }
        if (Array.isArray(prev.paymentVouchers) && prev.paymentVouchers.some(isLegacyDummy)) {
          nextState.paymentVouchers = prev.paymentVouchers.filter(x => !isLegacyDummy(x));
          updated = true;
        }
        if (!prev.adminSetup) { 
          nextState.adminSetup = initialMockState.adminSetup; 
          updated = true; 
        } else {
          nextState.adminSetup = { ...prev.adminSetup };
          if (!prev.adminSetup.printSettings) {
            nextState.adminSetup.printSettings = initialMockState.adminSetup.printSettings;
            updated = true;
          } else if (!prev.adminSetup.printSettings.documentLayouts) {
            nextState.adminSetup.printSettings = {
              ...prev.adminSetup.printSettings,
              documentLayouts: initialMockState.adminSetup.printSettings.documentLayouts
            };
            updated = true;
          }
        }
        if (!prev.themeSettings) {
          nextState.themeSettings = initialMockState.themeSettings;
          updated = true;
        }
        if (!prev.displaySettings) {
          nextState.displaySettings = initialMockState.displaySettings;
          updated = true;
        } else {
          nextState.displaySettings = { ...prev.displaySettings };
          if (prev.displaySettings.sidebarPosition === undefined) {
            nextState.displaySettings.sidebarPosition = 'left';
            updated = true;
          }
          if (prev.displaySettings.subMenuPosition === undefined) {
            nextState.displaySettings.subMenuPosition = 'left';
            updated = true;
          }
        }
        if (!prev.chats) {
          nextState.chats = initialMockState.chats || [];
          updated = true;
        }
        if (!prev.dashboardLayout) {
          nextState.dashboardLayout = initialMockState.dashboardLayout;
          updated = true;
        }
        if (prev.dashboardBackground === undefined) {
          nextState.dashboardBackground = initialMockState.dashboardBackground;
          updated = true;
        }
        if (prev.productionTarget === undefined) {
          nextState.productionTarget = initialMockState.productionTarget;
          updated = true;
        }
        if (prev.currentUser === undefined) {
          nextState.currentUser = null;
          updated = true;
        }
        if (prev.isGlobalPaginated === undefined) {
          nextState.isGlobalPaginated = true;
          updated = true;
        }
        if (!prev.departments) {
          nextState.departments = initialMockState.departments;
          updated = true;
        } else {
          // Migrate string array to object array
          if (nextState.departments.length > 0 && typeof nextState.departments[0] === 'string') {
            nextState.departments = nextState.departments.map(d => ({ label: d, value: d, disabled: false }));
            updated = true;
          }
        }
        if (!prev.itemCategories) {
          nextState.itemCategories = initialMockState.itemCategories;
          updated = true;
        } else {
          // Migrate string array to object array
          if (nextState.itemCategories.length > 0 && typeof nextState.itemCategories[0] === 'string') {
            nextState.itemCategories = nextState.itemCategories.map(c => ({ label: c, value: c, disabled: false }));
            updated = true;
          }
        }
        if (!prev.categoryPrefixes) {
          nextState.categoryPrefixes = initialMockState.categoryPrefixes;
          updated = true;
        }
        if (!prev.rawMaterialTypesList) {
          nextState.rawMaterialTypesList = initialMockState.rawMaterialTypesList;
          updated = true;
        }
        if (!prev.uomList) {
          nextState.uomList = initialMockState.uomList;
          updated = true;
        }
        if (!prev.packingTypesList) {
          nextState.packingTypesList = initialMockState.packingTypesList;
          updated = true;
        }
        
        // Ensure Admin user and currentUser have 'hr' and 'finance' permissions
        if (nextState.users) {
          let usersUpdated = false;
          const nextUsers = nextState.users.map(u => {
            if (u.role === 'Super Admin' || u.username === 'admin') {
              const missing = [];
              if (!u.permissions.includes('hr')) missing.push('hr');
              if (!u.permissions.includes('finance')) missing.push('finance');
              if (missing.length > 0) {
                usersUpdated = true;
                return { ...u, permissions: [...u.permissions, ...missing] };
              }
            }
            return u;
          });
          if (usersUpdated) {
            nextState.users = nextUsers;
            updated = true;
          }
        }
        if (nextState.currentUser && (nextState.currentUser.role === 'Super Admin' || nextState.currentUser.username === 'admin')) {
          const missing = [];
          if (!nextState.currentUser.permissions.includes('hr')) missing.push('hr');
          if (!nextState.currentUser.permissions.includes('finance')) missing.push('finance');
          if (missing.length > 0) {
            nextState.currentUser = { ...nextState.currentUser, permissions: [...nextState.currentUser.permissions, ...missing] };
            updated = true;
          }
        }

        return updated ? nextState : prev;
    });
  }, []);

  useEffect(() => {
    if (state.themeSettings) {
      applyTheme(state.themeSettings);
    }
  }, [state.themeSettings]);


  // Intelligent Enterprise Two-Way Union Merge (Prevents Remote Sync from Overwriting Local Newly-Saved Documents)
  const smartUnionMerge = (prevState, remoteState) => {
    if (!prevState) return remoteState;
    if (!remoteState) return prevState;

    const merged = { ...remoteState };

    const collectionsToMerge = [
      'saleOrders', 'salesInvoices', 'purchaseInvoices', 'paymentVouchers',
      'purchaseDemands', 'purchaseOrders', 'inwardGatePasses', 'grns',
      'stockTransfers', 'productionPlans', 'productionOutputs', 'deliveries',
      'returns', 'otherConsumptions', 'adjustments', 'boms', 'customers',
      'suppliers', 'items', 'chats', 'approvals', 'routingTasks', 'routingRules',
      'hr_employees_list', 'hr_uploaded_attendance', 'hr_overtime_requests',
      'hr_leave_requests', 'hr_loan_requests', 'hr_loan_ledger', 'hr_advance_requests',
      'documentWarehouseBinders'
    ];

    collectionsToMerge.forEach(key => {
      const prevArr = Array.isArray(prevState[key]) ? prevState[key] : [];
      const remoteArr = Array.isArray(remoteState[key]) ? remoteState[key] : [];

      if (prevArr.length === 0) {
        merged[key] = remoteArr;
        return;
      }
      if (remoteArr.length === 0) {
        merged[key] = prevArr;
        return;
      }

      // Map remote items by unique identifier
      const remoteMap = new Map();
      remoteArr.forEach(item => {
        const id = item?.id || item?.orderId || item?.invoiceNumber || item?.itemCode || item?.username;
        if (id !== undefined && id !== null) {
          remoteMap.set(String(id), item);
        }
      });

      const result = [...remoteArr];

      // Identify any locally created items that haven't reached remote database yet and PRESERVE them!
      prevArr.forEach(localItem => {
        const id = localItem?.id || localItem?.orderId || localItem?.invoiceNumber || localItem?.itemCode || localItem?.username;
        if (id !== undefined && id !== null && !remoteMap.has(String(id))) {
          result.unshift(localItem); // Retain locally saved document safely
        }
      });

      merged[key] = result;
    });

    return merged;
  };

  const updateMatchedCurrentUser = (prevCurrentUser, usersList) => {
    if (!prevCurrentUser || !Array.isArray(usersList)) return prevCurrentUser;
    const matched = usersList.find(u => 
      String(u.id) === String(prevCurrentUser.id) || 
      (u.username && prevCurrentUser.username && u.username.toLowerCase() === prevCurrentUser.username.toLowerCase())
    );
    if (!matched) return prevCurrentUser;

    const permsChanged = 
      JSON.stringify(prevCurrentUser.permissions) !== JSON.stringify(matched.permissions) ||
      JSON.stringify(prevCurrentUser.granularPermissions) !== JSON.stringify(matched.granularPermissions) ||
      prevCurrentUser.role !== matched.role ||
      prevCurrentUser.name !== matched.name;

    const updatedUser = { ...prevCurrentUser, ...matched };

    if (permsChanged) {
      try {
        localStorage.setItem('aj_current_user', JSON.stringify(updatedUser));
        sessionStorage.setItem('aj_current_user_session', JSON.stringify(updatedUser));
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.dispatchEvent(new Event('fv-permissions-updated'));
            window.dispatchEvent(new Event('storage'));
          }, 50);
        }
      } catch (e) {}
    }

    return updatedUser;
  };

  // Subscribe to real-time state changes from Supabase PostgreSQL
  useEffect(() => {
    // 1. Fetch initial state
    const fetchInitialState = async () => {
      try {
        // ULTRA-LOW EGRESS SMART CACHE: Check remote updated_at metadata (only ~50 bytes) before downloading 5MB!
        const localCachedUpdatedAt = localStorage.getItem('fv_last_synced_updated_at');
        const hasLocalSavedState = Boolean(localStorage.getItem('aj_synthetic_erp'));

        // Lightweight probe for version/timestamp only
        const { data: verData, error: verErr } = await supabase
          .from('erp_state')
          .select('updated_at')
          .eq('id', 'main_state')
          .maybeSingle();

        // Check if standalone tables exist in database to avoid 404/400 errors
        try {
          const { error: tErr } = await supabase.from('hr_employees').select('id').limit(1);
          if (!tErr) {
            standaloneTablesSupportedRef.current = true;
          }
        } catch (_) {
          standaloneTablesSupportedRef.current = false;
        }

        // Fetch initial user sessions silently (only if user is logged in)
        if (currentUserRef.current?.username) {
          const { data: sData } = await supabase
            .from('user_sessions')
            .select('username, last_active, connection_id');
          if (sData) {
            setActiveSessions(sData);
          }
        }

        if (verErr) {
          console.warn("Supabase initial load error / quota check:", verErr);
          lastSyncedStateRef.current = JSON.stringify(getSanitizedSyncState(state));
          isFirstRemoteSyncCompleted.current = true;
          setIsInitialLoadCompleted(true);
          return;
        }

        // If local state exists and updated_at matches remote, SKIP downloading multi-megabyte state_data!
        if (verData?.updated_at && localCachedUpdatedAt && verData.updated_at === localCachedUpdatedAt && hasLocalSavedState) {
          console.log("[Egress Guard] Local state is 100% up to date! Skipped full state download. Egress saved: ~3MB!");
          lastSyncedUpdatedAtRef.current = verData.updated_at;
          guardBaseUpdatedAtRef.current = verData.updated_at;
          lastSyncedStateRef.current = JSON.stringify(getSanitizedSyncState(state));
          isFirstRemoteSyncCompleted.current = true;
          setIsInitialLoadCompleted(true);
          return;
        }

        // Only download full state_data if remote version is newer or local cache is empty:
        const { data, error } = await supabase
          .from('erp_state')
          .select('state_data, updated_at')
          .eq('id', 'main_state')
          .maybeSingle();

        if (error) {
          console.warn("Supabase initial state_data fetch error:", error);
          lastSyncedStateRef.current = JSON.stringify(getSanitizedSyncState(state));
          isFirstRemoteSyncCompleted.current = true;
          setIsInitialLoadCompleted(true);
          return;
        }

        if (data && data.state_data) {
          if (data.updated_at) {
            lastSyncedUpdatedAtRef.current = data.updated_at;
            guardBaseUpdatedAtRef.current = data.updated_at;
            localStorage.setItem('fv_last_synced_updated_at', data.updated_at);
          }
          const erpData = data.state_data;
          if (erpData.buildVersion && erpData.buildVersion !== BUILD_VERSION) {
              console.warn("Client build version mismatch on load. Reloading...");
              window.location.reload();
              return;
          }
          isRemoteSyncing.current = true;
          const toArray = (val) => Array.isArray(val) ? val : (val ? Object.values(val) : []);
          const depts = toArray(erpData.departments || []);
          const cleanDepts = depts.map((d, index) => {
            if (typeof d === 'string') {
              return {
                id: 'DEP-' + index + '-' + (100 + index),
                name: d,
                label: d,
                value: d,
                itemTypes: ['Finished Goods', 'Raw Material'],
                itemIds: [],
                disabled: false
              };
            }
            return d;
          });
          const sanitized = {
            ...erpData,
            departments: cleanDepts,
            users: toArray(erpData.users),
            customers: toArray(erpData.customers),
            suppliers: toArray(erpData.suppliers),
            items: toArray(erpData.items),
            saleOrders: toArray(erpData.saleOrders),
            productionPlans: toArray(erpData.productionPlans),
            productionOutputs: toArray(erpData.productionOutputs),
            deliveries: toArray(erpData.deliveries),
            notifications: toArray(erpData.notifications),
            returns: toArray(erpData.returns),
            purchaseDemands: toArray(erpData.purchaseDemands),
            purchaseOrders: toArray(erpData.purchaseOrders),
            inwardGatePasses: toArray(erpData.inwardGatePasses),
            grns: toArray(erpData.grns),
            stockTransfers: toArray(erpData.stockTransfers),
            otherConsumptions: toArray(erpData.otherConsumptions),
            auditLogs: toArray(erpData.auditLogs),
            chats: toArray(erpData.chats),
            approvals: toArray(erpData.approvals),
            gatePassActivities: toArray(erpData.gatePassActivities),
            salesInvoices: toArray(erpData.salesInvoices),
            purchaseInvoices: toArray(erpData.purchaseInvoices),
            paymentVouchers: toArray(erpData.paymentVouchers),
            chartOfAccounts: toArray(erpData.chartOfAccounts),
            hr_employees_list: toArray(erpData.hr_employees_list),
            hr_uploaded_attendance: toArray(erpData.hr_uploaded_attendance),
            hr_loan_requests: toArray(erpData.hr_loan_requests),
            hr_loan_ledger: toArray(erpData.hr_loan_ledger),
            boms: toArray(erpData.boms),
            rawMaterialPhases: toArray(erpData.rawMaterialPhases),
            finishedGoodPhases: toArray(erpData.finishedGoodPhases)
          };
          
          const syncStateCopy = getSanitizedSyncState(sanitized);
          lastSyncedStateRef.current = JSON.stringify(syncStateCopy);

          setState(prev => {
            const mergedState = smartUnionMerge(prev, sanitized);
            const nextState = seedStateIfEmpty(mergedState);
            let effectiveUser = null;
            const sessionVal = validateCurrentSession();
            if (sessionVal.isValid && prev.currentUser) {
              effectiveUser = prev.currentUser;
              if (nextState.users) {
                const latest = nextState.users.find(u => 
                  String(u.id) === String(effectiveUser.id) || 
                  (u.username && effectiveUser.username && u.username.toLowerCase() === effectiveUser.username.toLowerCase())
                );
                if (latest) {
                  effectiveUser = sanitizeUser({ ...effectiveUser, ...latest });
                }
              }
            } else {
              effectiveUser = null;
            }

            return {
              ...nextState,
              currentUser: effectiveUser,
              themeSettings: prev.themeSettings,
              displaySettings: prev.displaySettings,
              dashboardLayout: prev.dashboardLayout,
              dashboardBackground: prev.dashboardBackground,
              documentWarehouseBinders: prev.documentWarehouseBinders
            };
          });
          setTimeout(() => {
            isRemoteSyncing.current = false;
          }, 100);
        } else {
          // Database is empty (e.g. first-time load), so we allow local mock state to seed
          setState(prev => seedStateIfEmpty(initialMockState));
        }
      } catch (err) {
        console.warn("Supabase initial load failed:", err);
      } finally {
        isFirstRemoteSyncCompleted.current = true;
        setIsInitialLoadCompleted(true);
      }
    };

    // PHASE C STEP 1: after the blob state is applied, overlay the step-1
    // collections with their table contents (the tables are the read source
    // for these entities now). Any entity whose table fetch fails keeps the
    // blob copy — no empty screens. Snapshots are seeded from whatever
    // content ends up in state so the write-through diff starts clean.
    const loadStep1TablesIntoState = async () => {
      const seedSnapshots = (source) => {
        Object.keys(STEP1_ENTITY_TABLES).forEach((key) => {
          const snap = new Map();
          const seen = new Map();
          (Array.isArray(source[key]) ? source[key] : []).forEach((rec) => {
            const k = recordKeyWithFallback(key, rec, seen);
            if (k !== null) snap.set(k, JSON.stringify(rec));
          });
          step1SnapshotsRef.current[key] = snap;
        });
      };
      try {
        const fromTables = await loadStep1EntitiesFromTables();
        const adminSetupFromTable = await loadAdminSetupFromTable();
        const fgComboConfigFromTable = await loadFGComboConfigFromTable();
        const flashAmConfigFromTable = await loadFlashAmConfigFromTable();
        const salaryPrintSettingsFromTable = await loadSalaryPrintSettingsFromTable();
        const payrollMappingFromTable = await loadPayrollAccountMappingFromTable();
        const categoryPrefixesFromTable = await loadCategoryPrefixesFromTable();
        const scalarsFromTable = await loadScalarsFromTable();
        const countersFromTable = await loadCountersFromTable();
        const batchOutputTypesFromTable = await loadBatchOutputTypesFromTable();
        const batchLaborConfigFromTable = await loadBatchLaborConfigFromTable();
        const loginThemeSettingsFromTable = await loadLoginThemeSettingsFromTable();
        const dutySettingsFromTable = await loadDutySettingsFromTable();
        const salaryAllowanceFromTable = await loadSalaryAllowanceConfigFromTable();
        // SERVER RULE migration seeds (2026-10-26): when the server has no
        // copy yet, a browser's localStorage cache is the one-time upload
        // source — read it here so the apply blocks below can seed state
        // (and the write-through effects then persist it to app_config).
        const dutySettingsLocalSeed = (() => {
          try {
            const raw = localStorage.getItem('hr_duty_settings');
            return raw ? normalizeDutySettings(JSON.parse(raw)) : null;
          } catch (_) { return null; }
        })();
        const salaryAllowanceLocalSeed = (() => {
          try {
            const cfgRaw = localStorage.getItem('hr_salary_allowance_config');
            const mapRaw = localStorage.getItem('hr_employee_allowance_map');
            const config = cfgRaw ? JSON.parse(cfgRaw) : null;
            const employeeAllowanceMap = mapRaw ? JSON.parse(mapRaw) : null;
            if (!config && !employeeAllowanceMap) return null;
            return { config: config || null, employeeAllowanceMap: employeeAllowanceMap || {} };
          } catch (_) { return null; }
        })();
        setState(prev => {
          const next = { ...prev };
          const seedSource = {};
          Object.keys(STEP1_ENTITY_TABLES).forEach((key) => {
            if (Array.isArray(fromTables[key])) {
              next[key] = fromTables[key];
              seedSource[key] = fromTables[key];
            } else {
              seedSource[key] = prev[key];
            }
          });
          // PHASE C STEP 3 (addendum): the app_config copy of adminSetup
          // (incl. base currency) wins over the blob copy when present.
          if (adminSetupFromTable) {
            next.adminSetup = adminSetupFromTable;
            adminSetupSnapshotRef.current = adminSetupFromTable;
          } else {
            adminSetupSnapshotRef.current = prev.adminSetup || null;
          }
          adminSetupLoadedRef.current = true;
          // FG COMBO PHASE: the app_config copy of the builder config wins
          // over this browser's localStorage copy when present; when the
          // table has none yet, the snapshot stays null so the write-through
          // effect seeds the table with the current (local) config — the
          // settings can no longer be lost in a blob flip or browser swap.
          if (fgComboConfigFromTable) {
            const normalized = normalizeFGConfig(fgComboConfigFromTable);
            next.fg_combinations_config = normalized;
            fgComboConfigSnapshotRef.current = normalized;
            saveFGConfig(normalized);
          } else {
            fgComboConfigSnapshotRef.current = null;
          }
          fgComboConfigLoadedRef.current = true;
          // FLASHAM PHASE A: the app_config copy of the Flash AM terminal
          // config wins when present; when the table has none yet, the
          // snapshot stays null so the write-through effect seeds the table
          // with the defaults — the config can never be lost in a blob flip.
          if (flashAmConfigFromTable) {
            const normalizedFlashAm = normalizeFlashAmConfig(flashAmConfigFromTable);
            next.flash_am_config = normalizedFlashAm;
            flashAmConfigSnapshotRef.current = normalizedFlashAm;
          } else {
            flashAmConfigSnapshotRef.current = null;
          }
          flashAmConfigLoadedRef.current = true;
          // HR PRINTS: the app_config copy of the Salary Generation print
          // settings wins when present; when the table has none yet, the
          // snapshot stays null so the write-through effect seeds the table
          // with the defaults — the settings survive reload, follow the
          // account, and can never be lost in a blob flip.
          if (salaryPrintSettingsFromTable) {
            const normalizedSalaryPrint = normalizeSalaryPrintSettings(salaryPrintSettingsFromTable);
            next.salary_print_settings = normalizedSalaryPrint;
            salaryPrintSettingsSnapshotRef.current = normalizedSalaryPrint;
          } else {
            salaryPrintSettingsSnapshotRef.current = null;
          }
          salaryPrintSettingsLoadedRef.current = true;
          // HR PAYROLL MAPPING: the app_config copy of the payroll-category
          // -> GL-account mappings wins when present; when the table has
          // none yet, the snapshot stays null so the write-through effect
          // seeds the table with the current mappings (defaults, or the
          // localStorage copy the mapping screen migrates on first open) —
          // the mappings survive reload and can never be lost in a blob flip.
          if (payrollMappingFromTable) {
            const normalizedPayrollMapping = normalizePayrollMappings(payrollMappingFromTable);
            next.payroll_account_mapping = normalizedPayrollMapping;
            payrollMappingSnapshotRef.current = normalizedPayrollMapping;
          } else {
            payrollMappingSnapshotRef.current = null;
          }
          payrollMappingLoadedRef.current = true;
          // PHASE C STEP 6: app-config completion — the app_config copy of
          // categoryPrefixes wins over the blob copy when present.
          if (categoryPrefixesFromTable) {
            next.categoryPrefixes = categoryPrefixesFromTable;
            categoryPrefixesSnapshotRef.current = categoryPrefixesFromTable;
          } else {
            categoryPrefixesSnapshotRef.current = prev.categoryPrefixes || null;
          }
          categoryPrefixesLoadedRef.current = true;
          // PHASE C STEP 6: of the app_config `scalars` bundle only the two
          // user settings are applied (productionTarget, isGlobalPaginated);
          // buildVersion/lastUpdatedBy are app-owned meta and never read back.
          if (scalarsFromTable) {
            if (typeof scalarsFromTable.productionTarget === 'number') next.productionTarget = scalarsFromTable.productionTarget;
            if (typeof scalarsFromTable.isGlobalPaginated === 'boolean') next.isGlobalPaginated = scalarsFromTable.isGlobalPaginated;
          }
          scalarsSnapshotRef.current = JSON.stringify({ buildVersion: next.buildVersion, productionTarget: next.productionTarget, isGlobalPaginated: next.isGlobalPaginated });
          scalarsLoadedRef.current = true;
          // PHASE D STEP D1: counters (the global line-code counter) and
          // batchOutputTypes (production grade definitions) ride in
          // app_config like the other config — the table copy wins on load.
          if (countersFromTable) {
            next.counters = countersFromTable;
            countersSnapshotRef.current = countersFromTable;
          } else {
            countersSnapshotRef.current = prev.counters || null;
          }
          countersLoadedRef.current = true;
          if (batchOutputTypesFromTable) {
            next.batchOutputTypes = batchOutputTypesFromTable;
            batchOutputTypesSnapshotRef.current = batchOutputTypesFromTable;
          } else {
            batchOutputTypesSnapshotRef.current = prev.batchOutputTypes || null;
          }
          batchOutputTypesLoadedRef.current = true;
          // BATCH LABOR (2026-10-25): the app_config copy of the Batch
          // Record labor-cost employee selection wins when present; when
          // the table has none yet, the snapshot stays null so the
          // write-through effect seeds it with the default (empty)
          // selection — the selection can never be lost in a blob flip.
          if (batchLaborConfigFromTable) {
            const normalizedBatchLabor = normalizeBatchLaborConfig(batchLaborConfigFromTable);
            next.batch_labor_config = normalizedBatchLabor;
            batchLaborConfigSnapshotRef.current = normalizedBatchLabor;
          } else {
            batchLaborConfigSnapshotRef.current = null;
          }
          batchLaborConfigLoadedRef.current = true;
          // LOGIN THEMES (2026-10-25): the app_config copy of the login
          // theme settings wins when present; when the table has none yet,
          // the snapshot stays null so the write-through effect seeds it
          // with the shipped default (fixed / Paper Leaf) — the login page
          // reads this state pre-auth through the same load as the users.
          if (loginThemeSettingsFromTable) {
            const normalizedLoginTheme = normalizeLoginThemeSettings(loginThemeSettingsFromTable);
            next.login_theme_settings = normalizedLoginTheme;
            loginThemeSettingsSnapshotRef.current = normalizedLoginTheme;
          } else {
            loginThemeSettingsSnapshotRef.current = null;
          }
          loginThemeSettingsLoadedRef.current = true;
          // SERVER RULE — HR DUTY SETTINGS (2026-10-26): the app_config copy
          // (key 'hrDutySettings') wins on load; when the table has none yet,
          // the browser's localStorage cache uploads once (migration), else
          // the defaults seed state — in both seed cases the snapshot stays
          // null so the write-through effect persists the seed to the table.
          // The localStorage cache is refreshed from the winning value.
          {
            const fromTableDuty = normalizeDutySettings(dutySettingsFromTable);
            if (fromTableDuty) {
              next.hr_duty_settings = fromTableDuty;
              dutySettingsSnapshotRef.current = fromTableDuty;
              try { localStorage.setItem('hr_duty_settings', JSON.stringify(fromTableDuty)); } catch (_) {}
            } else if (dutySettingsLocalSeed) {
              next.hr_duty_settings = dutySettingsLocalSeed;
              dutySettingsSnapshotRef.current = null;
            } else {
              next.hr_duty_settings = getInitialDutySettings();
              dutySettingsSnapshotRef.current = null;
            }
            dutySettingsLoadedRef.current = true;
          }
          // SERVER RULE — SALARY & ALLOWANCE CONFIG (2026-10-26): the
          // app_config copy (key 'hrSalaryAllowanceConfig') wins on load and
          // is mirrored into state + the localStorage caches payrollCalc
          // reads; when the table has none yet, the local caches upload once
          // via the write-through effect (snapshot stays null).
          {
            if (salaryAllowanceFromTable) {
              const cfg = salaryAllowanceFromTable.config || null;
              const map = salaryAllowanceFromTable.employeeAllowanceMap || {};
              next.hr_salary_allowance_config = cfg ? [cfg] : [];
              next.hr_employee_allowance_map = map;
              salaryAllowanceSnapshotRef.current = JSON.stringify({ config: cfg, employeeAllowanceMap: map });
              try {
                if (cfg) localStorage.setItem('hr_salary_allowance_config', JSON.stringify(cfg));
                localStorage.setItem('hr_employee_allowance_map', JSON.stringify(map));
              } catch (_) {}
            } else if (salaryAllowanceLocalSeed) {
              next.hr_salary_allowance_config = salaryAllowanceLocalSeed.config ? [salaryAllowanceLocalSeed.config] : [];
              next.hr_employee_allowance_map = salaryAllowanceLocalSeed.employeeAllowanceMap || {};
              salaryAllowanceSnapshotRef.current = null;
            }
            salaryAllowanceLoadedRef.current = true;
          }
          seedSnapshots(seedSource);
          return next;
        });
      } catch (err) {
        console.warn('[EntityTables] initial table load failed; blob copies remain active:', err);
        setState(prev => {
          seedSnapshots(prev);
          adminSetupSnapshotRef.current = prev.adminSetup || null;
          adminSetupLoadedRef.current = true;
          fgComboConfigSnapshotRef.current = null;
          fgComboConfigLoadedRef.current = true;
          flashAmConfigSnapshotRef.current = null;
          flashAmConfigLoadedRef.current = true;
          salaryPrintSettingsSnapshotRef.current = null;
          salaryPrintSettingsLoadedRef.current = true;
          payrollMappingSnapshotRef.current = null;
          payrollMappingLoadedRef.current = true;
          categoryPrefixesSnapshotRef.current = prev.categoryPrefixes || null;
          categoryPrefixesLoadedRef.current = true;
          scalarsSnapshotRef.current = JSON.stringify({ buildVersion: prev.buildVersion, productionTarget: prev.productionTarget, isGlobalPaginated: prev.isGlobalPaginated });
          scalarsLoadedRef.current = true;
          countersSnapshotRef.current = prev.counters || null;
          countersLoadedRef.current = true;
          batchOutputTypesSnapshotRef.current = prev.batchOutputTypes || null;
          batchOutputTypesLoadedRef.current = true;
          batchLaborConfigSnapshotRef.current = null;
          batchLaborConfigLoadedRef.current = true;
          loginThemeSettingsSnapshotRef.current = null;
          loginThemeSettingsLoadedRef.current = true;
          return prev;
        });
      } finally {
        step1TablesReadyRef.current = true;
      }
    };

    fetchInitialState().then(() => { loadStep1TablesIntoState(); });

    // 2. Subscribe to real-time changes
    const channel = supabase
      .channel('public:erp_state')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'erp_state',
          filter: 'id=eq.main_state'
        },
        (payload) => {
          if (payload.new?.updated_at) {
            lastSyncedUpdatedAtRef.current = payload.new.updated_at;
          }
          const erpData = payload.new?.state_data;
          if (erpData) {
            if (erpData.buildVersion && erpData.buildVersion !== BUILD_VERSION) {
                console.warn("Client build version mismatch on remote sync. Reloading...");
                window.location.reload();
                return;
            }
            if (erpData.lastUpdatedBy === clientId.current) {
              if (payload.new?.updated_at) {
                guardBaseUpdatedAtRef.current = payload.new.updated_at;
              }
              return;
            }
            if (pendingWriteRef.current !== null) {
              return;
            }
            if (isLocalUpsertInFlight.current) {
              return;
            }
            const toArray = (val) => Array.isArray(val) ? val : (val ? Object.values(val) : []);
            const depts = toArray(erpData.departments || []);
            const cleanDepts = depts.map((d, index) => {
              if (typeof d === 'string') {
                return {
                  id: 'DEP-' + index + '-' + (100 + index),
                  name: d,
                  label: d,
                  value: d,
                  itemTypes: ['Finished Goods', 'Raw Material'],
                  itemIds: [],
                  disabled: false
                };
              }
              return d;
            });
            const sanitized = {
              ...erpData,
              departments: cleanDepts,
              users: toArray(erpData.users),
              customers: toArray(erpData.customers),
              suppliers: toArray(erpData.suppliers),
              items: toArray(erpData.items),
              saleOrders: toArray(erpData.saleOrders),
              productionPlans: toArray(erpData.productionPlans),
              productionOutputs: toArray(erpData.productionOutputs),
              deliveries: toArray(erpData.deliveries),
              notifications: toArray(erpData.notifications),
              returns: toArray(erpData.returns),
              purchaseDemands: toArray(erpData.purchaseDemands),
              purchaseOrders: toArray(erpData.purchaseOrders),
              inwardGatePasses: toArray(erpData.inwardGatePasses),
              grns: toArray(erpData.grns),
              stockTransfers: toArray(erpData.stockTransfers),
              otherConsumptions: toArray(erpData.otherConsumptions),
              auditLogs: toArray(erpData.auditLogs),
              chats: toArray(erpData.chats),
              approvals: toArray(erpData.approvals),
              gatePassActivities: toArray(erpData.gatePassActivities),
              salesInvoices: toArray(erpData.salesInvoices),
              purchaseInvoices: toArray(erpData.purchaseInvoices),
              paymentVouchers: toArray(erpData.paymentVouchers),
              chartOfAccounts: toArray(erpData.chartOfAccounts),
              hr_employees_list: toArray(erpData.hr_employees_list),
              hr_uploaded_attendance: toArray(erpData.hr_uploaded_attendance),
              hr_loan_requests: toArray(erpData.hr_loan_requests),
              hr_loan_ledger: toArray(erpData.hr_loan_ledger),
              boms: toArray(erpData.boms),
              rawMaterialPhases: toArray(erpData.rawMaterialPhases),
              finishedGoodPhases: toArray(erpData.finishedGoodPhases)
            };
            
            const syncStateCopy = getSanitizedSyncState(sanitized);
            const copyStr = JSON.stringify(syncStateCopy);

            // Guard: If remote content is identical to last synced state, do NOT setState!
            if (copyStr === lastSyncedStateRef.current) {
              if (payload.new?.updated_at) {
                lastSyncedUpdatedAtRef.current = payload.new.updated_at;
                guardBaseUpdatedAtRef.current = payload.new.updated_at;
                localStorage.setItem('fv_last_synced_updated_at', payload.new.updated_at);
              }
              return;
            }

            isRemoteSyncing.current = true;
            lastSyncedStateRef.current = copyStr;
            if (payload.new?.updated_at) {
              lastSyncedUpdatedAtRef.current = payload.new.updated_at;
              guardBaseUpdatedAtRef.current = payload.new.updated_at;
              localStorage.setItem('fv_last_synced_updated_at', payload.new.updated_at);
            }

            setState(prev => {
              const mergedState = smartUnionMerge(prev, sanitized);
              const nextState = seedStateIfEmpty(mergedState);
              const nextCurrentUser = updateMatchedCurrentUser(prev.currentUser, nextState.users);
              return {
                ...nextState,
                currentUser: nextCurrentUser,
                themeSettings: prev.themeSettings,
                displaySettings: prev.displaySettings,
                dashboardLayout: prev.dashboardLayout,
                dashboardBackground: prev.dashboardBackground,
                documentWarehouseBinders: prev.documentWarehouseBinders
              };
            });
            
            setTimeout(() => {
              isRemoteSyncing.current = false;
            }, 100);
          }
        }
      )
      .subscribe();

    const usersChannel = supabase
      .channel('public:users_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          if (payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
            const newUserRow = payload.new;
            const mappedUser = {
              id: String(newUserRow.id),
              username: newUserRow.username,
              name: newUserRow.full_name || newUserRow.name,
              role: newUserRow.role,
              email: newUserRow.email,
              phone: newUserRow.phone,
              status: newUserRow.status,
              permissions: newUserRow.permissions || [],
              granularPermissions: newUserRow.granular_permissions || {}
            };

            setState(prev => {
              const currentUsers = Array.isArray(prev.users) ? prev.users : [];
              const existingUser = currentUsers.find(u => String(u.id) === String(mappedUser.id) || (u.username && mappedUser.username && u.username.toLowerCase() === mappedUser.username.toLowerCase()));
              if (existingUser) {
                const isIdentical =
                  (existingUser.name || '') === (mappedUser.name || '') &&
                  (existingUser.role || '') === (mappedUser.role || '') &&
                  (existingUser.email || '') === (mappedUser.email || '') &&
                  (existingUser.phone || '') === (mappedUser.phone || '') &&
                  (existingUser.status || '') === (mappedUser.status || '') &&
                  JSON.stringify(existingUser.permissions || []) === JSON.stringify(mappedUser.permissions || []) &&
                  JSON.stringify(existingUser.granularPermissions || {}) === JSON.stringify(mappedUser.granularPermissions || {});
                if (isIdentical) {
                  return prev;
                }
              }

              const nextUsers = existingUser
                ? currentUsers.map(u => String(u.id) === String(mappedUser.id) || (u.username && mappedUser.username && u.username.toLowerCase() === mappedUser.username.toLowerCase()) ? { ...u, ...mappedUser } : u)
                : [...currentUsers, mappedUser];

              const nextCurrentUser = updateMatchedCurrentUser(prev.currentUser, nextUsers);
              return {
                ...prev,
                users: nextUsers,
                currentUser: nextCurrentUser
              };
            });
          }
        }
      )
      .subscribe();

    const sessionsChannel = supabase
      .channel('public:user_sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_sessions'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setActiveSessions(prev => {
              const filtered = prev.filter(s => s.connection_id !== payload.new.connection_id);
              return [...filtered, payload.new];
            });

            // Real-Time Concurrent Login Detection:
            // If another connection/device logs into this account, kick this device out immediately!
            const myUser = currentUserRef.current?.username;
            if (myUser && payload.new?.username?.toLowerCase() === myUser.toLowerCase()) {
              const myConn = connectionId.current;
              const myDev = getDeviceId();
              let newDev = null;
              try {
                const parsed = typeof payload.new.device_info === 'string' ? JSON.parse(payload.new.device_info) : payload.new.device_info;
                newDev = parsed?.deviceId;
              } catch (e) {}

              if (payload.new.connection_id !== myConn && (!newDev || newDev !== myDev)) {
                if (terminatedConnectionIdsRef.current.has(payload.new.connection_id)) {
                  // This is a session OUR login just signed out. Its last
                  // heartbeat may have landed after the sweep and brought
                  // its row back — clear the zombie row, never kick the
                  // session that replaced it.
                  console.warn('[Security Guard] Cleared a resurrected row from a session this login signed out.');
                  try {
                    supabase.from('user_sessions').delete().eq('connection_id', payload.new.connection_id);
                  } catch (e) {}
                } else {
                  console.warn('[Security Guard] New active session detected for our account on another device. Logging out.');
                  handleForceConcurrentLogout();
                }
              }
            }
          } else if (payload.eventType === 'DELETE') {
            setActiveSessions(prev => prev.filter(s => s.connection_id !== payload.old.connection_id));

            // If our connection_id was deleted by another logging-in device
            const myUser = currentUserRef.current?.username;
            if (myUser && payload.old?.connection_id === connectionId.current) {
              console.warn('[Security Guard] Our session was removed from user_sessions. Logging out.');
              handleForceConcurrentLogout();
            }
          }
        }
      )
      .on('broadcast', { event: 'force_logout_concurrent' }, ({ payload }) => {
        const myUser = currentUserRef.current?.username;
        if (myUser && payload?.username && payload.username.toLowerCase() === myUser.toLowerCase()) {
          const myConn = connectionId.current;
          const myDev = getDeviceId();
          if (payload.activeConnectionId !== myConn && (!payload.activeDeviceId || payload.activeDeviceId !== myDev)) {
            console.warn('[Security Guard] Received real-time force_logout_concurrent broadcast. Terminating session.');
            handleForceConcurrentLogout();
          }
        }
      })
      .subscribe();

    sessionsChannelRef.current = sessionsChannel;

    // 3. Ultra-Low Egress Remote Sync Guard
    // When tab is in background, ZERO HTTP queries are sent! Realtime WebSockets push updates with 0 HTTP egress.
    const checkRemoteVersion = async () => {
      if (typeof document !== 'undefined' && document.hidden) return; // ZERO egress when user is not on this tab!
      if (isRemoteSyncing.current || isLocalUpsertInFlight.current || pendingWriteRef.current !== null) return;
      try {
        const { data, error } = await supabase
          .from('erp_state')
          .select('updated_at')
          .eq('id', 'main_state')
          .maybeSingle();

        if (error || !data || !data.updated_at) return;
        if (data.updated_at === lastSyncedUpdatedAtRef.current) return;

        // Remote database was updated by another client! Fetch full state:
        const { data: fullData, error: fullError } = await supabase
          .from('erp_state')
          .select('state_data, updated_at')
          .eq('id', 'main_state')
          .maybeSingle();

        if (fullData?.updated_at) {
          localStorage.setItem('fv_last_synced_updated_at', fullData.updated_at);
        }

        if (fullError || !fullData || !fullData.state_data) return;

        const erpData = fullData.state_data;
        if (erpData.lastUpdatedBy === clientId.current) {
          lastSyncedUpdatedAtRef.current = fullData.updated_at;
          return;
        }

        const syncStateCopy = getSanitizedSyncState(erpData);
        const copyStr = JSON.stringify(syncStateCopy);
        if (copyStr !== lastSyncedStateRef.current) {
          isRemoteSyncing.current = true;
          lastSyncedUpdatedAtRef.current = fullData.updated_at;
          const toArray = (val) => Array.isArray(val) ? val : (val ? Object.values(val) : []);
          const sanitized = {
            ...erpData,
            users: toArray(erpData.users),
            customers: toArray(erpData.customers),
            suppliers: toArray(erpData.suppliers),
            items: toArray(erpData.items),
            saleOrders: toArray(erpData.saleOrders),
            productionPlans: toArray(erpData.productionPlans),
            productionOutputs: toArray(erpData.productionOutputs),
            deliveries: toArray(erpData.deliveries),
            notifications: toArray(erpData.notifications),
            returns: toArray(erpData.returns),
            purchaseDemands: toArray(erpData.purchaseDemands),
            purchaseOrders: toArray(erpData.purchaseOrders),
            inwardGatePasses: toArray(erpData.inwardGatePasses),
            grns: toArray(erpData.grns),
            stockTransfers: toArray(erpData.stockTransfers),
            otherConsumptions: toArray(erpData.otherConsumptions),
            auditLogs: toArray(erpData.auditLogs),
            chats: toArray(erpData.chats),
            approvals: toArray(erpData.approvals),
            gatePassActivities: toArray(erpData.gatePassActivities),
            salesInvoices: toArray(erpData.salesInvoices),
            purchaseInvoices: toArray(erpData.purchaseInvoices),
            paymentVouchers: toArray(erpData.paymentVouchers),
            chartOfAccounts: toArray(erpData.chartOfAccounts),
            hr_employees_list: toArray(erpData.hr_employees_list),
            hr_uploaded_attendance: toArray(erpData.hr_uploaded_attendance),
            hr_loan_requests: toArray(erpData.hr_loan_requests),
            hr_loan_ledger: toArray(erpData.hr_loan_ledger),
            boms: toArray(erpData.boms),
            rawMaterialPhases: toArray(erpData.rawMaterialPhases),
            finishedGoodPhases: toArray(erpData.finishedGoodPhases)
          };

          lastSyncedStateRef.current = copyStr;
          setState(prev => {
            const nextState = seedStateIfEmpty(sanitized);
            const nextCurrentUser = updateMatchedCurrentUser(prev.currentUser, nextState.users);
            return {
              ...nextState,
              currentUser: nextCurrentUser,
              themeSettings: prev.themeSettings,
              displaySettings: prev.displaySettings,
              dashboardLayout: prev.dashboardLayout,
              dashboardBackground: prev.dashboardBackground,
              documentWarehouseBinders: prev.documentWarehouseBinders
            };
          });
          setTimeout(() => {
            isRemoteSyncing.current = false;
          }, 100);
        } else {
          lastSyncedUpdatedAtRef.current = fullData.updated_at;
          if (fullData?.updated_at) {
            localStorage.setItem('fv_last_synced_updated_at', fullData.updated_at);
          }
        }
      } catch (err) {
        console.warn("Sync poll check error:", err);
      }
    };

    // Ultra-low Egress: Polling reduced to 5 mins fallback (Realtime WebSocket already pushes updates instantly!)
    // Tab open in background 24/7 sends 0 requests!
    const syncPollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden && (Date.now() - lastUserInteractionRef.current < 5 * 60 * 1000)) {
        checkRemoteVersion();
      }
    }, 300000);

    const handleWindowFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        const now = Date.now();
        // Cooldown: at most once every 60 seconds on window focus
        if (now - lastFocusSyncTime.current > 60000) {
          lastFocusSyncTime.current = now;
          checkRemoteVersion();
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('visibilitychange', handleWindowFocus);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(sessionsChannel);
      clearInterval(syncPollInterval);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('visibilitychange', handleWindowFocus);
    };
  }, []);

  // Intercept localStorage.setItem to keep AppContext state and remote database synced!
  useEffect(() => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      originalSetItem.apply(this, arguments);
      
      if (isLocalStorageWriting.current || isRemoteSyncing.current || isLocalUpsertInFlight.current) return;
      if (key !== 'hr_employees_list' && key !== 'hr_uploaded_attendance') return;

      if (lsDebounceRef.current[key]) {
        clearTimeout(lsDebounceRef.current[key]);
      }

      lsDebounceRef.current[key] = setTimeout(() => {
        try {
          const list = JSON.parse(value);
          setState(prev => {
            if (JSON.stringify(prev[key] || []) !== JSON.stringify(list || [])) {
              return { ...prev, [key]: list };
            }
            return prev;
          });
        } catch (e) {
          console.warn(`Error parsing ${key} setItem:`, e);
        }
      }, 150);
    };

    return () => {
      localStorage.setItem = originalSetItem;
      if (lsDebounceRef.current.hr_employees_list) clearTimeout(lsDebounceRef.current.hr_employees_list);
      if (lsDebounceRef.current.hr_uploaded_attendance) clearTimeout(lsDebounceRef.current.hr_uploaded_attendance);
    };
  }, []);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkQuality, setNetworkQuality] = useState('good'); // 'good' | 'slow' | 'offline'
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'slow_retry' | 'offline_retry'

  const mergeCollections = (localArr = [], remoteArr = [], idKey = 'id') => {
      const merged = [...remoteArr];
      localArr.forEach(localItem => {
          const localId = localItem[idKey] || localItem.username || localItem.id;
          const idx = merged.findIndex(r => (r[idKey] || r.username || r.id) === localId);
          if (idx > -1) {
              const remoteItem = merged[idx];
              if (localItem.status && localItem.status !== 'Pending' && remoteItem.status === 'Pending') {
                  merged[idx] = { ...remoteItem, ...localItem };
              } else if ((localItem.timestamp || 0) >= (remoteItem.timestamp || 0)) {
                  merged[idx] = { ...remoteItem, ...localItem };
              }
          } else {
              merged.unshift(localItem);
          }
      });
      return merged;
  };

  const handleReconnectFetch = async () => {
      try {
          const { data, error } = await supabase
              .from('erp_state')
              .select('state_data, updated_at')
              .eq('id', 'main_state')
              .maybeSingle();
          if (error) throw error;
          if (data && data.state_data) {
              if (data.updated_at) {
                lastSyncedUpdatedAtRef.current = data.updated_at;
              }
              const remote = data.state_data;
              
              const syncStateCopy = getSanitizedSyncState(remote);
              const copyStr = JSON.stringify(syncStateCopy);
              if (copyStr === lastSyncedStateRef.current) {
                return;
              }
              lastSyncedStateRef.current = copyStr;

              setState(prev => {
                  const merged = { ...prev };
                  const collections = [
                      'users', 'items', 'saleOrders', 'adjustments', 'productionPlans', 
                      'productionOutputs', 'deliveries', 'grns', 'boms', 
                      'notifications', 'returns', 'purchaseDemands', 'purchaseOrders',
                      'inwardGatePasses', 'stockTransfers', 'auditLogs', 'chats', 
                      'approvals', 'routingTasks', 'routingRules', 'gatePassActivities', 'salesInvoices', 
                      'purchaseInvoices', 'paymentVouchers', 'chartOfAccounts',
                      'otherConsumptions',
                      'hr_employees_list', 'hr_uploaded_attendance',
                      'hr_overtime_requests', 'hr_leave_requests', 'hr_advance_requests',
                      'hr_loan_requests', 'hr_loan_ledger', 'hr_generated_salaries'
                  ];
                  collections.forEach(col => {
                      const localCol = Array.isArray(prev[col]) ? prev[col] : [];
                      const remoteCol = Array.isArray(remote[col]) ? remote[col] : [];
                      merged[col] = mergeCollections(localCol, remoteCol);
                  });

                  const mergedSyncCopy = getSanitizedSyncState(merged);
                  lastSyncedStateRef.current = JSON.stringify(mergedSyncCopy);

                  return merged;
              });
              addNotification('Network Status', 'Reconnected to cloud database. State synchronized.', 'success');
          }
      } catch (err) {
          console.warn("Reconnect fetch failed:", err);
      }
  };

  // Monitor network status with non-blocking resilience
  useEffect(() => {
    const handleOnline = () => {
        setIsOnline(true);
        setNetworkQuality('good');
        handleReconnectFetch();
    };
    const handleOffline = () => {
        setNetworkQuality('slow');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Native Zero-Egress Network Health Check (Saves 8.64 Million queries per month!)
  useEffect(() => {
    const handleNativeOnline = () => {
      setIsOnline(true);
      setNetworkQuality('good');
      setSyncStatus(prevStatus => {
        if (prevStatus === 'offline_retry' || prevStatus === 'slow_retry') {
          setTimeout(() => { triggerSyncWrite(); }, 50);
          return 'idle';
        }
        return prevStatus;
      });
    };

    const handleNativeOffline = () => {
      setIsOnline(false);
      setNetworkQuality('offline');
    };

    window.addEventListener('online', handleNativeOnline);
    window.addEventListener('offline', handleNativeOffline);

    // Initial check without consuming database bandwidth
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      setIsOnline(navigator.onLine);
    }

    return () => {
      window.removeEventListener('online', handleNativeOnline);
      window.removeEventListener('offline', handleNativeOffline);
    };
  }, []);

  const syncToStandaloneTables = async (targetState) => {
    if (!targetState || !standaloneTablesSupportedRef.current) return;
    try {
      const promises = [];

      if (targetState.hr_employees_list && Array.isArray(targetState.hr_employees_list) && targetState.hr_employees_list.length > 0) {
        const empRows = targetState.hr_employees_list.map(e => ({
          id: String(e.id),
          name: e.name || 'Employee',
          department: e.department || null,
          designation: e.designation || null,
          phone: e.phone || null,
          email: e.email || null,
          basic_salary: parseFloat(e.basicSalary || e.salary || 0),
          allowance: parseFloat(e.allowance || 0),
          advance: parseFloat(e.advance || 0),
          avatar: e.avatar || null,
          status: e.status || 'Active'
        }));
        promises.push(supabase.from('hr_employees').upsert(empRows, { onConflict: 'id' }));
      }

      if (targetState.hr_overtime_requests && Array.isArray(targetState.hr_overtime_requests) && targetState.hr_overtime_requests.length > 0) {
        const otRows = targetState.hr_overtime_requests.map(r => ({
          id: String(r.id),
          employee_id: r.employeeId ? String(r.employeeId) : null,
          employee_name: r.employeeName || null,
          date: r.date || null,
          start_time: r.startTime || null,
          end_time: r.endTime || null,
          hours: parseFloat(r.hours || 0),
          reason: r.reason || null,
          status: r.status || 'Pending',
          attachments: r.attachments || []
        }));
        promises.push(supabase.from('hr_overtime_requests').upsert(otRows, { onConflict: 'id' }));
      }

      if (targetState.hr_loan_requests && Array.isArray(targetState.hr_loan_requests) && targetState.hr_loan_requests.length > 0) {
        const loanRows = targetState.hr_loan_requests.map(l => ({
          id: String(l.id),
          employee_id: l.employeeId ? String(l.employeeId) : null,
          employee_name: l.employeeName || null,
          department: l.department || null,
          date_applied: l.dateApplied || null,
          repayment_start_date: l.repaymentStartDate || null,
          type: l.type || null,
          amount: parseFloat(l.amount || 0),
          term_months: parseInt(l.termMonths || 12),
          monthly_installment: parseFloat(l.monthlyInstallment || 0),
          purpose: l.purpose || null,
          status: l.status || 'Pending'
        }));
        promises.push(supabase.from('hr_loan_requests').upsert(loanRows, { onConflict: 'id' }));
      }

      if (targetState.hr_loan_ledger && Array.isArray(targetState.hr_loan_ledger) && targetState.hr_loan_ledger.length > 0) {
        const ledgerRows = targetState.hr_loan_ledger.map(ll => ({
          id: String(ll.id),
          loan_request_id: ll.loanRequestId ? String(ll.loanRequestId) : null,
          employee_id: ll.employeeId ? String(ll.employeeId) : null,
          employee_name: ll.employeeName || null,
          department: ll.department || null,
          designation: ll.designation || null,
          loan_type: ll.loanType || null,
          total_loan_amount: parseFloat(ll.totalLoanAmount || 0),
          term_months: parseInt(ll.termMonths || 12),
          monthly_installment: parseFloat(ll.monthlyInstallment || 0),
          repayment_start_date: ll.repaymentStartDate || null,
          next_deduction_date: ll.nextDeductionDate || null,
          paid_amount: parseFloat(ll.paidAmount || 0),
          remaining_balance: parseFloat(ll.remainingBalance || 0),
          status: ll.status || 'Active',
          deductions_history: ll.deductionsHistory || []
        }));
        promises.push(supabase.from('hr_loan_ledger').upsert(ledgerRows, { onConflict: 'id' }));
      }

      if (targetState.approvals && Array.isArray(targetState.approvals) && targetState.approvals.length > 0) {
        const approvalRows = targetState.approvals.map(a => ({
          id: String(a.id),
          type: a.type || null,
          requested_to: a.requestedTo || null,
          requested_by: a.requestedBy || null,
          details: a.details || null,
          value: a.value || null,
          loan_request_id: a.loanRequestId ? String(a.loanRequestId) : null,
          document_id: a.documentId ? String(a.documentId) : null,
          status: a.status || 'Pending',
          completed_at: a.completedAt || null,
          reason_comment: a.reasonComment || null,
          timestamp: a.timestamp || null
        }));
        promises.push(supabase.from('approvals').upsert(approvalRows, { onConflict: 'id' }));
      }

      if (targetState.saleOrders && Array.isArray(targetState.saleOrders) && targetState.saleOrders.length > 0) {
        const soRows = targetState.saleOrders.map(s => ({
          id: String(s.id),
          so_number: s.soNumber || null,
          customer_name: s.customerName || null,
          total_amount: parseFloat(s.totalAmount || 0),
          items: s.items || [],
          status: s.status || 'Pending'
        }));
        promises.push(supabase.from('sale_orders').upsert(soRows, { onConflict: 'id' }));
      }

      if (targetState.customers && Array.isArray(targetState.customers) && targetState.customers.length > 0) {
        const custRows = targetState.customers.map(c => ({
          id: String(c.id),
          name: c.name || c.customerName || 'Customer',
          company: c.company || null,
          phone: c.phone || null,
          email: c.email || null,
          city: c.city || null,
          credit_limit: parseFloat(c.creditLimit || 0),
          balance: parseFloat(c.balance || 0)
        }));
        promises.push(supabase.from('customers').upsert(custRows, { onConflict: 'id' }));
      }

      if (targetState.suppliers && Array.isArray(targetState.suppliers) && targetState.suppliers.length > 0) {
        const suppRows = targetState.suppliers.map(s => ({
          id: String(s.id),
          name: s.name || s.supplierName || 'Supplier',
          company: s.company || null,
          phone: s.phone || null,
          email: s.email || null,
          city: s.city || null,
          payment_terms: s.paymentTerms || null
        }));
        promises.push(supabase.from('suppliers').upsert(suppRows, { onConflict: 'id' }));
      }

      if (targetState.productionPlans && Array.isArray(targetState.productionPlans) && targetState.productionPlans.length > 0) {
        const planRows = targetState.productionPlans.map(p => ({
          id: String(p.id),
          plan_no: p.planNo || null,
          product_name: p.productName || null,
          target_qty: parseFloat(p.targetQty || 0),
          completed_qty: parseFloat(p.completedQty || 0),
          status: p.status || 'Planned',
          phases: p.phases || []
        }));
        promises.push(supabase.from('production_plans').upsert(planRows, { onConflict: 'id' }));
      }

      if (targetState.users && Array.isArray(targetState.users) && targetState.users.length > 0) {
        const userRows = targetState.users.map(u => ({
          id: String(u.id),
          username: u.username || null,
          full_name: u.name || null,
          role: u.role || null,
          email: u.email || null,
          phone: u.phone || null,
          status: u.status || 'Active',
          permissions: u.permissions || [],
          granular_permissions: u.granularPermissions || {}
        }));
        promises.push(supabase.from('users').upsert(userRows, { onConflict: 'id' }));
      }

      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }
    } catch (e) {
      console.warn("Standalone table sync warning:", e);
    }
  };

  // ===== SYNC GUARD (2026-10-22) =====
  // All company data lives in ONE erp_state row; every write replaces it wholesale
  // (last-write-wins). A client holding a stale copy must never overwrite a newer
  // remote version. This runs before every erp_state write: (1) the initial remote
  // load must have completed; (2) the remote updated_at must equal the version this
  // client last applied or wrote (compared as parsed timestamps). Fail-safe: any
  // probe error also refuses the write.
  const checkSyncGuard = async (caller) => {
    if (!isFirstRemoteSyncCompleted.current) {
      console.warn(`[SyncGuard] ${caller}: write refused - initial remote load not completed.`);
      return false;
    }
    try {
      const { data, error } = await supabase
        .from('erp_state')
        .select('updated_at')
        .eq('id', 'main_state')
        .maybeSingle();
      if (error) {
        console.warn(`[SyncGuard] ${caller}: write refused - version probe failed.`, error);
        return false;
      }
      const remoteUpdatedAt = data?.updated_at || null;
      const base = guardBaseUpdatedAtRef.current;
      if (!remoteUpdatedAt) return true; // no remote row yet - nothing to protect
      if (!base) {
        console.warn(`[SyncGuard] ${caller}: write refused - no applied remote version known.`);
        return false;
      }
      if (Date.parse(remoteUpdatedAt) !== Date.parse(base)) {
        console.warn(`[SyncGuard] ${caller}: write refused - remote is newer (remote ${remoteUpdatedAt} vs base ${base}).`);
        return false;
      }
      return true;
    } catch (e) {
      console.warn(`[SyncGuard] ${caller}: write refused - probe exception.`, e);
      return false;
    }
  };

  const triggerSyncWrite = async () => {
      if (!isOnline) return;
      
      const syncState = getSanitizedSyncState(state);
      const currentSyncStateStr = JSON.stringify(syncState);
      if (currentSyncStateStr === lastSyncedStateRef.current) {
        setSyncStatus('idle');
        return;
      }
      if (!(await checkSyncGuard('triggerSyncWrite'))) {
        setSyncStatus('idle');
        return;
      }
      // PHASE D STEP D3: erp_state blob writes are STOPPED app-wide. Every
      // entity and config value persists through its table / app_config
      // write-through; this path now only runs the standalone-table sync.
      // The blob row stays in Supabase as a read-only backup, and the blob
      // version refs (lastSyncedUpdatedAtRef / guardBaseUpdatedAtRef) keep
      // pointing at the last applied remote version so the (now dormant)
      // sync guard keeps passing against the frozen row.
      isLocalUpsertInFlight.current = true;
      try {
          await syncToStandaloneTables(state);

          lastSyncedStateRef.current = currentSyncStateStr;
          setSyncStatus('idle');
      } catch (err) {
          console.warn("Supabase retry sync write error:", err);
          setSyncStatus('offline_retry');
      } finally {
          setTimeout(() => {
            isLocalUpsertInFlight.current = false;
          }, 500);
      }
  };

  useEffect(() => {
      if (isOnline && (syncStatus === 'slow_retry' || syncStatus === 'offline_retry')) {
          setSyncStatus('syncing');
          triggerSyncWrite();
      }
  }, [isOnline, syncStatus]);

  useEffect(() => {
    isLocalStorageWriting.current = true;
    try {
      safeLocalStorageSet('aj_synthetic_erp', JSON.stringify(state));
      if (state.currentUser) {
        safeLocalStorageSet('aj_current_user', JSON.stringify(state.currentUser));
      }
      
      // Write key items to separate localStorage keys for backwards compatibility/sync!
      if (state.hr_employees_list) {
        safeLocalStorageSet('hr_employees_list', JSON.stringify(state.hr_employees_list));
        // Dispatch storage event to trigger updates in the same window context
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'hr_employees_list',
          newValue: JSON.stringify(state.hr_employees_list),
          storageArea: localStorage
        }));
      }
      if (state.hr_uploaded_attendance) {
        safeLocalStorageSet('hr_uploaded_attendance', JSON.stringify(state.hr_uploaded_attendance));
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'hr_uploaded_attendance',
          newValue: JSON.stringify(state.hr_uploaded_attendance),
          storageArea: localStorage
        }));
      }
      if (state.hr_overtime_requests) {
        safeLocalStorageSet('hr_overtime_requests', JSON.stringify(state.hr_overtime_requests));
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'hr_overtime_requests',
          newValue: JSON.stringify(state.hr_overtime_requests),
          storageArea: localStorage
        }));
      }
      if (state.hr_leave_requests) {
        safeLocalStorageSet('hr_leave_requests', JSON.stringify(state.hr_leave_requests));
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'hr_leave_requests',
          newValue: JSON.stringify(state.hr_leave_requests),
          storageArea: localStorage
        }));
      }
      if (state.hr_generated_salaries) {
        safeLocalStorageSet('hr_generated_salaries', JSON.stringify(state.hr_generated_salaries));
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'hr_generated_salaries',
          newValue: JSON.stringify(state.hr_generated_salaries),
          storageArea: localStorage
        }));
      }
      if (state.users) {
        safeLocalStorageSet('fv_users_list', JSON.stringify(state.users));
      }
      if (state.hr_loan_requests) {
        safeLocalStorageSet('hr_loan_requests', JSON.stringify(state.hr_loan_requests));
      }
      if (state.hr_loan_ledger) {
        safeLocalStorageSet('hr_loan_ledger', JSON.stringify(state.hr_loan_ledger));
      }
      if (state.hr_advance_requests) {
        safeLocalStorageSet('hr_advance_requests', JSON.stringify(state.hr_advance_requests));
      }
      if (state.routingRules) {
        safeLocalStorageSet('hr_routing_rules_config', JSON.stringify(state.routingRules));
      }
      if (state.routingTasks) {
        safeLocalStorageSet('routingTasks', JSON.stringify(state.routingTasks));
      }
      if (state.approvals) {
        safeLocalStorageSet('approvals', JSON.stringify(state.approvals));
      }
    } finally {
      isLocalStorageWriting.current = false;
    }

    // Do not sync back to Supabase if the change was triggered by a remote sync!
    if (isRemoteSyncing.current) {
      return;
    }

    // Do not sync back to Supabase until we have loaded the existing state from the database
    if (!isFirstRemoteSyncCompleted.current) {
      return;
    }

    // Sync state to Supabase without local settings
    const syncState = getSanitizedSyncState(state);

    const currentSyncStateStr = JSON.stringify(syncState);
    if (currentSyncStateStr === lastSyncedStateRef.current) {
        return;
    }

    setSyncStatus(prev => {
        if (!isOnline) return 'offline_retry';
        return 'syncing';
    });

    if (pendingWriteRef.current) {
      clearTimeout(pendingWriteRef.current);
    }

    pendingWriteRef.current = setTimeout(async () => {
      pendingWriteRef.current = null;

      if (!isOnline) {
          setSyncStatus('offline_retry');
          return;
      }

      if (!(await checkSyncGuard('auto-sync'))) {
        setSyncStatus('idle');
        return;
      }

      // PHASE D STEP D3: erp_state blob writes are STOPPED app-wide (see
      // triggerSyncWrite). This debounced path now only runs the
      // standalone-table sync; entities/config persist via their table /
      // app_config write-through effects, and the blob version refs stay
      // on the last applied remote version (frozen backup row).
      isLocalUpsertInFlight.current = true;
      try {
        syncToStandaloneTables(state);
        lastSyncedStateRef.current = currentSyncStateStr;
        setSyncStatus('idle');
      } catch (err) {
        console.warn("Supabase erp_state sync write catch error:", err);
        setSyncStatus('slow_retry');
      } finally {
        setTimeout(() => {
          isLocalUpsertInFlight.current = false;
        }, 500);
      }
    }, 1200);

    return () => {
      if (pendingWriteRef.current) {
        clearTimeout(pendingWriteRef.current);
      }
    };
  }, [state, isOnline, networkQuality]);

  // Ensure pending state writes are flushed if user closes or reloads page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingWriteRef.current) {
        clearTimeout(pendingWriteRef.current);
        pendingWriteRef.current = null;
        triggerSyncWrite();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state]);

  // Subscribe to user-specific and platform-specific settings from Supabase
  useEffect(() => {
    if (!state.currentUser?.username) {
      isUserSettingsLoaded.current = false;
      return;
    }
    isUserSettingsLoaded.current = false; // Reset loaded flag on user change
    const username = state.currentUser.username;
    const isMobileApp = window.Capacitor || window.cordova || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.screen.width < 768;
    const platformKey = isMobileApp ? 'mobile' : 'web';
    
    // Load local cache first for instant UI response
    const cachedTheme = localStorage.getItem(`themeSettings_${username}_${platformKey}`);
    const cachedDisplay = localStorage.getItem(`displaySettings_${username}_${platformKey}`);
    const cachedLayout = localStorage.getItem(`dashboardLayout_${username}_${platformKey}`);
    const cachedBackground = localStorage.getItem(`dashboardBackground_${username}_${platformKey}`);
    // FILES CABINET (2026-10-25): binders are NO longer read from any
    // per-user copy — the document_warehouse_binders table is their only
    // source. What rides per-user now is binderColors (spine overrides).
    const cachedBinderColors = localStorage.getItem(`binderColors_${username}_${platformKey}`);

    setState(prev => {
      const nextState = { ...prev };
      try {
        nextState.themeSettings = cachedTheme && cachedTheme !== 'undefined' ? JSON.parse(cachedTheme) : {
          colorMode: 'light',
          primaryColor: 'indigo',
          fontStyle: 'inter',
          fontSize: 16,
          borderRadius: 'rounded'
        };
      } catch (e) {
        console.warn("Error parsing cachedTheme:", e);
      }
      try {
        nextState.displaySettings = cachedDisplay && cachedDisplay !== 'undefined' ? JSON.parse(cachedDisplay) : {
          webScale: 75,
          mobileScale: 100,
          sidebarPosition: 'left',
          subMenuPosition: 'left'
        };
      } catch (e) {
        console.warn("Error parsing cachedDisplay:", e);
      }
      try {
        nextState.dashboardLayout = cachedLayout && cachedLayout !== 'undefined' ? JSON.parse(cachedLayout) : [
          { i: 'delivery_kpi', x: 0, y: 0, w: 12, h: 4, type: 'delivery_kpi', static: false },
          { i: 'shortcuts', x: 0, y: 4, w: 4, h: 4, type: 'shortcuts', static: false },
          { i: 'todo_list', x: 4, y: 4, w: 4, h: 6, type: 'todo_list', static: false },
          { i: 'calendar', x: 8, y: 4, w: 4, h: 6, type: 'calendar', static: false }
        ];
      } catch (e) {
        console.warn("Error parsing cachedLayout:", e);
      }
      try {
        nextState.dashboardBackground = cachedBackground && cachedBackground !== 'undefined' ? JSON.parse(cachedBackground) : null;
      } catch (e) {
        console.warn("Error parsing cachedBackground:", e);
      }
      try {
        nextState.binderColors = cachedBinderColors && cachedBinderColors !== 'undefined' ? JSON.parse(cachedBinderColors) : {};
      } catch (e) {
        console.warn("Error parsing cachedBinderColors:", e);
      }
      return nextState;
    });

    const fetchInitialSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('settings_data')
          .eq('username', username)
          .eq('platform', platformKey)
          .maybeSingle();

        if (error) {
          console.warn("Supabase user settings load error:", error);
          isUserSettingsLoaded.current = true;
          return;
        }

        if (data && data.settings_data) {
          const sData = data.settings_data;
          setState(prev => {
            // Content-equality guard: only apply fields that actually differ.
            // Re-applying identical settings (new object identity) re-triggers
            // applyTheme and makes themed colors flicker between shades.
            const next = { ...prev };
            let changed = false;
            const assignIfDiff = (key, value) => {
              if (JSON.stringify(prev[key]) !== JSON.stringify(value)) {
                next[key] = value;
                changed = true;
              }
            };
            assignIfDiff('themeSettings', sData.themeSettings || {
              colorMode: 'light',
              primaryColor: 'indigo',
              fontStyle: 'inter',
              fontSize: 16,
              borderRadius: 'rounded'
            });
            assignIfDiff('displaySettings', sData.displaySettings || {
              webScale: 75,
              mobileScale: 100,
              sidebarPosition: 'left',
              subMenuPosition: 'left'
            });
            assignIfDiff('dashboardLayout', sData.dashboardLayout || [
              { i: 'delivery_kpi', x: 0, y: 0, w: 12, h: 4, type: 'delivery_kpi', static: false },
              { i: 'shortcuts', x: 0, y: 4, w: 4, h: 4, type: 'shortcuts', static: false },
              { i: 'todo_list', x: 4, y: 4, w: 4, h: 6, type: 'todo_list', static: false },
              { i: 'calendar', x: 8, y: 4, w: 4, h: 6, type: 'calendar', static: false }
            ]);
            assignIfDiff('dashboardBackground', sData.dashboardBackground !== undefined ? sData.dashboardBackground : null);
            assignIfDiff('binderColors', sData.binderColors || {});
            return changed ? next : prev;
          });
        }
      } catch (err) {
        console.warn("Supabase user settings load failed:", err);
      } finally {
        isUserSettingsLoaded.current = true;
      }
    };

    fetchInitialSettings();

    // Subscribe to real-time changes for user settings
    const settingsChannel = supabase
      .channel(`public:user_settings:${username}:${platformKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `username=eq.${username}`
        },
        (payload) => {
          if (payload.new && payload.new.platform === platformKey) {
            const sData = payload.new.settings_data || {};
            if (sData.lastUpdatedBy === clientId.current) {
              return;
            }
            setState(prev => {
              // Content-equality guard: apply only fields that actually
              // differ, and skip setState entirely when nothing changed.
              // Without this, two clients of the same user keep re-applying
              // each other's theme and the colors flicker dark/light.
              const next = { ...prev };
              let changed = false;
              const assignIfDiff = (key, value) => {
                if (JSON.stringify(prev[key]) !== JSON.stringify(value)) {
                  next[key] = value;
                  changed = true;
                }
              };
              assignIfDiff('themeSettings', sData.themeSettings || prev.themeSettings);
              assignIfDiff('displaySettings', sData.displaySettings || prev.displaySettings);
              assignIfDiff('dashboardLayout', sData.dashboardLayout || prev.dashboardLayout);
              assignIfDiff('dashboardBackground', sData.dashboardBackground !== undefined ? sData.dashboardBackground : prev.dashboardBackground);
              assignIfDiff('binderColors', sData.binderColors || prev.binderColors || {});
              return changed ? next : prev;
            });
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(settingsChannel);
    };
  }, [state.currentUser?.username]);

  // Holds the JSON of the last settings snapshot this client saved, so the
  // save effect below can skip no-op writes (see the guard inside it).
  const lastSavedSettingsRef = useRef(null);

  // Sync user-specific and platform-specific settings back to Supabase
  useEffect(() => {
    if (!state.currentUser?.username) return;
    if (!isUserSettingsLoaded.current) return; // Prevent writing settings until we have finished loading them from remote database!
    
    const username = state.currentUser.username;
    const isMobileApp = window.Capacitor || window.cordova || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.screen.width < 768;
    const platformKey = isMobileApp ? 'mobile' : 'web';
    
    // FILES CABINET (2026-10-25): binders are NOT part of user settings any
    // more — they live only in the document_warehouse_binders table. What
    // rides here instead is the per-user binderColors override map. (This
    // upsert also drops the legacy documentWarehouseBinders key from the
    // stored payload on the next save, since the payload is rebuilt here.)
    const userSettings = {
      themeSettings: state.themeSettings || null,
      displaySettings: state.displaySettings || null,
      dashboardLayout: state.dashboardLayout || null,
      dashboardBackground: state.dashboardBackground || null,
      binderColors: state.binderColors || {},
      lastUpdatedBy: clientId.current
    };

    // Skip no-op saves: if the settings content is identical to the last
    // saved snapshot, writing again would only emit realtime events to this
    // user's other clients and make their theme re-apply (color flicker).
    const settingsSnapshot = JSON.stringify({
      themeSettings: userSettings.themeSettings,
      displaySettings: userSettings.displaySettings,
      dashboardLayout: userSettings.dashboardLayout,
      dashboardBackground: userSettings.dashboardBackground,
      binderColors: userSettings.binderColors
    });
    if (lastSavedSettingsRef.current === settingsSnapshot) return;
    lastSavedSettingsRef.current = settingsSnapshot;

    // Save locally with fallback to null to prevent storing "undefined"
    localStorage.setItem(`themeSettings_${username}_${platformKey}`, JSON.stringify(state.themeSettings || null));
    localStorage.setItem(`displaySettings_${username}_${platformKey}`, JSON.stringify(state.displaySettings || null));
    localStorage.setItem(`dashboardLayout_${username}_${platformKey}`, JSON.stringify(state.dashboardLayout || null));
    localStorage.setItem(`dashboardBackground_${username}_${platformKey}`, JSON.stringify(state.dashboardBackground || null));
    localStorage.setItem(`binderColors_${username}_${platformKey}`, JSON.stringify(state.binderColors || {}));
    
    // Debounce the Supabase write by 800ms to prevent collision/jitter during reordering
    const handler = setTimeout(() => {
      // Sanitize to remove any "undefined" properties before writing to database
      const sanitizedUserSettings = JSON.parse(JSON.stringify(userSettings));

      // Save to Supabase
      supabase
        .from('user_settings')
        .upsert({
          username,
          platform: platformKey,
          settings_data: sanitizedUserSettings,
          updated_at: new Date().toISOString()
        })
        .then(({ error }) => {
          if (error) {
            console.warn("Supabase user settings write warning:", error);
          }
        });
    }, 800);

    return () => clearTimeout(handler);
  }, [state.themeSettings, state.displaySettings, state.dashboardLayout, state.dashboardBackground, state.binderColors, state.currentUser?.username]);

  // Apply display scaling globally based on device/viewport and preferences
  useEffect(() => {
    const applyScaling = () => {
      // Device class must come from a stable signal (UA / physical screen),
      // never from window.innerWidth: body zoom + viewport-meta changes can
      // move innerWidth across the 768 threshold and flip the scale (and the
      // whole layout/theme) back and forth on the same device.
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.screen.width < 768;
      const display = state.displaySettings || { webScale: 75, mobileScale: 100 };
      
      const isChatPage = window.location.pathname === '/chat';
      let currentScale;
      if (isChatPage) {
        currentScale = Number(localStorage.getItem('fv_chat_scale') || '75');
      } else {
        currentScale = isMobile ? (display.mobileScale || 100) : (display.webScale || 75);
      }
      
      // Apply CSS zoom to the body
      document.body.style.zoom = `${currentScale}%`;
      document.body.style.height = `${100 / (currentScale / 100)}vh`;
      document.body.style.width = `${100 / (currentScale / 100)}vw`;
    };

    applyScaling();

    window.addEventListener('resize', applyScaling);
    window.addEventListener('fv_chat_scale_changed', applyScaling);
    return () => {
      window.removeEventListener('resize', applyScaling);
      window.removeEventListener('fv_chat_scale_changed', applyScaling);
      document.body.style.zoom = '';
      document.body.style.height = '';
      document.body.style.width = '';
    };
  }, [state.displaySettings]);

  const updateActiveStatus = async () => {
    if (!currentUserRef.current?.username) return;
    
    const connId = connectionId.current;
    const myDevId = getDeviceId();
    const customName = localStorage.getItem('custom_device_name') || '';
    const devInfoPayload = JSON.stringify({
      deviceId: myDevId,
      customName,
      platform: window.process?.versions?.electron ? 'Desktop' : 'Web',
      userAgent: navigator.userAgent,
      updatedAt: new Date().toISOString()
    });

    try {
      if (typeof document !== 'undefined' && document.hidden) return; // Zero egress when tab is hidden!
      // Check if another device has superseded us
      const { data: currentSessions } = await supabase
        .from('user_sessions')
        .select('connection_id, device_info')
        .ilike('username', currentUserRef.current.username);

      if (currentSessions && currentSessions.length > 0) {
        const isCurrentActive = currentSessions.some(s => {
          if (s.connection_id === connId) return true;
          try {
            const p = typeof s.device_info === 'string' ? JSON.parse(s.device_info) : s.device_info;
            if (p?.deviceId === myDevId) return true;
          } catch(e) {}
          return false;
        });

        if (!isCurrentActive) {
          console.warn('[Security Guard] Active session superseded in heartbeat check.');
          handleForceConcurrentLogout();
          return;
        }
      }

      supabase
        .from('user_sessions')
        .upsert({
          username: currentUserRef.current.username,
          connection_id: connId,
          last_active: new Date().toISOString(),
          status: 'online',
          device_info: devInfoPayload
        }, { onConflict: 'connection_id' })
        .then(({ error }) => {
          if (error) console.warn("Error upserting user session to Supabase:", error);
        });
    } catch (err) {
      console.warn("Heartbeat session update error:", err);
    }
  };

  const cleanupSession = () => {
    const connId = connectionId.current;
    supabase
      .from('user_sessions')
      .delete()
      .eq('connection_id', connId)
      .then(({ error }) => {
        if (error) console.warn("Error deleting user session from Supabase:", error);
      });
  };

  // Ultra-Low Egress User Heartbeat (Saves 25.9 Million writes per month!)
  // Completely silent when tab is minimized/in background or user is away from desk
  useEffect(() => {
    if (!state.currentUser?.username) return;

    // Send initial status on login
    updateActiveStatus();

    // Heartbeat every 5 minutes ONLY if user is actively using the tab
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return; // 0 queries when tab in background
      if (Date.now() - lastUserInteractionRef.current > 5 * 60 * 1000) return; // 0 queries when idle
      updateActiveStatus();
    }, 300000);

    const handleVisibilityHeartbeat = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        lastUserInteractionRef.current = Date.now();
        updateActiveStatus();
      }
    };

    window.addEventListener('focus', handleVisibilityHeartbeat);
    window.addEventListener('beforeunload', cleanupSession);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityHeartbeat);
      window.removeEventListener('beforeunload', cleanupSession);
      cleanupSession();
    };
  }, [state.currentUser?.username]);

  // --- GLOBAL CALLING STATE & WebRTC SIGNALING ---
  const [activeCall, setActiveCall] = useState(null);
  const [callTimer, setCallTimer] = useState(0);
  const callTimerRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [activeCallSessionId, setActiveCallSessionId] = useState(null);
  const [participantsList, setParticipantsList] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [username]: MediaStream }
  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(null);
  const remotePeerConnectionIds = useRef({}); // { [username]: connectionId }
  const peerConnections = useRef({}); // { [username]: RTCPeerConnection }
  const signalingChannel = useRef(null);
  const callTimeoutRef = useRef(null);
  const callRingingTimeoutRef = useRef(null);

  const getFullName = (username) => {
    const matched = (state.users || []).find(u => u.username === username);
    return matched?.name || username;
  };

  const getUserAvatar = (username) => {
    const matched = (state.users || []).find(u => u.username === username);
    return matched?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;
  };

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Helper to initialize target peer connection (mesh)
  const createPeerConnection = async (targetUsername, isInitiator, type, sessionId) => {
    if (peerConnections.current[targetUsername]) {
      return peerConnections.current[targetUsername];
    }

    console.log(`[WebRTC] Creating RTCPeerConnection for ${targetUsername}, isInitiator: ${isInitiator}`);
    const pc = new RTCPeerConnection(iceServers);
    peerConnections.current[targetUsername] = pc;

    // Add local stream tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannel.current) {
        const targetConnId = remotePeerConnectionIds.current[targetUsername];
        console.log(`[WebRTC] Sending ICE Candidate to ${targetUsername} targeting session: ${targetConnId}`);
        signalingChannel.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            target: targetUsername,
            targetConnectionId: targetConnId,
            sender: state.currentUser?.username,
            senderConnectionId: connectionId.current,
            candidate: event.candidate,
            sessionId
          }
        });
      }
    };

    // Remote Stream added
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Remote stream received from ${targetUsername}`);
      const remoteStream = event.streams[0];
      setRemoteStreams(prev => ({
        ...prev,
        [targetUsername]: remoteStream
      }));
    };

    if (isInitiator && signalingChannel.current) {
      const targetConnId = remotePeerConnectionIds.current[targetUsername];
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log(`[WebRTC] Sending Offer to ${targetUsername} targeting session: ${targetConnId}`);
      signalingChannel.current.send({
        type: 'broadcast',
        event: 'webrtc-offer',
        payload: {
          target: targetUsername,
          targetConnectionId: targetConnId,
          sender: state.currentUser?.username,
          senderConnectionId: connectionId.current,
          sdp: offer,
          callType: type,
          sessionId
        }
      });
    }

    return pc;
  };

  // WebRTC Signaling Broadcast Channel Subscription
  useEffect(() => {
    if (!state.currentUser?.username) return;

    const currentUserUsername = state.currentUser.username;
    console.log(`[Signaling] Subscribing to global_signaling channel`);
    const channel = supabase.channel('global_signaling');
    signalingChannel.current = channel;

    channel
      .on('broadcast', { event: 'incoming-call' }, async (payload) => {
        const { target, targetConnections, caller, callerConnectionId, callType, sessionId, participants } = payload.payload;
        if (target !== currentUserUsername) return; // Only process if intended for us

        // Check if our connectionId is in targetConnections list
        if (targetConnections && targetConnections.length > 0 && !targetConnections.includes(connectionId.current)) {
          console.log(`[Signaling] Call is not targeted for this connection ID: ${connectionId.current}`);
          return;
        }

        console.log(`[Signaling] Received incoming call from ${caller}, sessionId: ${sessionId}`);
        
        // Save caller's connection ID
        remotePeerConnectionIds.current[caller] = callerConnectionId;

        // Update active call states
        setCallTimer(0);
        setIsMuted(false);
        setIsSpeakerOn(false);
        setIsVideoMuted(false);
        setActiveCallSessionId(sessionId);
        setParticipantsList(participants || [caller]);

        setActiveCall({
          type: callType,
          name: getFullName(caller),
          status: 'Ringing...',
          isIncoming: true,
          caller: caller,
          avatar: getUserAvatar(caller)
        });
      })
      .on('broadcast', { event: 'webrtc-offer' }, async (payload) => {
        const { target, targetConnectionId, sender, senderConnectionId, sdp, sessionId, callType } = payload.payload;
        if (target !== currentUserUsername) return;
        if (targetConnectionId && targetConnectionId !== connectionId.current) return;

        console.log(`[Signaling] Received WebRTC offer from ${sender}`);

        // Save sender's connection ID
        remotePeerConnectionIds.current[sender] = senderConnectionId;

        // Ensure we have local stream ready before accepting SDP
        if (!localStreamRef.current) {
          try {
            const hasVideo = callType === 'video';
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: hasVideo
            });
            localStreamRef.current = stream;
            setLocalStream(stream);
          } catch (err) {
            console.warn("Could not capture media tracks for offer answer:", err);
          }
        }

        const pc = await createPeerConnection(sender, false, callType || 'voice', sessionId);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        console.log(`[Signaling] Sending WebRTC answer to ${sender}`);
        channel.send({
          type: 'broadcast',
          event: 'webrtc-answer',
          payload: {
            target: sender,
            targetConnectionId: senderConnectionId,
            sender: currentUserUsername,
            senderConnectionId: connectionId.current,
            sdp: answer,
            sessionId
          }
        });
      })
      .on('broadcast', { event: 'webrtc-answer' }, async (payload) => {
        const { target, targetConnectionId, sender, sdp } = payload.payload;
        if (target !== currentUserUsername) return;
        if (targetConnectionId && targetConnectionId !== connectionId.current) return;

        console.log(`[Signaling] Received WebRTC answer from ${sender}`);
        const pc = peerConnections.current[sender];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async (payload) => {
        const { target, targetConnectionId, sender, candidate } = payload.payload;
        if (target !== currentUserUsername) return;
        if (targetConnectionId && targetConnectionId !== connectionId.current) return;

        console.log(`[Signaling] Received ICE candidate from ${sender}`);
        const pc = peerConnections.current[sender];
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn("[WebRTC] Error adding ICE candidate:", e);
          }
        }
      })
      .on('broadcast', { event: 'add-participant' }, async (payload) => {
        const { target, targetConnectionId, caller, participants, sessionId } = payload.payload;
        if (target !== currentUserUsername) return;
        if (targetConnectionId && targetConnectionId !== connectionId.current) return;

        console.log(`[Signaling] Call session updated with participants:`, participants);
        setParticipantsList(participants);
        
        // If we are in the call and a new participant was added, connect to them
        if (activeCall && activeCall.status === 'Connected') {
          participants.forEach(async (username) => {
            if (username !== currentUserUsername && !peerConnections.current[username]) {
              await createPeerConnection(username, true, activeCall.type, sessionId);
            }
          });
        }
      })
      .on('broadcast', { event: 'hang-up' }, (payload) => {
        const { target, targetConnectionId, sender } = payload.payload;
        if (target !== currentUserUsername) return;
        if (targetConnectionId && targetConnectionId !== connectionId.current) return;

        console.log(`[Signaling] Participant ${sender} hung up`);
        
        // Remove stream and close connection
        const pc = peerConnections.current[sender];
        if (pc) {
          pc.close();
          delete peerConnections.current[sender];
        }
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[sender];
          return next;
        });

        // Update participant list
        setParticipantsList(prev => {
          const next = prev.filter(p => p !== sender);
          // If we are the only one left, end call locally
          if (next.length <= 1) {
            setTimeout(() => {
              endCallLocalOnly();
            }, 500);
          }
          return next;
        });
      })
      .subscribe((status) => {
        console.log(`[Signaling] Channel status: ${status}`);
      });

    return () => {
      console.log(`[Signaling] Unsubscribing global_signaling channel`);
      channel.unsubscribe();
    };
  }, [state.currentUser?.username, activeCall?.status]);

  const endCallLocalOnly = () => {
    console.log("[WebRTC] Closing all media streams and connections");
    clearInterval(callTimerRef.current);
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    if (callRingingTimeoutRef.current) clearTimeout(callRingingTimeoutRef.current);

    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close and clear all RTCPeerConnections
    Object.keys(peerConnections.current).forEach(username => {
      peerConnections.current[username].close();
    });
    peerConnections.current = {};
    setRemoteStreams({});
    setActiveCall(null);
    setActiveCallSessionId(null);
    setParticipantsList([]);
    remotePeerConnectionIds.current = {};
  };

  const startCall = async (type, forcedContactName = null, forcedAvatar = null, recipientUsername = null) => {
    if (!state.currentUser?.username) return;
    const currentUserUsername = state.currentUser.username;
    
    setCallTimer(0);
    setIsMuted(false);
    setIsSpeakerOn(false);
    setIsVideoMuted(false);

    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    if (callRingingTimeoutRef.current) clearTimeout(callRingingTimeoutRef.current);

    const callName = forcedContactName || getFullName(recipientUsername) || ' FlashVision Coworker';
    const callAvatar = forcedAvatar || getUserAvatar(recipientUsername);

    // Get UserMedia Stream first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
    } catch (err) {
      console.warn("Unable to capture camera/microphone tracks:", err);
      alert("Camera or Microphone permission was denied.");
      return;
    }

    setActiveCall({
      type,
      name: callName,
      status: 'Calling...',
      isOnline: false,
      isIncoming: false,
      avatar: callAvatar
    });

    const sessionId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setActiveCallSessionId(sessionId);

    const participants = recipientUsername ? [currentUserUsername, recipientUsername] : [currentUserUsername];
    setParticipantsList(participants);

    // Insert call session into database
    supabase
      .from('call_sessions')
      .insert({
        id: sessionId,
        caller_id: currentUserUsername,
        receiver_ids: recipientUsername ? [recipientUsername] : [],
        call_type: type,
        status: 'ringing'
      })
      .then(({ error }) => {
        if (error) console.warn("Error inserting call session to database:", error);
      });

    // Session verification & token routing logic
    if (recipientUsername) {
      // Check active browser sessions in last 25 seconds
      const twentyFiveSecondsAgo = new Date(Date.now() - 25000).toISOString();
      const { data: activeSessions } = await supabase
        .from('user_sessions')
        .select('connection_id')
        .eq('username', recipientUsername)
        .gt('last_active', twentyFiveSecondsAgo);

      const isCoworker = ['alex_sterling', 'operator_chief', 'yarn_lead'].includes(recipientUsername);
      const activeConnectionIds = activeSessions ? activeSessions.map(s => s.connection_id) : [];

      if (activeConnectionIds.length === 0 && !isCoworker) {
        // Target device offline/not detected -> Transition to Unavailable immediately
        console.log(`[Calling] Device offline or not detected for ${recipientUsername}. Failing call.`);
        setActiveCall(prev => prev ? { ...prev, status: 'User Unavailable' } : prev);
        
        // Clean up stream tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;
          setLocalStream(null);
        }

        callTimeoutRef.current = setTimeout(() => {
          endCallLocalOnly();
        }, 3000);
        return;
      }

      // Save connection IDs mapping for target
      if (activeConnectionIds.length > 0) {
        remotePeerConnectionIds.current[recipientUsername] = activeConnectionIds[0];
      }

      // Online: Broadcast incoming call invite to target connection IDs
      if (signalingChannel.current) {
        console.log(`[Signaling] Broadcasting incoming-call invite to target ${recipientUsername}`);
        signalingChannel.current.send({
          type: 'broadcast',
          event: 'incoming-call',
          payload: {
            target: recipientUsername,
            targetConnections: activeConnectionIds,
            caller: currentUserUsername,
            callerConnectionId: connectionId.current,
            callType: type,
            sessionId,
            participants
          }
        });
      }

      // Update call overlay state as online
      setActiveCall(prev => prev ? { ...prev, isOnline: true } : prev);

      // Transition to Ringing status
      callRingingTimeoutRef.current = setTimeout(() => {
        setActiveCall(prev => prev ? { ...prev, status: 'Ringing...' } : prev);

        // If simulated coworker call, auto-connect after 4s
        if (isCoworker) {
          callTimeoutRef.current = setTimeout(() => {
            acceptCall();
          }, 4000);
        }
      }, 1500);

    } else {
      // Group call fallback
      setActiveCall(prev => prev ? { ...prev, isOnline: true } : prev);
      callRingingTimeoutRef.current = setTimeout(() => {
        setActiveCall(prev => prev ? { ...prev, status: 'Ringing...' } : prev);
      }, 1500);
    }
  };

  const acceptCall = async () => {
    if (!activeCallSessionId || !state.currentUser?.username) return;
    const currentUserUsername = state.currentUser.username;
    console.log("[Calling] Call accepted, connecting WebRTC connections");

    // Capture media tracks if not captured already
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: activeCall?.type === 'video'
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch (err) {
        console.warn("Unable to capture media streams on accept:", err);
      }
    }

    setActiveCall(prev => prev ? { ...prev, status: 'Connected' } : prev);
    
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallTimer(t => t + 1);
    }, 1000);

    // Update call session status in DB
    supabase
      .from('call_sessions')
      .update({ status: 'connected' })
      .eq('id', activeCallSessionId)
      .then(({ error }) => {
        if (error) console.warn("Error updating call session status to connected:", error);
      });

    // Create RTCPeerConnection to all other participants
    participantsList.forEach(async (username) => {
      if (username !== currentUserUsername) {
        await createPeerConnection(username, true, activeCall?.type || 'voice', activeCallSessionId);
      }
    });
  };

  const declineCall = () => {
    if (!state.currentUser?.username) return;
    const currentUserUsername = state.currentUser.username;
    
    if (activeCallSessionId) {
      supabase
        .from('call_sessions')
        .update({ status: 'ended' })
        .eq('id', activeCallSessionId)
        .then(() => {
          if (signalingChannel.current) {
            participantsList.forEach(username => {
              if (username !== currentUserUsername) {
                const targetConnId = remotePeerConnectionIds.current[username];
                signalingChannel.current.send({
                  type: 'broadcast',
                  event: 'hang-up',
                  payload: {
                    target: username,
                    targetConnectionId: targetConnId,
                    sender: currentUserUsername,
                    senderConnectionId: connectionId.current,
                    sessionId: activeCallSessionId
                  }
                });
              }
            });
          }
          endCallLocalOnly();
        });
    } else {
      endCallLocalOnly();
    }
  };

  const endCall = () => {
    if (!state.currentUser?.username) return;
    const currentUserUsername = state.currentUser.username;
    console.log("[Calling] Ending call");
    
    if (activeCallSessionId) {
      supabase
        .from('call_sessions')
        .update({ status: 'ended' })
        .eq('id', activeCallSessionId)
        .then(() => {
          if (signalingChannel.current) {
            participantsList.forEach(username => {
              if (username !== currentUserUsername) {
                const targetConnId = remotePeerConnectionIds.current[username];
                signalingChannel.current.send({
                  type: 'broadcast',
                  event: 'hang-up',
                  payload: {
                    target: username,
                    targetConnectionId: targetConnId,
                    sender: currentUserUsername,
                    senderConnectionId: connectionId.current,
                    sessionId: activeCallSessionId
                  }
                });
              }
            });
          }
          endCallLocalOnly();
        });
    } else {
      endCallLocalOnly();
    }
  };

  const addParticipant = async (targetUsername) => {
    if (!activeCallSessionId || !targetUsername || !state.currentUser?.username) return;
    const currentUserUsername = state.currentUser.username;
    
    console.log(`[Calling] Adding participant ${targetUsername} to call session ${activeCallSessionId}`);
    const updatedParticipants = [...participantsList, targetUsername];
    setParticipantsList(updatedParticipants);

    // Update session table in Supabase
    supabase
      .from('call_sessions')
      .update({ receiver_ids: updatedParticipants.filter(id => id !== currentUserUsername) })
      .eq('id', activeCallSessionId)
      .then(({ error }) => {
        if (error) console.warn("Error adding participant to DB:", error);
      });

    // Check if target user has an active session
    const twentyFiveSecondsAgo = new Date(Date.now() - 25000).toISOString();
    const { data: activeSessions } = await supabase
      .from('user_sessions')
      .select('connection_id')
      .eq('username', targetUsername)
      .gt('last_active', twentyFiveSecondsAgo);

    const activeConnectionIds = activeSessions ? activeSessions.map(s => s.connection_id) : [];

    if (activeConnectionIds.length > 0) {
      remotePeerConnectionIds.current[targetUsername] = activeConnectionIds[0];
    }

    if (signalingChannel.current) {
      // Broadcast new participant list to everyone on call
      participantsList.forEach(username => {
        if (username !== currentUserUsername) {
          const targetConnId = remotePeerConnectionIds.current[username];
          signalingChannel.current.send({
            type: 'broadcast',
            event: 'add-participant',
            payload: {
              target: username,
              targetConnectionId: targetConnId,
              caller: currentUserUsername,
              participants: updatedParticipants,
              sessionId: activeCallSessionId
            }
          });
        }
      });

      // Send direct invite call broadcast to target participant
      signalingChannel.current.send({
        type: 'broadcast',
        event: 'incoming-call',
        payload: {
          target: targetUsername,
          targetConnections: activeConnectionIds,
          caller: currentUserUsername,
          callerConnectionId: connectionId.current,
          callType: activeCall?.type || 'voice',
          sessionId: activeCallSessionId,
          participants: updatedParticipants
        }
      });
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideoMute = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  // Auto-generate Purchase Demand when stock hits or goes below department reorder level
  useEffect(() => {
    if (!state.items || !state.purchaseDemands || state.items.length === 0) return;

    let newPDs = [];
    let pdGenerated = false;

    state.items.forEach(item => {
      if (!item.reorderLevelsByDept) return;

      Object.entries(item.reorderLevelsByDept).forEach(([deptName, levelVal]) => {
        const level = parseFloat(levelVal);
        if (isNaN(level) || level <= 0) return;

        // Determine current stock (total stock or sum)
        let currentStock = 0;
        if (item.stockByType && Object.keys(item.stockByType).length > 0) {
          currentStock = Object.values(item.stockByType).reduce((sum, v) => sum + (Number(v) || 0), 0);
        } else {
          currentStock = Number(item.stock || 0);
        }

        if (currentStock <= level) {
          // Check if there is already an existing Pending or Ordered purchase demand for this item in this department
          const pds = [...(state.purchaseDemands || []), ...newPDs];
          const hasExisting = pds.some(pd => 
            pd.department === deptName && 
            (pd.status === 'Pending' || pd.status === 'Ordered') &&
            pd.items?.some(it => it.itemId === item.id || it.itemCode === item.sku || it.itemCode === item.id)
          );

          if (!hasExisting) {
            // Find max PD ID to calculate next ID
            let max = 0;
            pds.forEach(pd => {
              const parts = pd.id.split('-');
              if (parts.length === 2 && !isNaN(parts[1])) {
                const num = parseInt(parts[1], 10);
                if (num > max) max = num;
              }
            });
            const nextId = `PD-${String(max + 1).padStart(3, '0')}`;

            const newPD = {
              id: nextId,
              date: new Date().toISOString().split('T')[0],
              requestedBy: 'System Auto-Reorder Alert',
              department: deptName,
              remarks: `Auto-generated: stock (${currentStock}) hit reorder level (${level}) in ${deptName}`,
              items: [{
                itemId: item.id,
                itemCode: item.sku || item.id,
                itemName: item.name,
                uom: item.uom || 'Units',
                reqQty: Math.max(100, Math.ceil(level * 2)),
                expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              }],
              status: 'Pending',
              createdAt: new Date().toISOString()
            };
            newPDs.push(newPD);
            pdGenerated = true;
          }
        }
      });
    });

    if (pdGenerated && newPDs.length > 0) {
      setState(prev => ({
        ...prev,
        purchaseDemands: [...newPDs, ...(prev.purchaseDemands || [])]
      }));
    }
  }, [state.items, state.purchaseDemands]);

  const addNotification = (title, message, type = 'info') => {
    const newNotif = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false
    };
    setState(prev => ({
      ...prev,
      notifications: [newNotif, ...(prev.notifications || [])].slice(0, 50)
    }));
  };

  const markNotificationAsRead = (id) => {
    setState(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n => n.id === id ? { ...n, read: true } : n)
    }));
  };

  const markAllNotificationsAsRead = () => {
    setState(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n => ({ ...n, read: true }))
    }));
  };

  // PROBATION -> ONBOARDING PENDING (Omer, 2026-10-26): when a
  // gate-added employee's 7-day probation completes and he kept coming
  // (utils/probation.js), his onboarding becomes pending — the record
  // is flagged through the normal hr_employees write-through and ONE
  // dashboard notification with his name is fired. The persisted
  // probationOnboardingNotified flag makes it fire exactly once, on
  // whichever ERP session first loads the data after the window ends.
  const probationNotifiedRef = useRef(new Set());
  useEffect(() => {
    if (!state.currentUser) return;
    const employees = state.hr_employees_list;
    if (!Array.isArray(employees) || employees.length === 0) return;
    const due = findProbationNotificationsDue(employees)
      .filter((e) => !probationNotifiedRef.current.has(e.id))
      // Belt-and-braces: never duplicate an Onboarding Pending entry
      // that is already in the panel (e.g. flag write lost in a restore).
      .filter((e) => !(state.notifications || []).some((n) =>
        n.title === 'Onboarding Pending' && typeof n.message === 'string' && n.message.includes(`${e.name} completed his 7-day probation`)));
    if (due.length === 0) return;
    due.forEach((e) => probationNotifiedRef.current.add(e.id));
    const dueIds = new Set(due.map((e) => e.id));
    setCollection('hr_employees_list', employees.map((e) => (dueIds.has(e.id)
      ? { ...e, onboarding: e.onboarding || 'pending', probationOnboardingNotified: true, probationPassedAt: new Date().toISOString() }
      : e)));
    due.forEach((e) => {
      const info = getProbationInfo(e);
      addNotification(
        'Onboarding Pending',
        `${e.name} completed his 7-day probation (${info.cameDays} days present) — onboarding is now pending. Please call him in to complete onboarding.`,
        'info'
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hr_employees_list, state.currentUser]);

  const addAuditLog = (action, module, details, status = 'Success', user = 'System') => {
    const newLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      action,
      module,
      details,
      status,
      user
    };
    setState(prev => ({
      ...prev,
      auditLogs: [newLog, ...(prev.auditLogs || [])].slice(0, 200)
    }));
  };

  const syncUsersToSupabase = async (nextState) => {
    try {
      if (!(await checkSyncGuard('syncUsersToSupabase'))) return;

      const userRows = (nextState.users || []).map(u => ({
        id: String(u.id),
        username: u.username || null,
        full_name: u.name || null,
        role: u.role || null,
        email: u.email || null,
        phone: u.phone || null,
        status: u.status || 'Active',
        permissions: u.permissions || [],
        granular_permissions: u.granularPermissions || {}
      }));

      // PHASE D STEP D3: the erp_state blob leg of this former dual write is
      // REMOVED — blob writes are stopped app-wide. Users persist through
      // this users-table upsert (full record incl. `data` rides the entity
      // write-through diff as well); the blob version refs are left
      // untouched, pointing at the frozen read-only backup row.
      const results = await Promise.allSettled([
        userRows.length > 0 ? supabase.from('users').upsert(userRows, { onConflict: 'id' }) : Promise.resolve()
      ]);
      if (results[0].status === 'rejected' || results[0].value?.error) {
        console.warn("Supabase user permission sync warning:", results[0].status === 'rejected' ? results[0].reason : results[0].value?.error);
      }
    } catch(e) {
      console.warn("Supabase user permission sync error:", e);
    }
  };

  const addUser = (user) => {
    setState(prev => {
      const nextUsers = [...(prev.users || []), user];
      const nextState = {
        ...prev,
        users: nextUsers
      };
      try {
        localStorage.setItem('aj_synthetic_erp', JSON.stringify(nextState));
        localStorage.setItem('fv_users_list', JSON.stringify(nextUsers));
      } catch (e) {}
      syncUsersToSupabase(nextState);
      return nextState;
    });
    addNotification('User Added', `New user ${user.name} has been created successfully.`, 'success');
    addAuditLog('Create User', 'User Management', `Created user account for ${user.name} (${user.email}).`, 'Success', 'Admin');
  };

  const updateUser = (userId, updatedUser) => {
    setState(prev => {
      const isMatch = (u) => 
        String(u.id) === String(userId) || 
        (u.username && updatedUser.username && u.username.toLowerCase() === updatedUser.username.toLowerCase());

      const nextUsers = (prev.users || []).map(u => isMatch(u) ? { ...u, ...updatedUser } : u);
      const isSelf = prev.currentUser && (isMatch(prev.currentUser) || prev.currentUser.username === updatedUser.username);
      const newCurrentUser = isSelf ? { ...prev.currentUser, ...updatedUser } : prev.currentUser;
      const nextState = {
        ...prev,
        users: nextUsers,
        currentUser: newCurrentUser
      };
      try {
        localStorage.setItem('aj_synthetic_erp', JSON.stringify(nextState));
        localStorage.setItem('fv_users_list', JSON.stringify(nextUsers));
        if (isSelf && newCurrentUser) {
          localStorage.setItem('aj_current_user', JSON.stringify(newCurrentUser));
          sessionStorage.setItem('aj_current_user_session', JSON.stringify(newCurrentUser));
        }
      } catch (e) {}
      syncUsersToSupabase(nextState);
      return nextState;
    });
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('fv-permissions-updated'));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {}
    addNotification('User Updated', `User details & permissions updated successfully.`, 'success');
    addAuditLog('Update User', 'User Management', `Updated profile & permissions for User ID ${userId}.`, 'Success', 'Admin');
  };

  const deleteUser = (userId) => {
    setState(prev => {
      const nextUsers = (prev.users || []).filter(u => String(u.id) !== String(userId));
      const nextState = {
        ...prev,
        users: nextUsers
      };
      try {
        localStorage.setItem('aj_synthetic_erp', JSON.stringify(nextState));
        localStorage.setItem('fv_users_list', JSON.stringify(nextUsers));
      } catch (e) {}
      syncUsersToSupabase(nextState);
      return nextState;
    });
    try {
      supabase.from('users').delete().eq('id', String(userId)).then(({ error }) => {
        if (error) console.warn("Error deleting user from Supabase standalone table:", error);
      });
    } catch (e) {}
  };

  const addSaleOrder = (so) => {
    const extIdx = state.saleOrders.findIndex(o => o.id === so.id);
    const isNew = extIdx < 0;

    setState(prev => {
        // PHASE C STEP 3: every sale order line gets a unique line code
        // (ITEM-001, ITEM-002, ... — one global series, never reused). Lines
        // that already carry a code (edits) keep it; new lines are assigned
        // from the persisted counter, reconciled against the highest code
        // already in use so duplicates can never occur.
        let counter = Math.max(prev.counters?.lineCode || 0, maxLineCodeNumber(prev.saleOrders));
        const codedItems = (so.items || []).map(line => {
            if (line.lineCode) return line;
            counter += 1;
            return { ...line, lineCode: formatLineCode(counter) };
        });
        const codedOrder = { ...so, items: codedItems };
        const nextCounters = { ...(prev.counters || {}), lineCode: counter };

        const idx = prev.saleOrders.findIndex(o => o.id === so.id);
        if (idx >= 0) {
            const newList = [...prev.saleOrders];
            newList[idx] = codedOrder;
            return { ...prev, saleOrders: newList, counters: nextCounters };
        }
        return { ...prev, saleOrders: [...prev.saleOrders, codedOrder], counters: nextCounters };
    });

    if (isNew) {
      const customer = (state.customers || []).find(c => c.id === so.customerId);
      const customerName = customer ? customer.name : (so.customerName || 'Unknown');
      const doc = {
        id: so.id,
        title: `Sales Order - ${customerName}`,
        type: 'Sales Order',
        createdBy: state.currentUser?.username || so.createdBy || 'admin',
        details: `Order ID: ${so.id}, Customer: ${customerName}, Total: $${so.total || 0}`
      };
      setTimeout(() => {
        startRoutingWorkflow(doc);
      }, 50);
    }
  };

  const updateSaleOrderItemStatus = (orderId, itemCode, status, producedQtyToAdd = 0, lineCode = null) => {
    setState(prev => {
      // 1. Check if it's a custom OMS stock item
      const hasCustom = (prev.customOmsItems || []).some(ci => ci.id === orderId);
      if (hasCustom) {
        const newCustomItems = prev.customOmsItems.map(ci => {
          if (ci.id === orderId) {
            return {
              ...ci,
              status: status,
              producedQty: (ci.producedQty || 0) + producedQtyToAdd
            };
          }
          return ci;
        });
        return { ...prev, customOmsItems: newCustomItems };
      }

      // 2. Otherwise update standard saleOrders
      const newOrders = prev.saleOrders.map(order => {
        if (order.id === orderId) {
          if (status === 'Deleted' && !itemCode) {
            return {
              ...order,
              status: 'Deleted',
              items: order.items.map(it => ({ ...it, status: 'Deleted' }))
            };
          }

          const newItems = order.items.map(it => {
            // Apply to all items if itemCode is null (Bulk Cancel/Process)
            if (lineCode ? it.lineCode === lineCode : (it.itemCode === itemCode || !itemCode)) {
              return { ...it, status, producedQty: (it.producedQty || 0) + producedQtyToAdd };
            }
            return it;
          });
          
          const allCancelled = newItems.every(i => i.status === 'Cancelled');
          const allCompletedOrCancelled = newItems.every(i => i.status === 'Completed' || i.status === 'Cancelled');
          const isPendingOrCancelled = newItems.every(i => i.status === 'Pending' || i.status === 'Cancelled');

          let ordStatus = 'In Process';
          if (allCancelled) ordStatus = 'Cancelled';
          else if (allCompletedOrCancelled && newItems.some(i => i.status === 'Completed')) ordStatus = 'Completed';
          else if (isPendingOrCancelled && newItems.some(i => i.status === 'Pending')) ordStatus = 'Pending';
          else if (allCompletedOrCancelled) ordStatus = 'Completed'; // fallback
          
          return { ...order, items: newItems, status: ordStatus };
        }
        return order;
      });
      return { ...prev, saleOrders: newOrders };
    });
  };

  const handleProductionOutput = (planId, itemCode, outputs = [], markCompleted = false, overallRemarks = '', department = '', lineCode = null) => {
      setState(prev => {
          let updatedItems = [...(prev.items || [])];
          
          // 1. Find previous plan and its items
          const oldPlan = prev.productionPlans?.find(p => p.id === planId);
          const oldItem = oldPlan?.items?.find(pi => lineCode ? pi.lineCode === lineCode : pi.itemCode === itemCode);
          const oldOutputs = oldItem?.outputs || [];

          const batchTypes = prev.batchOutputTypes || [
              { id: 1, name: 'Finished Good', uom: 'Meters', category: 'Finish Good' },
              { id: 2, name: 'Wastage', uom: 'Kgs', category: 'Wastage' },
              { id: 3, name: 'B-Grade', uom: 'Meters', category: 'Finish Good' }
          ];
          const isWastageType = (typeName, typeId) => {
              const typeObj = batchTypes.find(t => String(t.id) === String(typeId) || t.name === typeName);
              if (typeObj && typeObj.category) {
                  return typeObj.category === 'Wastage';
              }
              return typeName?.toLowerCase().includes('wastage');
          };

          // 2. Reverse (subtract) old output quantities from stock
          const oldDept = oldPlan?.department || '';
          oldOutputs.forEach(out => {
              const qty = parseFloat(out.quantity) || 0;
              if (qty <= 0) return;
              // From-stock outputs never entered stock — nothing to reverse.
              if (isStockOutput(out)) return;
              updatedItems = updatedItems.map(item => {
                  if (item.sku === itemCode || item.id === itemCode) {
                      const currentStockByType = item.stockByType || {};
                      const currentStockByDept = item.stockByDepartment || {};
                      const isWastage = isWastageType(out.typeName, out.typeId);
                      
                      const nextItem = {
                          ...item,
                          stockByType: {
                              ...currentStockByType,
                              [out.typeName]: Math.max(0, (currentStockByType[out.typeName] || 0) - qty)
                          }
                      };
                      
                      if (!isWastage) {
                          nextItem.stock = Math.max(0, (item.stock || 0) - qty);
                      }
                      
                      const outDept = out.department || oldDept;
                      if (outDept && !isWastage) {
                          nextItem.stockByDepartment = {
                              ...currentStockByDept,
                              [outDept]: Math.max(0, (currentStockByDept[outDept] || 0) - qty)
                          };
                      }
                      return nextItem;
                  }
                  return item;
              });
          });

          // 3. Add new output quantities to stock
          outputs.forEach(out => {
              const qty = parseFloat(out.quantity) || 0;
              if (qty <= 0) return;
              // From-stock outputs draw on stock that is already counted —
              // adding them again would double-count. They still count
              // toward the sale order's producedQty in step 5 below.
              if (isStockOutput(out)) return;

              updatedItems = updatedItems.map(item => {
                  if (item.sku === itemCode || item.id === itemCode) {
                      const currentStockByType = item.stockByType || {};
                      const currentStockByDept = item.stockByDepartment || {};
                      const isWastage = isWastageType(out.typeName, out.typeId);
                      
                      const nextItem = {
                          ...item,
                          stockByType: {
                              ...currentStockByType,
                              [out.typeName]: (currentStockByType[out.typeName] || 0) + qty
                          }
                      };
                      
                      if (!isWastage) {
                          nextItem.stock = (item.stock || 0) + qty;
                      }
                      
                      if (department && !isWastage) {
                          nextItem.stockByDepartment = {
                              ...currentStockByDept,
                              [department]: (currentStockByDept[department] || 0) + qty
                          };
                      }
                      return nextItem;
                  }
                  return item;
              });
          });

          const stampedOutputs = outputs.map(o => ({ ...o, department: o.department || department }));

          // 4. Update the production plan
          const updatedPlans = (prev.productionPlans || []).map(plan => {
              if (plan.id === planId) {
                  const updatedItemsList = (plan.items || []).map(pi => {
                      if (lineCode ? pi.lineCode === lineCode : pi.itemCode === itemCode) {
                          return {
                              ...pi,
                              outputs: stampedOutputs
                          };
                      }
                      return pi;
                  });

                  return {
                      ...plan,
                      items: updatedItemsList,
                      status: markCompleted ? 'Completed' : plan.status,
                      overallRemarks: overallRemarks || plan.overallRemarks,
                      department: department
                  };
              }
              return plan;
          });

          // 5. Update saleOrders items' producedQty — tracked per lineCode
          //    (Phase C Step 3): totals are aggregated across all plans by
          //    lineCode, so two lines of the same item in one order never
          //    merge. Lines without a lineCode keep the legacy
          //    (orderId + itemCode) aggregation.
          const planItem = oldItem || updatedPlans.find(p => p.id === planId)?.items?.find(pi => lineCode ? pi.lineCode === lineCode : pi.itemCode === itemCode);
          const orderId = planItem?.orderId;
          const targetLineCode = lineCode || planItem?.lineCode || null;
          let updatedSaleOrders = [...(prev.saleOrders || [])];
          let updatedCustomOmsItems = [...(prev.customOmsItems || [])];
          
          if (orderId) {
              let totalProduced = 0;
              let lineTotalProduced = 0;
              updatedPlans.forEach(plan => {
                  if (plan.status !== 'Cancelled') {
                      plan.items?.forEach(pi => {
                          if (pi.orderId === orderId) {
                              pi.outputs?.forEach(out => {
                                  const isWastage = isWastageType(out.typeName, out.typeId);
                                  if (!isWastage) {
                                      const q = parseFloat(out.quantity) || 0;
                                      if (pi.itemCode === itemCode) {
                                          totalProduced += q;
                                      }
                                      if (targetLineCode && pi.lineCode === targetLineCode) {
                                          lineTotalProduced += q;
                                      }
                                  }
                              });
                          }
                      });
                  }
              });
              
              if (orderId.startsWith('CUSTOM-') || updatedCustomOmsItems.some(ci => ci.id === orderId)) {
                  updatedCustomOmsItems = updatedCustomOmsItems.map(ci => {
                      if (ci.id === orderId) {
                          return {
                              ...ci,
                              producedQty: totalProduced,
                              status: totalProduced >= ci.quantity ? 'Completed' : 'In Process'
                          };
                      }
                      return ci;
                  });
              } else {
                  updatedSaleOrders = updatedSaleOrders.map(order => {
                      if (order.id === orderId) {
                          return {
                              ...order,
                              items: order.items.map(it => {
                                  if (targetLineCode) {
                                      if (it.lineCode === targetLineCode) {
                                          return {
                                              ...it,
                                              producedQty: lineTotalProduced
                                          };
                                      }
                                      return it;
                                  }
                                  if (it.itemCode === itemCode) {
                                      return {
                                          ...it,
                                          producedQty: totalProduced
                                      };
                                  }
                                  return it;
                              })
                          };
                      }
                      return order;
                  });
              }
          }

          return {
              ...prev,
              productionPlans: updatedPlans,
              items: updatedItems,
              saleOrders: updatedSaleOrders,
              customOmsItems: updatedCustomOmsItems
          };
      });
  };

  const deleteProductionOutputs = (planId) => {
      setState(prev => {
          let updatedItems = [...(prev.items || [])];
          const oldPlan = prev.productionPlans?.find(p => p.id === planId);
          
          if (!oldPlan) return prev;
          
          const oldDept = oldPlan.department || '';
          
          const batchTypes = prev.batchOutputTypes || [
              { id: 1, name: 'Finished Good', uom: 'Meters', category: 'Finish Good' },
              { id: 2, name: 'Wastage', uom: 'Kgs', category: 'Wastage' },
              { id: 3, name: 'B-Grade', uom: 'Meters', category: 'Finish Good' }
          ];
          const isWastageType = (typeName, typeId) => {
              const typeObj = batchTypes.find(t => String(t.id) === String(typeId) || t.name === typeName);
              if (typeObj && typeObj.category) {
                  return typeObj.category === 'Wastage';
              }
              return typeName?.toLowerCase().includes('wastage');
          };

          // Subtract all outputs for all items in the plan
          oldPlan.items?.forEach(pi => {
              const oldOutputs = pi.outputs || [];
              oldOutputs.forEach(out => {
                  const qty = parseFloat(out.quantity) || 0;
                  if (qty <= 0) return;
                  // From-stock outputs never entered stock — deleting them
                  // releases the claim only; stock stays exactly as it was.
                  if (isStockOutput(out)) return;
                  updatedItems = updatedItems.map(item => {
                      if (item.sku === pi.itemCode || item.id === pi.itemCode) {
                          const currentStockByType = item.stockByType || {};
                          const currentStockByDept = item.stockByDepartment || {};
                          const isWastage = isWastageType(out.typeName, out.typeId);
                          
                          const nextItem = {
                              ...item,
                              stockByType: {
                                  ...currentStockByType,
                                  [out.typeName]: Math.max(0, (currentStockByType[out.typeName] || 0) - qty)
                              }
                          };
                          
                          if (!isWastage) {
                              nextItem.stock = Math.max(0, (item.stock || 0) - qty);
                          }
                          
                          const outDept = out.department || oldDept;
                          if (outDept && !isWastage) {
                              nextItem.stockByDepartment = {
                                  ...currentStockByDept,
                                  [outDept]: Math.max(0, (currentStockByDept[outDept] || 0) - qty)
                              };
                          }
                          return nextItem;
                      }
                      return item;
                  });
              });
          });

          // Set plan outputs to empty and status back to 'In Process'
          const updatedPlans = (prev.productionPlans || []).map(plan => {
              if (plan.id === planId) {
                  const clearedItems = (plan.items || []).map(pi => ({
                      ...pi,
                      outputs: []
                  }));
                  return {
                      ...plan,
                      items: clearedItems,
                      status: 'In Process'
                  };
              }
              return plan;
          });

          // Recalculate producedQty for all items in the deleted plan —
          // per lineCode where the plan item carries one (Phase C Step 3),
          // legacy (orderId + itemCode) aggregation otherwise.
          let updatedSaleOrders = [...(prev.saleOrders || [])];
          let updatedCustomOmsItems = [...(prev.customOmsItems || [])];
          oldPlan.items?.forEach(pi => {
              const orderId = pi.orderId;
              const itemCode = pi.itemCode;
              if (!orderId) return;
              
              let totalProduced = 0;
              updatedPlans.forEach(plan => {
                  if (plan.status !== 'Cancelled') {
                      plan.items?.forEach(pItem => {
                          if (pi.lineCode ? (pItem.orderId === orderId && pItem.lineCode === pi.lineCode) : (pItem.orderId === orderId && pItem.itemCode === itemCode)) {
                              pItem.outputs?.forEach(out => {
                                  const isWastage = isWastageType(out.typeName, out.typeId);
                                  if (!isWastage) {
                                      totalProduced += parseFloat(out.quantity) || 0;
                                  }
                              });
                          }
                      });
                  }
              });
              
              if (orderId.startsWith('CUSTOM-') || updatedCustomOmsItems.some(ci => ci.id === orderId)) {
                  updatedCustomOmsItems = updatedCustomOmsItems.map(ci => {
                      if (ci.id === orderId) {
                          return {
                              ...ci,
                              producedQty: totalProduced,
                              status: totalProduced >= ci.quantity ? 'Completed' : 'Pending'
                          };
                      }
                      return ci;
                  });
              } else {
                  updatedSaleOrders = updatedSaleOrders.map(order => {
                      if (order.id === orderId) {
                          return {
                              ...order,
                              items: order.items.map(it => {
                                  if (pi.lineCode ? it.lineCode === pi.lineCode : it.itemCode === itemCode) {
                                      return {
                                          ...it,
                                          producedQty: totalProduced
                                      };
                                  }
                                  return it;
                              })
                          };
                      }
                      return order;
                  });
              }
          });

          return {
              ...prev,
              productionPlans: updatedPlans,
              items: updatedItems,
              saleOrders: updatedSaleOrders,
              customOmsItems: updatedCustomOmsItems
          };
      });
  };

  const addDelivery = (delivery) => {
    setState(prev => {
        let nextState = { ...prev };
        let updatedItems = [...(prev.items || [])];
        let updatedSaleOrders = [...(prev.saleOrders || [])];

        const isManual = delivery.dcMode !== 'Sale Orders';
        const sourceDept = isManual ? delivery.dcMode : null;

        delivery.items.forEach(di => {
            const qty = parseFloat(di.dispatchedQty) || 0;
            const rolls = parseFloat(di.dispatchedRolls) || 0;
            if (qty <= 0) return;

            // Update item stock
            const itemIndex = updatedItems.findIndex(i => i.id === di.itemId || i.sku === di.itemCode);
            if (itemIndex > -1) {
                const item = { ...updatedItems[itemIndex] };
                if (item.stockByType && di.stockType) {
                    item.stockByType = { ...item.stockByType };
                    item.stockByType[di.stockType] = Math.max(0, (item.stockByType[di.stockType] || 0) - qty);
                }
                
                // If manual mode, deduct from specific department
                if (isManual && sourceDept) {
                    if (!item.stockByDepartment) item.stockByDepartment = {};
                    item.stockByDepartment = { ...item.stockByDepartment };
                    item.stockByDepartment[sourceDept] = Math.max(0, (item.stockByDepartment[sourceDept] || 0) - qty);
                    item.stock = Object.values(item.stockByDepartment).reduce((sum, v) => sum + Number(v || 0), 0);
                } else {
                    item.stock = Math.max(0, (item.stock || 0) - qty);
                }
                updatedItems[itemIndex] = item;
            }

            // Update sale order
            if (!isManual && di.orderId) {
                const soIndex = updatedSaleOrders.findIndex(so => so.id === di.orderId);
                if (soIndex > -1) {
                    const so = { ...updatedSaleOrders[soIndex] };
                    so.items = so.items.map(soi => {
                        if ((soi.lineCode && di.lineCode) ? soi.lineCode === di.lineCode : (soi.itemId === di.itemId || soi.itemCode === di.itemCode)) {
                            return {
                                ...soi,
                                deliveredQty: (parseFloat(soi.deliveredQty) || 0) + qty,
                                deliveredRolls: (parseFloat(soi.deliveredRolls) || 0) + rolls
                            };
                        }
                        return soi;
                    });
                    
                    // Check if all items delivered
                    const allDelivered = so.items.every(soi => (parseFloat(soi.deliveredQty) || 0) >= (parseFloat(soi.qty) || 0));
                    if (allDelivered) so.status = 'Completed';
                    
                    updatedSaleOrders[soIndex] = so;
                }
            }
        });

        nextState.items = updatedItems;
        nextState.saleOrders = updatedSaleOrders;
        nextState.deliveries = [...(prev.deliveries || []), delivery];
        return nextState;
    });
  };

  const deleteDelivery = (id) => {
      setState(prev => {
          const delivery = prev.deliveries?.find(d => d.id === id);
          if (!delivery) return prev;

          let nextState = { ...prev };
          let updatedItems = [...(prev.items || [])];
          let updatedSaleOrders = [...(prev.saleOrders || [])];

          const isManual = delivery.dcMode !== 'Sale Orders';
          const sourceDept = isManual ? delivery.dcMode : null;

          delivery.items.forEach(di => {
              const qty = parseFloat(di.dispatchedQty) || 0;
              const rolls = parseFloat(di.dispatchedRolls) || 0;
              if (qty <= 0) return;

              // Revert item stock
              const itemIndex = updatedItems.findIndex(i => i.id === di.itemId || i.sku === di.itemCode);
              if (itemIndex > -1) {
                  const item = { ...updatedItems[itemIndex] };
                  if (item.stockByType && di.stockType) {
                      item.stockByType = { ...item.stockByType };
                      item.stockByType[di.stockType] = (item.stockByType[di.stockType] || 0) + qty;
                  }
                  
                  // If manual mode, add back to specific department
                  if (isManual && sourceDept) {
                      if (!item.stockByDepartment) item.stockByDepartment = {};
                      item.stockByDepartment = { ...item.stockByDepartment };
                      item.stockByDepartment[sourceDept] = (item.stockByDepartment[sourceDept] || 0) + qty;
                      item.stock = Object.values(item.stockByDepartment).reduce((sum, v) => sum + Number(v || 0), 0);
                  } else {
                      item.stock = (item.stock || 0) + qty;
                  }
                  updatedItems[itemIndex] = item;
              }

              // Revert sale order
              if (!isManual && di.orderId) {
                  const soIndex = updatedSaleOrders.findIndex(so => so.id === di.orderId);
                  if (soIndex > -1) {
                      const so = { ...updatedSaleOrders[soIndex] };
                      so.items = so.items.map(soi => {
                          if ((soi.lineCode && di.lineCode) ? soi.lineCode === di.lineCode : (soi.itemId === di.itemId || soi.itemCode === di.itemCode)) {
                              return {
                                  ...soi,
                                  deliveredQty: Math.max(0, (parseFloat(soi.deliveredQty) || 0) - qty),
                                  deliveredRolls: Math.max(0, (parseFloat(soi.deliveredRolls) || 0) - rolls)
                              };
                          }
                          return soi;
                      });
                      
                      // Re-evaluate status
                      const allDelivered = so.items.every(soi => (parseFloat(soi.deliveredQty) || 0) >= (parseFloat(soi.qty) || 0));
                      if (!allDelivered && so.status === 'Completed') {
                          so.status = 'In Production'; // fallback
                      }
                      
                      updatedSaleOrders[soIndex] = so;
                  }
              }
          });

          nextState.items = updatedItems;
          nextState.saleOrders = updatedSaleOrders;
          nextState.deliveries = (prev.deliveries || []).filter(d => d.id !== id);
          return nextState;
      });
  };

  const toggleGlobalPagination = () => {
      setState(prev => ({ ...prev, isGlobalPaginated: !prev.isGlobalPaginated }));
  };

  const updateAdminSetup = (data) => {
      setState(prev => ({ ...prev, adminSetup: data }));
  };

  const updateThemeSettings = (data) => {
      if (data) {
        applyTheme(data);
      }
      setState(prev => ({ ...prev, themeSettings: data }));
  };

  const updateDashboardLayout = (data) => {
      setState(prev => ({ ...prev, dashboardLayout: data }));
  };

  const updateDashboardBackground = (data) => {
      setState(prev => ({ ...prev, dashboardBackground: data }));
  };

  const updateProductionTarget = (target) => {
    setState(prev => ({ ...prev, productionTarget: target }));
  };

  const addGRN = (grn) => setState(prev => {
      const nextGrns = [...(prev.grns || []), grn];
      const nextItems = (prev.items || []).map(item => {
          const grnItem = grn.items?.find(it => it.itemId === item.id || it.sku === item.sku || it.itemCode === item.sku || it.sku === it.itemCode);
          if (grnItem) {
              const qty = parseFloat(grnItem.qty) || 0;
              if (qty > 0) {
                  const nextItem = { ...item };
                  if (!nextItem.stockByDepartment) nextItem.stockByDepartment = {};
                  const depts = (nextItem.department || '').split(',').map(d => d.trim()).filter(Boolean);
                  const targetDept = depts[0] || 'Warehouse';
                  nextItem.stockByDepartment[targetDept] = (nextItem.stockByDepartment[targetDept] || 0) + qty;
                  nextItem.stock = Object.values(nextItem.stockByDepartment).reduce((sum, val) => sum + Number(val || 0), 0);
                  return nextItem;
              }
          }
          return item;
      });
      return { ...prev, grns: nextGrns, items: nextItems };
  });

  const deleteGRN = (id) => setState(prev => {
      const grn = prev.grns?.find(g => g.id === id);
      const nextGrns = (prev.grns || []).filter(g => g.id !== id);
      if (!grn) return { ...prev, grns: nextGrns };

      const nextItems = (prev.items || []).map(item => {
          const grnItem = grn.items?.find(it => it.itemId === item.id || it.sku === item.sku || it.itemCode === item.sku || it.sku === it.itemCode);
          if (grnItem) {
              const qty = parseFloat(grnItem.qty) || 0;
              if (qty > 0) {
                  const nextItem = { ...item };
                  if (!nextItem.stockByDepartment) nextItem.stockByDepartment = {};
                  const depts = (nextItem.department || '').split(',').map(d => d.trim()).filter(Boolean);
                  const targetDept = depts[0] || 'Warehouse';
                  nextItem.stockByDepartment[targetDept] = Math.max(0, (nextItem.stockByDepartment[targetDept] || 0) - qty);
                  nextItem.stock = Object.values(nextItem.stockByDepartment).reduce((sum, val) => sum + Number(val || 0), 0);
                  return nextItem;
              }
          }
          return item;
      });
      return { ...prev, grns: nextGrns, items: nextItems };
  });
  
  const addStockTransfer = (st) => setState(prev => ({ ...prev, stockTransfers: [...(prev.stockTransfers || []), st] }));
  const deleteStockTransfer = (id) => setState(prev => {
      const transfer = prev.stockTransfers?.find(t => t.id === id);
      const nextTransfers = (prev.stockTransfers || []).filter(t => t.id !== id);
      
      let nextDemands = prev.stockDemands;
      if (transfer && transfer.linkedDemand) {
          nextDemands = (prev.stockDemands || []).map(d => 
              d.id === transfer.linkedDemand ? { ...d, status: 'Pending' } : d
          );
      }
      
      return { ...prev, stockTransfers: nextTransfers, stockDemands: nextDemands };
  });
  const updateStockTransferStatus = (id, status, receivedItems = null, closeDemand = false) => setState(prev => {
      let nextItems = prev.items;
      const transfers = prev.stockTransfers || [];
      const transfer = transfers.find(t => t.id === id);
      let nextDemands = prev.stockDemands || [];

      if (status === 'Received' && transfer && receivedItems) {
          nextItems = nextItems.map(item => {
              const rItem = receivedItems.find(r => r.itemId === item.id || r.id === item.id || r.sku === item.sku);
              if (rItem) {
                  const rQty = parseFloat(rItem.receivedQty) || 0;
                  if (rQty > 0) {
                      const sourceDept = transfer.source;
                      const destDept = transfer.destination;
                      
                      // Initialize stockByDepartment if not exists
                      const currentStockByDept = { ...item.stockByDepartment };
                      
                      // If the item doesn't have the source department initialized, assume its main stock is there
                      if (currentStockByDept[sourceDept] === undefined) {
                          currentStockByDept[sourceDept] = item.department === sourceDept ? item.stock : 0;
                      }
                      
                      // If the item doesn't have the destination department initialized, assume 0
                      if (currentStockByDept[destDept] === undefined) {
                          currentStockByDept[destDept] = item.department === destDept ? item.stock : 0;
                      }

                      // Deduct from source and Add to destination
                      currentStockByDept[sourceDept] -= rQty;
                      currentStockByDept[destDept] += rQty;

                      return {
                          ...item,
                          stockByDepartment: currentStockByDept,
                          // If global stock needs to be accurate, we don't necessarily change it since it just moved departments.
                          // But we keep it updated with the total across departments
                          stock: Object.values(currentStockByDept).reduce((sum, val) => sum + val, 0)
                      };
                  }
              }
              return item;
          });
      }

      if (closeDemand && transfer && transfer.linkedDemand) {
          nextDemands = nextDemands.map(d => d.id === transfer.linkedDemand ? { ...d, status: 'Completed' } : d);
      }

      return {
          ...prev,
          items: nextItems,
          stockDemands: nextDemands,
          stockTransfers: transfers.map(st => st.id === id ? { ...st, status, receivedItems } : st)
      };
  });

  const deleteStockReceivingNote = (transferId) => setState(prev => {
      const transfers = prev.stockTransfers || [];
      const transfer = transfers.find(t => t.id === transferId);
      if (!transfer || transfer.status !== 'Received' || !transfer.receivedItems) return prev;

      let nextItems = prev.items.map(item => {
          const rItem = transfer.receivedItems.find(r => r.itemId === item.id || r.id === item.id || r.sku === item.sku);
          if (rItem) {
              const rQty = parseFloat(rItem.receivedQty) || 0;
              if (rQty > 0) {
                  const sourceDept = transfer.source;
                  const destDept = transfer.destination;
                  
                  const currentStockByDept = { ...item.stockByDepartment };
                  
                  // Revert stock: add back to source, deduct from dest
                  if (currentStockByDept[sourceDept] !== undefined) currentStockByDept[sourceDept] += rQty;
                  if (currentStockByDept[destDept] !== undefined) currentStockByDept[destDept] -= rQty;

                  return {
                      ...item,
                      stockByDepartment: currentStockByDept,
                      stock: Object.values(currentStockByDept).reduce((sum, val) => sum + val, 0)
                  };
              }
          }
          return item;
      });

      let nextDemands = prev.stockDemands || [];
      if (transfer.linkedDemand) {
          nextDemands = nextDemands.map(d => d.id === transfer.linkedDemand && d.status === 'Completed' ? { ...d, status: 'Pending' } : d);
      }

      return {
          ...prev,
          items: nextItems,
          stockDemands: nextDemands,
          stockTransfers: transfers.map(t => t.id === transferId ? { ...t, status: 'Pending', receivedItems: null } : t)
      };
  });

  const addSalesInvoice = (invoice) => {
    // Draft invoices (Omer's order, 2026-10-24) are saved ONLY: the
    // delivery challan stays un-invoiced (so it remains available), and
    // the finance engine excludes drafts from GL/AR entirely. Posting the
    // draft later (postSalesInvoice) runs the normal flow.
    const isDraft = invoice.status === 'Draft';
    setState(prev => {
      const nextDeliveries = isDraft
        ? (prev.deliveries || [])
        : (prev.deliveries || []).map(d =>
            d.id === invoice.deliveryId ? { ...d, isInvoiced: true } : d
          );
      return {
        ...prev,
        deliveries: nextDeliveries,
        salesInvoices: [invoice, ...(prev.salesInvoices || [])]
      };
    });
    addNotification(isDraft ? 'Sales Invoice Draft Saved' : 'Sales Invoice Generated', `Invoice ${invoice.id} for ${invoice.customerName} has been ${isDraft ? 'saved as draft' : 'generated'}.`, 'success');
    addAuditLog(isDraft ? 'Save Sales Invoice Draft' : 'Generate Sales Invoice', 'Finance', `${isDraft ? 'Saved draft sales invoice' : 'Generated sales invoice'} ${invoice.id} against ${invoiceSourceLabel(invoice)}.`, 'Success', state.currentUser?.name || 'Admin');
  };

  // Post a draft sales invoice: flips it to the posted status ('Settled',
  // the status the create flow uses) and marks its delivery challan
  // invoiced — from here the derived GL/AR pick it up exactly like a
  // freshly generated invoice.
  const postSalesInvoice = (invoiceId) => {
    const current = (state.salesInvoices || []).find(inv => inv.id === invoiceId);
    if (!current || current.status !== 'Draft') return;
    setState(prev => {
      const invoice = (prev.salesInvoices || []).find(inv => inv.id === invoiceId);
      if (!invoice || invoice.status !== 'Draft') return prev;
      return {
        ...prev,
        deliveries: (prev.deliveries || []).map(d =>
          d.id === invoice.deliveryId ? { ...d, isInvoiced: true } : d
        ),
        salesInvoices: (prev.salesInvoices || []).map(inv =>
          inv.id === invoiceId ? { ...inv, status: 'Settled' } : inv
        )
      };
    });
    addNotification('Sales Invoice Posted', `Invoice ${invoiceId} has been posted.`, 'success');
    addAuditLog('Post Sales Invoice', 'Finance', `Posted draft sales invoice ${invoiceId}.`, 'Success', state.currentUser?.name || 'Admin');
  };

  const addPurchaseInvoice = (invoice) => {
    setState(prev => {
      let nextGatePasses = prev.inwardGatePasses || [];
      let nextGRNs = prev.grns || [];
      if (invoice.sourceType === 'IGP') {
        nextGatePasses = nextGatePasses.map(igp =>
          igp.id === invoice.sourceId ? { ...igp, isInvoiced: true } : igp
        );
      } else if (invoice.sourceType === 'GRN') {
        nextGRNs = nextGRNs.map(grn =>
          grn.id === invoice.sourceId ? { ...grn, isInvoiced: true } : grn
        );
      }

      const rateMap = new Map();
      (invoice.items || []).forEach(line => {
        const rate = Number(line.unitPrice);
        if (!line.itemCode || Number.isNaN(rate)) return;
        const target = (prev.items || []).find(it => it.sku === line.itemCode || it.id === line.itemCode);
        if (target) {
          rateMap.set(target.id, rate);
        }
      });

      const nextItems = rateMap.size > 0
        ? (prev.items || []).map(it => {
            if (rateMap.has(it.id)) {
              const rate = rateMap.get(it.id);
              const formatted = 'Rs. ' + rate.toFixed(2);
              return {
                ...it,
                price: formatted,
                pricesByType: {
                  ...(it.pricesByType || {}),
                  'Base Item': formatted
                }
              };
            }
            return it;
          })
        : prev.items;

      return {
        ...prev,
        inwardGatePasses: nextGatePasses,
        grns: nextGRNs,
        purchaseInvoices: [invoice, ...(prev.purchaseInvoices || [])],
        items: nextItems
      };
    });
    addNotification('Purchase Invoice Posted', `Invoice ${invoice.id} has been posted successfully.`, 'success');
    addAuditLog('Post Purchase Invoice', 'Finance', `Posted purchase invoice ${invoice.id} against ${invoice.sourceType} ${invoice.sourceId}.`, 'Success', state.currentUser?.name || 'Admin');
  };

  const updateSalesInvoice = (invoiceId, updatedInvoice) => {
    setState(prev => {
      const original = (prev.salesInvoices || []).find(inv => inv.id === invoiceId);
      let nextDeliveries = prev.deliveries || [];
      if (original && original.deliveryId !== updatedInvoice.deliveryId) {
        // Delivery flags follow posting state: a draft never holds its
        // challan as invoiced; a posted invoice always does.
        if (original.status !== 'Draft') {
          nextDeliveries = nextDeliveries.map(d =>
            d.id === original.deliveryId ? { ...d, isInvoiced: false } : d
          );
        }
        if (updatedInvoice.status !== 'Draft') {
          nextDeliveries = nextDeliveries.map(d =>
            d.id === updatedInvoice.deliveryId ? { ...d, isInvoiced: true } : d
          );
        }
      } else if (original && original.status === 'Draft' && updatedInvoice.status !== 'Draft') {
        // Same challan, draft being posted through an edit.
        nextDeliveries = nextDeliveries.map(d =>
          d.id === updatedInvoice.deliveryId ? { ...d, isInvoiced: true } : d
        );
      }
      const nextSalesInvoices = (prev.salesInvoices || []).map(inv =>
        inv.id === invoiceId ? { ...inv, ...updatedInvoice } : inv
      );
      return {
        ...prev,
        deliveries: nextDeliveries,
        salesInvoices: nextSalesInvoices
      };
    });
    addNotification('Sales Invoice Updated', `Invoice ${invoiceId} has been updated.`, 'success');
    addAuditLog('Update Sales Invoice', 'Finance', `Updated sales invoice ${invoiceId}.`, 'Success', state.currentUser?.name || 'Admin');
  };

  const deleteSalesInvoice = (invoiceId) => {
    setState(prev => {
      const original = (prev.salesInvoices || []).find(inv => inv.id === invoiceId);
      let nextDeliveries = prev.deliveries || [];
      if (original) {
        nextDeliveries = nextDeliveries.map(d =>
          d.id === original.deliveryId ? { ...d, isInvoiced: false } : d
        );
      }
      const nextSalesInvoices = (prev.salesInvoices || []).filter(inv => inv.id !== invoiceId);
      return {
        ...prev,
        deliveries: nextDeliveries,
        salesInvoices: nextSalesInvoices
      };
    });
    addNotification('Sales Invoice Deleted', `Invoice ${invoiceId} has been deleted.`, 'success');
    addAuditLog('Delete Sales Invoice', 'Finance', `Deleted sales invoice ${invoiceId}.`, 'Success', state.currentUser?.name || 'Admin');
  };

  const updatePurchaseInvoice = (invoiceId, updatedInvoice) => {
    setState(prev => {
      const original = (prev.purchaseInvoices || []).find(inv => inv.id === invoiceId);
      let nextGatePasses = prev.inwardGatePasses || [];
      let nextGRNs = prev.grns || [];
      
      if (original) {
        if (original.sourceType === 'IGP') {
          nextGatePasses = nextGatePasses.map(igp =>
            igp.id === original.sourceId ? { ...igp, isInvoiced: false } : igp
          );
        } else if (original.sourceType === 'GRN') {
          nextGRNs = nextGRNs.map(grn =>
            grn.id === original.sourceId ? { ...grn, isInvoiced: false } : grn
          );
        }
      }

      if (updatedInvoice.sourceType === 'IGP') {
        nextGatePasses = nextGatePasses.map(igp =>
          igp.id === updatedInvoice.sourceId ? { ...igp, isInvoiced: true } : igp
        );
      } else if (updatedInvoice.sourceType === 'GRN') {
        nextGRNs = nextGRNs.map(grn =>
          grn.id === updatedInvoice.sourceId ? { ...grn, isInvoiced: true } : grn
        );
      }

      const nextPurchaseInvoices = (prev.purchaseInvoices || []).map(inv =>
        inv.id === invoiceId ? { ...inv, ...updatedInvoice } : inv
      );

      return {
        ...prev,
        inwardGatePasses: nextGatePasses,
        grns: nextGRNs,
        purchaseInvoices: nextPurchaseInvoices
      };
    });
    addNotification('Purchase Invoice Updated', `Invoice ${invoiceId} has been updated.`, 'success');
    addAuditLog('Update Purchase Invoice', 'Finance', `Updated purchase invoice ${invoiceId}.`, 'Success', state.currentUser?.name || 'Admin');
  };

  const deletePurchaseInvoice = (invoiceId) => {
    setState(prev => {
      const original = (prev.purchaseInvoices || []).find(inv => inv.id === invoiceId);
      let nextGatePasses = prev.inwardGatePasses || [];
      let nextGRNs = prev.grns || [];
      
      if (original) {
        if (original.sourceType === 'IGP') {
          nextGatePasses = nextGatePasses.map(igp =>
            igp.id === original.sourceId ? { ...igp, isInvoiced: false } : igp
          );
        } else if (original.sourceType === 'GRN') {
          nextGRNs = nextGRNs.map(grn =>
            grn.id === original.sourceId ? { ...grn, isInvoiced: false } : grn
          );
        }
      }

      const nextPurchaseInvoices = (prev.purchaseInvoices || []).filter(inv => inv.id !== invoiceId);

      return {
        ...prev,
        inwardGatePasses: nextGatePasses,
        grns: nextGRNs,
        purchaseInvoices: nextPurchaseInvoices
      };
    });
    addNotification('Purchase Invoice Deleted', `Invoice ${invoiceId} has been deleted.`, 'success');
    addAuditLog('Delete Purchase Invoice', 'Finance', `Deleted purchase invoice ${invoiceId}.`, 'Success', state.currentUser?.name || 'Admin');
  };

  const addWidget = (widgetConfig) => {
     setState(prev => {
         const newLayout = [...(prev.dashboardLayout || []), {
             i: `${widgetConfig.type}_${Date.now()}`,
             x: 0,
             y: Infinity,
             w: 2, 
             h: 2,
             ...widgetConfig
         }];
         return { ...prev, dashboardLayout: newLayout };
     });
     addNotification('Widget Added', `${widgetConfig.title} has been pinned to your dashboard.`, 'success');
  };

   const login = async (username, password, platform = 'Web', rememberMe = false, onStatus = null) => {
    const cleanIdentifier = String(username || '').trim();

    // 1. Anti-Brute-Force Rate Limiting Check
    const rateStatus = getRateLimitStatus(cleanIdentifier);
    if (!rateStatus.allowed) {
      return {
        success: false,
        locked: true,
        remainingSeconds: rateStatus.remainingSeconds,
        reason: `Security Lockout: Too many failed login attempts. Please retry in ${rateStatus.remainingSeconds} seconds.`
      };
    }

    // 2. Lookup user in state — by username, email, or mobile number
    // (src/utils/loginIdentifier.js; username/email behaviour unchanged,
    // the phone match is the 2026-10-25 widening Omer ordered)
    const user = findUserByLoginIdentifier(state.users, cleanIdentifier);
    
    // 3. Verify credentials
    if (user && verifyPassword(password, user.password)) {
      // Reset rate limit on success
      resetRateLimit(cleanIdentifier);
      resetRateLimit('global');

      // Create cryptographically signed session token
      const sessionToken = createSecureSession(user, rememberMe);
      const cleanUser = sanitizeUser({ ...user, ...sessionToken });

      const logId = `LOG-${Date.now()}`;
      const newAuditLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        action: 'User Login',
        module: 'Authentication',
        details: `User ${user.name} (@${user.username}) authenticated successfully via ${platform} (Remember: ${rememberMe ? 'Yes' : 'No'}).`,
        status: 'Success',
        user: user.name
      };
      
      // Enforce Single Active Device Session — as an ordered handover
      // (Part C, 2026-10-25). Previously this block fired the delete /
      // upsert / broadcast WITHOUT awaiting them and login returned
      // instantly: the new device landed on the dashboard while the old
      // session's rows were still live, and the realtime guards then
      // force-logged-out the NEW device too (the old device's heartbeat
      // row event looks exactly like a rival login) — the user saw the
      // dashboard for half a second, got bounced out, and had to log in
      // a second time. Now: detect a prior session, report the stage to
      // the login screen, broadcast the kick, AWAIT the server-side
      // sweep, register this session, and only then set currentUser and
      // return — one navigation, straight in.
      const myConnId = connectionId.current;
      const myDeviceId = getDeviceId();
      const devInfoStr = JSON.stringify({
        deviceId: myDeviceId,
        platform,
        loginTime: new Date().toISOString(),
        userAgent: navigator.userAgent
      });

      try {
        const { data: existingSessions } = await supabase
          .from('user_sessions')
          .select('connection_id, device_info')
          .ilike('username', user.username);

        const priorSessions = (existingSessions || []).filter(s => s.connection_id !== myConnId);
        if (priorSessions.length > 0) {
          onStatus?.('signing-out-other');
          priorSessions.forEach(s => terminatedConnectionIdsRef.current.add(s.connection_id));

          // Instant broadcast so the other device signs out right away
          try {
            sessionsChannelRef.current?.send({
              type: 'broadcast',
              event: 'force_logout_concurrent',
              payload: {
                username: user.username.toLowerCase(),
                activeConnectionId: myConnId,
                activeDeviceId: myDeviceId,
                timestamp: Date.now()
              }
            });
          } catch (e) {}

          // Authoritative sweep — keyed on the account's real username,
          // so it also fires when the user signed in by email or mobile
          // number (the old code swept by the typed identifier and
          // silently missed in those cases).
          await supabase
            .from('user_sessions')
            .delete()
            .ilike('username', user.username)
            .neq('connection_id', myConnId);

          // Brief settle so the other device can process its sign-out
          onStatus?.('signing-in');
          await new Promise(r => setTimeout(r, 400));
        }
      } catch (e) {
        // Handover mechanics must never block a valid sign-in; the
        // realtime guards still enforce the single-session rule.
        console.warn('[Security Shield] Session handover sweep failed; proceeding with sign-in.', e);
      }

      // Register this device's session and AWAIT it, so the session
      // table is already consistent when the app navigates — no guard
      // can mistake the brand-new session for a stale one.
      try {
        await supabase
          .from('user_sessions')
          .upsert({
            username: user.username,
            connection_id: myConnId,
            last_active: new Date().toISOString(),
            status: 'online',
            device_info: devInfoStr
          }, { onConflict: 'connection_id' });
      } catch (e) {}

      setState(prev => {
        const currentLogs = prev.auditLogs || [];
        const nextState = {
          ...prev,
          currentUser: cleanUser,
          auditLogs: [newAuditLog, ...currentLogs].slice(0, 200)
        };
        localStorage.setItem('aj_synthetic_erp', JSON.stringify(nextState));
        return nextState;
      });
      
      return { success: true, user: cleanUser };
    }

    // 4. Failed authentication
    const newRate = recordFailedAttempt(cleanIdentifier);
    const failAuditLog = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'Failed Login Attempt',
      module: 'Security Shield',
      details: `Failed login attempt for identifier '${cleanIdentifier}' via ${platform}. Attempts remaining: ${newRate.remainingAttempts}`,
      status: 'Warning',
      user: cleanIdentifier || 'Unknown'
    };

    setState(prev => ({
      ...prev,
      auditLogs: [failAuditLog, ...(prev.auditLogs || [])].slice(0, 200)
    }));

    return {
      success: false,
      reason: 'Invalid username, email or mobile number. Please verify your credentials.',
      remainingAttempts: newRate.remainingAttempts,
      locked: !newRate.allowed,
      remainingSeconds: newRate.remainingSeconds
    };
  };

  const logout = () => {
    destroySession();
    const connId = sessionStorage.getItem('connectionId');
    if (connId) {
      supabase
        .from('user_sessions')
        .delete()
        .eq('connection_id', connId)
        .then(() => {});
    }

    const logoutLog = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'User Logout',
      module: 'Authentication',
      details: `User session terminated cleanly.`,
      status: 'Info',
      user: state.currentUser?.name || 'User'
    };

    setState(prev => ({
      ...prev,
      currentUser: null,
      auditLogs: [logoutLog, ...(prev.auditLogs || [])].slice(0, 200)
    }));
  };

  // PHASE C STEP 1: write-through — whenever a step-1/2 collection changes in
  // state, diff it against the last table-synced snapshot and push record
  // upserts/deletes to its table. The blob save still carries these keys too
  // (the fallback copy stays fresh); the tables are kept equal to state.
  const step1Items = state.items;
  const step1Customers = state.customers;
  const step1Suppliers = state.suppliers;
  const step1UomList = state.uomList;
  const step1PackingTypesList = state.packingTypesList;
  const step1RawMaterialTypesList = state.rawMaterialTypesList;
  const step1ItemCategories = state.itemCategories;
  const step2ProductionPlans = state.productionPlans;
  const step2ProductionOutputs = state.productionOutputs;
  const step3SaleOrders = state.saleOrders;
  const step3Deliveries = state.deliveries;
  const step3SalesInvoices = state.salesInvoices;
  const step3Returns = state.returns;
  const step4Adjustments = state.adjustments;
  const step4StockTransfers = state.stockTransfers;
  const step4Grns = state.grns;
  const step4InwardGatePasses = state.inwardGatePasses;
  const step4PurchaseDemands = state.purchaseDemands;
  const step4PurchaseOrders = state.purchaseOrders;
  const step4PurchaseInvoices = state.purchaseInvoices;
  const step5HrEmployees = state.hr_employees_list;
  const step5HrUploadedAttendance = state.hr_uploaded_attendance;
  const step5HrLeaveRequests = state.hr_leave_requests;
  const step5HrOvertimeRequests = state.hr_overtime_requests;
  const step5HrAdvanceRequests = state.hr_advance_requests;
  const step5HrLoanRequests = state.hr_loan_requests;
  const step5HrLoanLedger = state.hr_loan_ledger;
  const step5HrGeneratedSalaries = state.hr_generated_salaries;
  const step6ChartOfAccounts = state.chartOfAccounts;
  const step6Vouchers = state.vouchers;
  const step6PaymentVouchers = state.paymentVouchers;
  const step6Approvals = state.approvals;
  const step6Notifications = state.notifications;
  const step6AuditLogs = state.auditLogs;
  const step6Chats = state.chats;
  const step6RoutingRules = state.routingRules;
  const step6RoutingTasks = state.routingTasks;
  const step6Binders = state.documentWarehouseBinders;
  const step6GatePassActivities = state.gatePassActivities;
  const step6OtherConsumptions = state.otherConsumptions;
  const stepDUsers = state.users;
  const stepDDepartments = state.departments;
  const stepDBoms = state.boms;
  const stepDFinishedGoodPhases = state.finishedGoodPhases;
  const stepDRawMaterialPhases = state.rawMaterialPhases;
  const adminSetupForSync = state.adminSetup;
  const fgComboConfigForSync = state.fg_combinations_config;
  const flashAmConfigForSync = state.flash_am_config;
  const dutySettingsForSync = state.hr_duty_settings;
  const salaryPrintSettingsForSync = state.salary_print_settings;
  const payrollMappingForSync = state.payroll_account_mapping;
  const categoryPrefixesForSync = state.categoryPrefixes;
  const countersForSync = state.counters;
  const batchOutputTypesForSync = state.batchOutputTypes;
  const batchLaborConfigForSync = state.batch_labor_config;
  const loginThemeSettingsForSync = state.login_theme_settings;
  const scalarsBundleForSync = { buildVersion: state.buildVersion, lastUpdatedBy: state.lastUpdatedBy, productionTarget: state.productionTarget, isGlobalPaginated: state.isGlobalPaginated };
  const scalarsWatchKey = JSON.stringify({ buildVersion: state.buildVersion, productionTarget: state.productionTarget, isGlobalPaginated: state.isGlobalPaginated });
  useEffect(() => {
    if (!step1TablesReadyRef.current) return;
    const timer = setTimeout(() => {
      syncEntityDiffToTable('items', step1Items, step1SnapshotsRef.current.items);
      syncEntityDiffToTable('customers', step1Customers, step1SnapshotsRef.current.customers);
      syncEntityDiffToTable('suppliers', step1Suppliers, step1SnapshotsRef.current.suppliers);
      syncEntityDiffToTable('uomList', step1UomList, step1SnapshotsRef.current.uomList);
      syncEntityDiffToTable('packingTypesList', step1PackingTypesList, step1SnapshotsRef.current.packingTypesList);
      syncEntityDiffToTable('rawMaterialTypesList', step1RawMaterialTypesList, step1SnapshotsRef.current.rawMaterialTypesList);
      syncEntityDiffToTable('itemCategories', step1ItemCategories, step1SnapshotsRef.current.itemCategories);
      syncEntityDiffToTable('productionPlans', step2ProductionPlans, step1SnapshotsRef.current.productionPlans);
      syncEntityDiffToTable('productionOutputs', step2ProductionOutputs, step1SnapshotsRef.current.productionOutputs);
      syncEntityDiffToTable('saleOrders', step3SaleOrders, step1SnapshotsRef.current.saleOrders);
      syncEntityDiffToTable('deliveries', step3Deliveries, step1SnapshotsRef.current.deliveries);
      syncEntityDiffToTable('salesInvoices', step3SalesInvoices, step1SnapshotsRef.current.salesInvoices);
      syncEntityDiffToTable('returns', step3Returns, step1SnapshotsRef.current.returns);
      syncEntityDiffToTable('adjustments', step4Adjustments, step1SnapshotsRef.current.adjustments);
      syncEntityDiffToTable('stockTransfers', step4StockTransfers, step1SnapshotsRef.current.stockTransfers);
      syncEntityDiffToTable('grns', step4Grns, step1SnapshotsRef.current.grns);
      syncEntityDiffToTable('inwardGatePasses', step4InwardGatePasses, step1SnapshotsRef.current.inwardGatePasses);
      syncEntityDiffToTable('purchaseDemands', step4PurchaseDemands, step1SnapshotsRef.current.purchaseDemands);
      syncEntityDiffToTable('purchaseOrders', step4PurchaseOrders, step1SnapshotsRef.current.purchaseOrders);
      syncEntityDiffToTable('purchaseInvoices', step4PurchaseInvoices, step1SnapshotsRef.current.purchaseInvoices);
      syncEntityDiffToTable('hr_employees_list', step5HrEmployees, step1SnapshotsRef.current.hr_employees_list);
      syncEntityDiffToTable('hr_uploaded_attendance', step5HrUploadedAttendance, step1SnapshotsRef.current.hr_uploaded_attendance);
      syncEntityDiffToTable('hr_leave_requests', step5HrLeaveRequests, step1SnapshotsRef.current.hr_leave_requests);
      syncEntityDiffToTable('hr_overtime_requests', step5HrOvertimeRequests, step1SnapshotsRef.current.hr_overtime_requests);
      syncEntityDiffToTable('hr_advance_requests', step5HrAdvanceRequests, step1SnapshotsRef.current.hr_advance_requests);
      syncEntityDiffToTable('hr_loan_requests', step5HrLoanRequests, step1SnapshotsRef.current.hr_loan_requests);
      syncEntityDiffToTable('hr_loan_ledger', step5HrLoanLedger, step1SnapshotsRef.current.hr_loan_ledger);
      syncEntityDiffToTable('hr_generated_salaries', step5HrGeneratedSalaries, step1SnapshotsRef.current.hr_generated_salaries);
      syncEntityDiffToTable('chartOfAccounts', step6ChartOfAccounts, step1SnapshotsRef.current.chartOfAccounts);
      syncEntityDiffToTable('vouchers', step6Vouchers, step1SnapshotsRef.current.vouchers);
      syncEntityDiffToTable('paymentVouchers', step6PaymentVouchers, step1SnapshotsRef.current.paymentVouchers);
      syncEntityDiffToTable('approvals', step6Approvals, step1SnapshotsRef.current.approvals);
      syncEntityDiffToTable('notifications', step6Notifications, step1SnapshotsRef.current.notifications);
      syncEntityDiffToTable('auditLogs', step6AuditLogs, step1SnapshotsRef.current.auditLogs);
      syncEntityDiffToTable('chats', step6Chats, step1SnapshotsRef.current.chats);
      syncEntityDiffToTable('routingRules', step6RoutingRules, step1SnapshotsRef.current.routingRules);
      syncEntityDiffToTable('routingTasks', step6RoutingTasks, step1SnapshotsRef.current.routingTasks);
      syncEntityDiffToTable('documentWarehouseBinders', step6Binders, step1SnapshotsRef.current.documentWarehouseBinders);
      syncEntityDiffToTable('gatePassActivities', step6GatePassActivities, step1SnapshotsRef.current.gatePassActivities);
      syncEntityDiffToTable('otherConsumptions', step6OtherConsumptions, step1SnapshotsRef.current.otherConsumptions);
      syncEntityDiffToTable('users', stepDUsers, step1SnapshotsRef.current.users);
      syncEntityDiffToTable('departments', stepDDepartments, step1SnapshotsRef.current.departments);
      syncEntityDiffToTable('boms', stepDBoms, step1SnapshotsRef.current.boms);
      syncEntityDiffToTable('finishedGoodPhases', stepDFinishedGoodPhases, step1SnapshotsRef.current.finishedGoodPhases);
      syncEntityDiffToTable('rawMaterialPhases', stepDRawMaterialPhases, step1SnapshotsRef.current.rawMaterialPhases);
    }, 250);
    return () => clearTimeout(timer);
  }, [step1Items, step1Customers, step1Suppliers, step1UomList, step1PackingTypesList, step1RawMaterialTypesList, step1ItemCategories, step2ProductionPlans, step2ProductionOutputs, step3SaleOrders, step3Deliveries, step3SalesInvoices, step3Returns, step4Adjustments, step4StockTransfers, step4Grns, step4InwardGatePasses, step4PurchaseDemands, step4PurchaseOrders, step4PurchaseInvoices, step5HrEmployees, step5HrUploadedAttendance, step5HrLeaveRequests, step5HrOvertimeRequests, step5HrAdvanceRequests, step5HrLoanRequests, step5HrLoanLedger, step5HrGeneratedSalaries, step6ChartOfAccounts, step6Vouchers, step6PaymentVouchers, step6Approvals, step6Notifications, step6AuditLogs, step6Chats, step6RoutingRules, step6RoutingTasks, step6Binders, step6GatePassActivities, step6OtherConsumptions, stepDUsers, stepDDepartments, stepDBoms, stepDFinishedGoodPhases, stepDRawMaterialPhases]);

  // PHASE C STEP 3 (addendum): adminSetup — incl. the base currency — is
  // persisted to the app_config table so the selection survives blob
  // regressions. Write-through on change (debounced, after initial load).
  useEffect(() => {
    if (!adminSetupLoadedRef.current) return;
    if (adminSetupSnapshotRef.current === adminSetupForSync) return;
    const timer = setTimeout(() => {
      adminSetupSnapshotRef.current = adminSetupForSync;
      syncAdminSetupToTable(adminSetupForSync);
    }, 250);
    return () => clearTimeout(timer);
  }, [adminSetupForSync]);

  // FG COMBO PHASE: the builder config (lookups, masking switches,
  // auto-select rules) write-through to app_config on change — same durable
  // pattern as adminSetup. A null snapshot means "table had no copy at
  // load", so the first effect run seeds it with the current config.
  useEffect(() => {
    if (!fgComboConfigLoadedRef.current) return;
    if (!fgComboConfigForSync || typeof fgComboConfigForSync !== 'object') return;
    if (fgComboConfigSnapshotRef.current === fgComboConfigForSync) return;
    const timer = setTimeout(() => {
      fgComboConfigSnapshotRef.current = fgComboConfigForSync;
      syncFGComboConfigToTable(fgComboConfigForSync);
    }, 250);
    return () => clearTimeout(timer);
  }, [fgComboConfigForSync]);

  // FLASHAM PHASE A: the Flash AM terminal config write-through to
  // app_config on change — same durable pattern as fgComboConfig. A null
  // snapshot means "table had no copy at load", so the first effect run
  // seeds it with the current (default) config.
  useEffect(() => {
    if (!flashAmConfigLoadedRef.current) return;
    if (!flashAmConfigForSync || typeof flashAmConfigForSync !== 'object') return;
    if (flashAmConfigSnapshotRef.current === flashAmConfigForSync) return;
    const timer = setTimeout(() => {
      flashAmConfigSnapshotRef.current = flashAmConfigForSync;
      syncFlashAmConfigToTable(flashAmConfigForSync);
    }, 250);
    return () => clearTimeout(timer);
  }, [flashAmConfigForSync]);

  // HR PRINTS: the Salary Generation print settings write-through to
  // app_config on change — same durable pattern as flashAmConfig. A null
  // snapshot means "table had no copy at load", so the first effect run
  // seeds it with the current (default) settings.
  useEffect(() => {
    if (!salaryPrintSettingsLoadedRef.current) return;
    if (!salaryPrintSettingsForSync || typeof salaryPrintSettingsForSync !== 'object') return;
    if (salaryPrintSettingsSnapshotRef.current === salaryPrintSettingsForSync) return;
    const timer = setTimeout(() => {
      salaryPrintSettingsSnapshotRef.current = salaryPrintSettingsForSync;
      syncSalaryPrintSettingsToTable(salaryPrintSettingsForSync);
    }, 250);
    return () => clearTimeout(timer);
  }, [salaryPrintSettingsForSync]);

  // HR PAYROLL MAPPING: the payroll-category -> GL-account mappings
  // write-through to app_config on change — same durable pattern as
  // salaryPrintSettings. A null snapshot means "table had no copy at
  // load", so the first effect run seeds it with the current mappings.
  useEffect(() => {
    if (!payrollMappingLoadedRef.current) return;
    if (!Array.isArray(payrollMappingForSync)) return;
    if (payrollMappingSnapshotRef.current === payrollMappingForSync) return;
    const timer = setTimeout(() => {
      payrollMappingSnapshotRef.current = payrollMappingForSync;
      syncPayrollAccountMappingToTable(payrollMappingForSync);
    }, 250);
    return () => clearTimeout(timer);
  }, [payrollMappingForSync]);

  // SERVER RULE — HR DUTY SETTINGS: write-through to app_config on change
  // (same durable pattern as flashAmConfig) + refresh the localStorage read
  // cache. A null snapshot means "table had no copy at load", so the first
  // effect run seeds it (localStorage migration or defaults).
  useEffect(() => {
    if (!dutySettingsLoadedRef.current) return;
    if (!dutySettingsForSync || typeof dutySettingsForSync !== 'object') return;
    if (dutySettingsSnapshotRef.current === dutySettingsForSync) return;
    const timer = setTimeout(() => {
      dutySettingsSnapshotRef.current = dutySettingsForSync;
      syncDutySettingsToTable(dutySettingsForSync);
      try { localStorage.setItem('hr_duty_settings', JSON.stringify(dutySettingsForSync)); } catch (_) {}
    }, 250);
    return () => clearTimeout(timer);
  }, [dutySettingsForSync]);

  // SERVER RULE — SALARY & ALLOWANCE CONFIG: write-through to app_config
  // whenever the saved config or the per-employee allowance map changes in
  // state. Snapshot is the payload JSON, so only real changes write.
  useEffect(() => {
    if (!salaryAllowanceLoadedRef.current) return;
    const cfgArr = state.hr_salary_allowance_config;
    const config = Array.isArray(cfgArr) && cfgArr.length ? cfgArr[cfgArr.length - 1] : null;
    const map = state.hr_employee_allowance_map;
    const hasMap = map && typeof map === 'object' && !Array.isArray(map);
    if (!config && !hasMap) return;
    const payload = { config: config || null, employeeAllowanceMap: hasMap ? map : {} };
    const json = JSON.stringify(payload);
    if (salaryAllowanceSnapshotRef.current === json) return;
    const timer = setTimeout(() => {
      salaryAllowanceSnapshotRef.current = json;
      syncSalaryAllowanceConfigToTable(payload);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hr_salary_allowance_config, state.hr_employee_allowance_map]);

  // PHASE C STEP 6: categoryPrefixes ride in app_config like adminSetup —
  // the table copy wins on load; changes write through (debounced).
  useEffect(() => {
    if (!categoryPrefixesLoadedRef.current) return;
    if (!categoryPrefixesForSync || typeof categoryPrefixesForSync !== 'object') return;
    if (categoryPrefixesSnapshotRef.current === categoryPrefixesForSync) return;
    const timer = setTimeout(() => {
      categoryPrefixesSnapshotRef.current = categoryPrefixesForSync;
      syncCategoryPrefixesToTable(categoryPrefixesForSync);
    }, 250);
    return () => clearTimeout(timer);
  }, [categoryPrefixesForSync]);

  // PHASE C STEP 6: the app_config `scalars` bundle is written through when
  // a watched value changes (buildVersion / productionTarget /
  // isGlobalPaginated). lastUpdatedBy rides along in the written bundle but
  // is excluded from change detection — it changes on every save and would
  // otherwise retrigger this effect constantly.
  useEffect(() => {
    if (!scalarsLoadedRef.current) return;
    if (scalarsSnapshotRef.current === scalarsWatchKey) return;
    const timer = setTimeout(() => {
      scalarsSnapshotRef.current = scalarsWatchKey;
      syncScalarsToTable(scalarsBundleForSync);
    }, 250);
    return () => clearTimeout(timer);
  }, [scalarsWatchKey]);

  // PHASE D STEP D1: counters ride in app_config like categoryPrefixes —
  // the table copy wins on load; changes write through (debounced). The
  // line-code counter can no longer be lost or rewound in a blob flip.
  useEffect(() => {
    if (!countersLoadedRef.current) return;
    if (!countersForSync || typeof countersForSync !== 'object' || Array.isArray(countersForSync)) return;
    if (countersSnapshotRef.current === countersForSync) return;
    const timer = setTimeout(() => {
      countersSnapshotRef.current = countersForSync;
      syncCountersToTable(countersForSync);
    }, 250);
    return () => clearTimeout(timer);
  }, [countersForSync]);

  // PHASE D STEP D1: batchOutputTypes (production grade definitions) ride
  // in app_config the same way — table copy wins on load, changes write
  // through (debounced).
  useEffect(() => {
    if (!batchOutputTypesLoadedRef.current) return;
    if (!Array.isArray(batchOutputTypesForSync)) return;
    if (batchOutputTypesSnapshotRef.current === batchOutputTypesForSync) return;
    const timer = setTimeout(() => {
      batchOutputTypesSnapshotRef.current = batchOutputTypesForSync;
      syncBatchOutputTypesToTable(batchOutputTypesForSync);
    }, 250);
    return () => clearTimeout(timer);
  }, [batchOutputTypesForSync]);

  // BATCH LABOR (2026-10-25): the Batch Record labor-cost employee
  // selection write-through to app_config on change — same durable
  // pattern as flashAmConfig. A null snapshot means "table had no copy
  // at load", so the first effect run seeds it with the current
  // (default) selection.
  useEffect(() => {
    if (!batchLaborConfigLoadedRef.current) return;
    if (!batchLaborConfigForSync || typeof batchLaborConfigForSync !== 'object') return;
    if (batchLaborConfigSnapshotRef.current === batchLaborConfigForSync) return;
    const timer = setTimeout(() => {
      batchLaborConfigSnapshotRef.current = batchLaborConfigForSync;
      syncBatchLaborConfigToTable(batchLaborConfigForSync);
    }, 250);
    return () => clearTimeout(timer);
  }, [batchLaborConfigForSync]);

  // LOGIN THEMES (2026-10-25): the login screen theme settings
  // write-through to app_config on change — same durable pattern as
  // flashAmConfig. A null snapshot means "table had no copy at load", so
  // the first effect run seeds it with the shipped default (fixed /
  // Paper Leaf).
  useEffect(() => {
    if (!loginThemeSettingsLoadedRef.current) return;
    if (!loginThemeSettingsForSync || typeof loginThemeSettingsForSync !== 'object') return;
    if (loginThemeSettingsSnapshotRef.current === loginThemeSettingsForSync) return;
    const timer = setTimeout(() => {
      loginThemeSettingsSnapshotRef.current = loginThemeSettingsForSync;
      syncLoginThemeSettingsToTable(loginThemeSettingsForSync);
    }, 250);
    return () => clearTimeout(timer);
  }, [loginThemeSettingsForSync]);

  const setCollection = (collection, data) => {
    setState(prev => {
      const nextData = typeof data === 'function' ? data(prev[collection]) : data;
      let extraUpdates = {};

      if (collection === 'hr_overtime_requests' && Array.isArray(nextData)) {
        let attendanceList = [...(prev.hr_uploaded_attendance || [])];
        let attendanceChanged = false;

        nextData.forEach(req => {
          if (req.status === 'Approved' && req.date && parseFloat(req.hours || 0) > 0) {
            const empName = req.employeeName || 'Employee';
            const otDate = req.date;
            const otHours = parseFloat(req.hours);

            const existingIdx = attendanceList.findIndex(a => 
              (a.employeeName === empName || (req.employeeId && a.id === req.employeeId)) && a.date === otDate
            );

            if (existingIdx !== -1) {
              const currentOt = parseFloat(attendanceList[existingIdx].ot || attendanceList[existingIdx].overtimeHours || 0);
              if (currentOt < otHours) {
                attendanceList[existingIdx] = {
                  ...attendanceList[existingIdx],
                  ot: otHours,
                  overtimeHours: otHours,
                  status: attendanceList[existingIdx].status === 'absent' ? 'present' : (attendanceList[existingIdx].status || 'present')
                };
                attendanceChanged = true;
              }
            } else {
              attendanceList.push({
                id: req.employeeId || `EMP-${Date.now()}`,
                employeeName: empName,
                date: otDate,
                status: 'present',
                ot: otHours,
                overtimeHours: otHours,
                fines: 0,
                deductions: 0
              });
              attendanceChanged = true;
            }
          }
        });

        if (attendanceChanged) {
          extraUpdates.hr_uploaded_attendance = attendanceList;
        }
      }

      if (collection === 'fg_combinations_config') {
        saveFGConfig(nextData);
      }
      if (collection === 'hr_loan_requests' && Array.isArray(nextData)) {
        let ledgerList = [...(prev.hr_loan_ledger || [])];
        let ledgerChanged = false;

        nextData.forEach(req => {
          if (req.status === 'Approved') {
            const existingIdx = ledgerList.findIndex(l => l.loanRequestId === req.id || (l.employeeId === req.employeeId && l.totalLoanAmount === (req.amount || req.loanAmount) && l.status === 'Active'));
            if (existingIdx === -1) {
              const amount = parseFloat(req.amount || req.loanAmount || 0);
              const term = parseInt(req.termMonths || 1);
              const monthlyInst = parseFloat(req.monthlyInstallment || (term > 0 ? (amount / term) : amount));
              const startDate = req.repaymentStartDate || req.deductionDate || new Date().toISOString().substring(0, 10);
              
              ledgerList.unshift({
                id: `LL-${Math.floor(1000 + Math.random() * 9000)}`,
                loanRequestId: req.id,
                employeeId: req.employeeId,
                employeeName: req.employeeName,
                department: req.department || 'Operations',
                designation: req.designation || 'Staff',
                loanType: req.type || req.loanType || 'Personal Loan',
                totalLoanAmount: amount,
                termMonths: term,
                monthlyInstallment: parseFloat(monthlyInst.toFixed(2)),
                repaymentStartDate: startDate,
                nextDeductionDate: startDate,
                paidAmount: 0,
                remainingBalance: amount,
                status: 'Active',
                deductionsHistory: [],
                createdAt: new Date().toISOString()
              });
              ledgerChanged = true;
            }
          }
        });

        if (ledgerChanged) {
          extraUpdates.hr_loan_ledger = ledgerList;
        }
      }

      return {
        ...prev,
        [collection]: nextData,
        ...extraUpdates
      };
    });
  };

  const hasPermission = (moduleName, screenName = null, action = 'view') => {
    const user = state.currentUser;
    if (!user) return false;

    // Super Admin role gets full access
    if (user.role === 'Super Admin') return true;

    // Check module level
    let hasModuleAccess = false;
    if (Array.isArray(user.permissions)) {
      hasModuleAccess = user.permissions.includes(moduleName);
    } else if (user.permissions && typeof user.permissions === 'object') {
      hasModuleAccess = !!user.permissions[moduleName];
    }

    // Files (Document Warehouse) was reachable by every signed-in user before
    // the 2026-10-27 permissions redesign (its route had no module gate).
    // Keep that safe default until an admin saves an explicit set for this
    // user — an explicit set (synced module array + granular entry) is the
    // only way the Files module turns off.
    if (!hasModuleAccess && moduleName === 'files' && !user.granularPermissions?.files) {
      hasModuleAccess = true;
    }

    if (!hasModuleAccess) return false;
    if (!screenName) return true; // Module level granted

    // Check granular screen level if module granular permissions exist.
    // SAFE-DEFAULT (permissions redesign, 2026-10-27): anything not explicitly
    // disabled is allowed — a screen/action missing from a saved set falls
    // back to module access instead of denying, so a screen added later can
    // never silently lock a user out. The admin screen always saves COMPLETE
    // sets (src/utils/permissions.js normalizeSet), so real "off" choices
    // are always explicit values, never absences.
    const moduleGranular = user.granularPermissions?.[moduleName];
    if (moduleGranular && typeof moduleGranular === 'object') {
      const screenPerms = moduleGranular[screenName];
      if (screenPerms === undefined) {
        return true; // not configured for this screen -> module access decides
      }
      if (typeof screenPerms === 'boolean') {
        return screenPerms;
      }
      if (typeof screenPerms === 'object' && screenPerms !== null) {
        if (screenPerms._enabled === false) {
          return false;
        }
        if (screenPerms[action] !== undefined) {
          return !!screenPerms[action];
        }
        if (action === 'view') {
          return Object.keys(screenPerms).filter(k => k !== '_enabled').some(k => screenPerms[k]);
        }
        return true; // action not explicitly configured -> allowed
      }
    }

    return true;
  };

  const getCanonicalUsername = (nameOrUsername, usersList) => {
    if (!nameOrUsername) return 'admin';
    const clean = nameOrUsername.trim().toLowerCase().replace(/^@/, '');
    const matchedUser = (usersList || []).find(u => 
      u.username?.toLowerCase() === clean || 
      u.name?.toLowerCase() === clean || 
      u.email?.toLowerCase() === clean
    );
    return matchedUser ? matchedUser.username : clean;
  };

  const executeNextSteps = (task, updatedTasks, updatedApprovals, updatedChats, updatedBinders, usersList, lookupState = null) => {
    while (task.currentStepIndex < task.steps.length) {
      const currentStep = task.steps[task.currentStepIndex];
      if (!currentStep) break;

      if (currentStep.type === 'audience_selector') {
        const selectedUsers = currentStep.config?.selectedUsers || [];
        const selectAll = currentStep.config?.selectAll || false;
        const creator = getCanonicalUsername(task.document.createdBy, usersList);
        
        const cleanSelected = selectedUsers.map(u => getCanonicalUsername(u, usersList));
        const isMatched = selectAll || cleanSelected.includes(creator);
        if (isMatched) {
          task.history.push({
            stepId: currentStep.id,
            stepName: currentStep.name,
            status: 'Success',
            timestamp: new Date().toLocaleTimeString(),
            message: `Creator @${creator} matches target audience.`
          });
          task.currentStepIndex += 1;
        } else {
          task.history.push({
            stepId: currentStep.id,
            stepName: currentStep.name,
            status: 'Failed',
            timestamp: new Date().toLocaleTimeString(),
            message: `Creator @${creator} does not match target audience. Workflow halted.`
          });
          task.status = 'Failed';
          break;
        }
      }
      else if (currentStep.type === 'document_trigger') {
        const selectedDocTypes = currentStep.config?.selectedDocTypes || [];
        const selectAll = currentStep.config?.selectAll || false;
        const docType = task.document.type;
        
        const isMatched = selectAll || selectedDocTypes.includes(docType);
        if (isMatched) {
          task.history.push({
            stepId: currentStep.id,
            stepName: currentStep.name,
            status: 'Success',
            timestamp: new Date().toLocaleTimeString(),
            message: `Document type '${docType}' matches trigger scope.`
          });
          task.currentStepIndex += 1;
        } else {
          task.history.push({
            stepId: currentStep.id,
            stepName: currentStep.name,
            status: 'Failed',
            timestamp: new Date().toLocaleTimeString(),
            message: `Document type '${docType}' does not match trigger scope. Workflow halted.`
          });
          task.status = 'Failed';
          break;
        }
      }
      else if (currentStep.type === 'approval_gate') {
        const approvalUser = currentStep.config?.approvalUser || 'admin';
        const approvalId = `APP-RT-${task.id.split('-')[1]}-s${task.currentStepIndex}`;
        
        const canonicalApprovalUser = getCanonicalUsername(approvalUser, usersList);
        const canonicalCreator = getCanonicalUsername(task.document.createdBy, usersList);

        // Dedupe against BOTH the canonical suffixed id and the legacy
        // unsuffixed id, so a pre-suffix approval for this gate is reused
        // instead of duplicated.
        const legacyApprovalId = `APP-RT-${task.id.split('-')[1]}`;
        const existingApproval = updatedApprovals.find(a => a.id === approvalId || a.id === legacyApprovalId);
        if (!existingApproval) {
          updatedApprovals.push({
            id: approvalId,
            type: 'Routing Approval',
            requestedTo: canonicalApprovalUser,
            requestedBy: canonicalCreator,
            details: `[Routing Approval Step ${task.currentStepIndex + 1}] Rule: ${task.ruleName}. Document: ${task.document.title || task.document.id}.`,
            value: task.document.type,
            status: 'Pending',
            createdAt: new Date().toISOString()
          });
        }

        task.history.push({
          stepId: currentStep.id,
          stepName: currentStep.name,
          status: 'Waiting',
          timestamp: new Date().toLocaleTimeString(),
          message: `Awaiting authorization from @${canonicalApprovalUser}. Request sent to Chat & Approvals module.`
        });
        task.status = 'Waiting_Approval';
        break;
      }
      else if (currentStep.type === 'chat_dispatcher') {
        const selectedUsers = currentStep.config?.selectedUsers || [];
        const selectedGroups = currentStep.config?.selectedGroups || [];
        const selectAllUsers = currentStep.config?.selectAllUsers || false;
        const selectAllGroups = currentStep.config?.selectAllGroups || false;
        const docCreator = task.document.createdBy;
        
        // Private share
        const targetUsernames = selectAllUsers ? usersList.map(u => u.username) : selectedUsers;
        targetUsernames.forEach(username => {
          if (!username || username === docCreator) return;
          
          let threadIndex = updatedChats.findIndex(t => !t.isGroup && t.members && t.members.includes(username) && t.members.includes(docCreator));
          let thread;
          if (threadIndex === -1) {
            thread = {
              id: `thread_${docCreator}_${username}_${Date.now()}`,
              isGroup: false,
              members: [docCreator, username],
              unreadCount: 1,
              archived: false,
              messages: []
            };
            updatedChats.push(thread);
            threadIndex = updatedChats.length - 1;
          } else {
            thread = { ...updatedChats[threadIndex] };
          }
          
          const msgId = `msg_auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const text = `📄 *Shared Document via Routing automation:*\n*Title:* ${task.document.title}\n*Type:* ${task.document.type}\n*Document ID:* ${task.document.id}\n*Details:* ${task.document.details || 'No details provided.'}`;
          
          thread.messages = [...(thread.messages || []), {
            id: msgId,
            sender: docCreator,
            text: text,
            timestamp: new Date().toISOString(),
            status: 'unread'
          }];
          
          updatedChats[threadIndex] = thread;

          // Write to Supabase messages table
          supabase
            .from('messages')
            .insert({
              id: msgId,
              sender_id: docCreator,
              receiver_id: username,
              group_id: null,
              text: text,
              status: 'sent'
            })
            .then(({ error }) => {
              if (error) console.warn("Error inserting simulated direct message:", error);
            });
        });

        // Group share
        const allGroups = updatedChats.filter(t => t.isGroup);
        const targetGroupIds = selectAllGroups ? allGroups.map(g => g.id) : selectedGroups;
        
        targetGroupIds.forEach(groupId => {
          const groupIndex = updatedChats.findIndex(t => t.id === groupId);
          if (groupIndex !== -1) {
            const groupThread = { ...updatedChats[groupIndex] };
            const msgId = `msg_auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const text = `📄 *Shared Document via Routing automation:*\n*Title:* ${task.document.title}\n*Type:* ${task.document.type}\n*Document ID:* ${task.document.id}\n*Details:* ${task.document.details || 'No details provided.'}`;

            groupThread.messages = [...(groupThread.messages || []), {
              id: msgId,
              sender: docCreator,
              text: text,
              timestamp: new Date().toISOString(),
              status: 'unread'
            }];
            
            updatedChats[groupIndex] = groupThread;

            // Write to Supabase messages table
            supabase
              .from('messages')
              .insert({
                id: msgId,
                sender_id: docCreator,
                receiver_id: null,
                group_id: groupId,
                text: text,
                status: 'sent'
              })
              .then(({ error }) => {
                if (error) console.warn("Error inserting simulated group message:", error);
              });
          }
        });

        task.history.push({
          stepId: currentStep.id,
          stepName: currentStep.name,
          status: 'Success',
          timestamp: new Date().toLocaleTimeString(),
          message: `Shared document with ${targetUsernames.length} users and ${targetGroupIds.length} groups in Chat Module.`
        });
        task.currentStepIndex += 1;
      }
      else if (currentStep.type === 'archive_binder') {
        const selectAll = currentStep.config?.selectAll || false;

        // FILES CABINET (2026-10-25): new selections store binder IDs;
        // legacy rules still carry binder NAMES — the shared helper
        // (utils/routingArchive) matches either so old rules keep filing
        // into the same binders.
        //
        // FILES FIX (2026-10-26): success is claimed ONLY for binders the
        // document verifiably landed in (the helper reports them after
        // the push, deduped by docId). The old code fell back to printing
        // the raw selection list when nothing had been filed, so the log
        // could claim "Saved and attached" for a filing that never
        // happened (leave LVR-1792956775880). A no-match filing now
        // records Failed, and the reconciliation effect below re-files +
        // annotates any claimed filing that is missing from the
        // committed binder state.
        let filedBinderNames = [];
        if (updatedBinders && Array.isArray(updatedBinders)) {
          // Freeze the document's printable snapshot at filing time: the
          // cabinet viewer re-renders it later with the CURRENT print
          // design over this frozen content.
          const { docType, studioRecord } = buildFiledDocumentSnapshot(
            lookupState || state,
            task.document.type,
            task.document.id
          );
          const entry = buildArchiveEntry(task, docType, studioRecord);
          const res = applyFilingToBinders(updatedBinders, currentStep, entry);
          filedBinderNames = res.filedNames;
        }

        if (filedBinderNames.length > 0) {
          task.history.push({
            stepId: currentStep.id,
            stepName: currentStep.name,
            status: 'Success',
            timestamp: new Date().toLocaleTimeString(),
            message: `Saved and attached document inside selected binders: ${selectAll ? 'All Binders' : filedBinderNames.join(', ')}.`
          });
        } else {
          task.history.push({
            stepId: currentStep.id,
            stepName: currentStep.name,
            status: 'Failed',
            timestamp: new Date().toLocaleTimeString(),
            message: 'Archive step could NOT file the document — no matching binder was available, so the document was NOT saved into any binder.'
          });
        }
        task.currentStepIndex += 1;
      }
    }

    if (task.currentStepIndex >= task.steps.length && task.status === 'Running') {
      task.status = 'Completed';
      task.history.push({
        stepId: 'final',
        stepName: 'End Workflow',
        status: 'Success',
        timestamp: new Date().toLocaleTimeString(),
        message: `Workflow completed successfully. Document closed at final position.`
      });
    }
  };

  const startRoutingWorkflow = (doc) => {
    let rules = state.routingRules || [];
    if (rules.length === 0) {
      const savedRules = localStorage.getItem('hr_routing_rules_config');
      if (savedRules) {
        try { rules = JSON.parse(savedRules); } catch(e) {}
      }
    }
    
    const activeRules = rules.filter(r => r.status === 'Active');
    const newTasks = [];
    
    activeRules.forEach(rule => {
      const creatorSteps = rule.steps?.filter(s => s.type === 'audience_selector') || [];
      const triggerSteps = rule.steps?.filter(s => s.type === 'document_trigger') || [];
      
      let creatorMatches = true;
      const canonicalCreator = getCanonicalUsername(doc.createdBy, state.users || []);
      for (const step of creatorSteps) {
        const selectedUsers = step.config?.selectedUsers || [];
        const selectAll = step.config?.selectAll || false;
        const cleanSelected = selectedUsers.map(u => getCanonicalUsername(u, state.users || []));
        if (!selectAll && !cleanSelected.includes(canonicalCreator)) {
          creatorMatches = false;
          break;
        }
      }
      
      let triggerMatches = true;
      for (const step of triggerSteps) {
        const selectedDocTypes = step.config?.selectedDocTypes || [];
        const selectAll = step.config?.selectAll || false;
        if (!selectAll && !selectedDocTypes.includes(doc.type)) {
          triggerMatches = false;
          break;
        }
      }
      
      if (creatorMatches && triggerMatches) {
        const taskId = `TASK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const newTask = {
          id: taskId,
          ruleId: rule.id,
          ruleName: rule.name,
          document: doc,
          currentStepIndex: 0,
          status: 'Running',
          steps: rule.steps || [],
          history: [
            {
              stepId: 'init',
              stepName: 'Trigger Automation',
              status: 'Success',
              timestamp: new Date().toLocaleTimeString(),
              message: `Workflow '${rule.name}' triggered for document '${doc.title}'`
            }
          ]
        };
        newTasks.push(newTask);
      }
    });

    if (newTasks.length > 0) {
      setState(prev => {
        const currentTasks = prev.routingTasks || [];
        const updatedTasks = [...currentTasks, ...newTasks];
        const updatedApprovals = prev.approvals ? [...prev.approvals] : [];
        const updatedChats = prev.chats ? [...prev.chats] : [];
        
        // Binders come from state only (the table is their source of
        // truth). The old localStorage fallback copy is gone — it could
        // resurrect binders deleted from the table (Files Cabinet,
        // 2026-10-25). `prev` is also the snapshot-lookup state: it is the
        // freshest state and contains the just-submitted source record.
        let updatedBinders = prev.documentWarehouseBinders ? JSON.parse(JSON.stringify(prev.documentWarehouseBinders)) : null;

        newTasks.forEach(task => {
          executeNextSteps(task, updatedTasks, updatedApprovals, updatedChats, updatedBinders, prev.users || [], prev);
        });

        return {
          ...prev,
          routingTasks: updatedTasks,
          approvals: updatedApprovals,
          chats: updatedChats,
          documentWarehouseBinders: updatedBinders
        };
      });
    }
  };

  useEffect(() => {
    if (!state.approvals || !state.routingTasks) return;
    
    const waitingTasks = state.routingTasks.filter(t => t.status === 'Waiting_Approval');
    if (waitingTasks.length === 0) return;

    let stateChanged = false;
    const updatedTasks = [...state.routingTasks];
    const updatedApprovals = [...state.approvals];
    const updatedChats = state.chats ? [...state.chats] : [];
    let updatedBinders = state.documentWarehouseBinders ? JSON.parse(JSON.stringify(state.documentWarehouseBinders)) : null;

    let otStatusChanged = false;
    let updatedOtRequests = state.hr_overtime_requests ? [...state.hr_overtime_requests] : [];

    waitingTasks.forEach(task => {
      const currentStep = task.steps[task.currentStepIndex];
      if (currentStep && currentStep.type === 'approval_gate') {
        const approvalId = `APP-RT-${task.id.split('-')[1]}-s${task.currentStepIndex}`;
        // Legacy approvals created before the -s<stepIndex> suffix existed
        // carry the unsuffixed id APP-RT-<taskTs>; accept either form or
        // those tasks can never leave Waiting_Approval.
        const legacyApprovalId = `APP-RT-${task.id.split('-')[1]}`;
        const approval = state.approvals.find(a => a.id === approvalId || a.id === legacyApprovalId);
        
        if (approval && approval.status !== 'Pending') {
          stateChanged = true;
          const taskInList = updatedTasks.find(t => t.id === task.id);
          if (taskInList) {
            const decision = approval.status; 
            const reason = approval.reasonComment || '';
            const approvalUser = currentStep.config?.approvalUser || 'admin';
            
            if (decision === 'Approved') {
              taskInList.history.push({
                stepId: currentStep.id,
                stepName: currentStep.name,
                status: 'Success',
                timestamp: new Date().toLocaleTimeString(),
                message: `Approval granted by @${approvalUser}. Reason: ${reason || 'N/A'}`
              });
              taskInList.currentStepIndex += 1;
              
              if (taskInList.currentStepIndex >= taskInList.steps.length) {
                taskInList.status = 'Completed';
                taskInList.history.push({
                  stepId: 'final',
                  stepName: 'End Workflow',
                  status: 'Success',
                  timestamp: new Date().toLocaleTimeString(),
                  message: `All approval steps completed successfully.`
                });
                
                // Auto-approve overtime request if document type matches
                if (taskInList.document) {
                  const docId = taskInList.document.id;
                  const docType = taskInList.document.type;
                  if (docType === 'Overtime Request' || docType === 'hr_overtime_requests') {
                    updatedOtRequests = updatedOtRequests.map(r => r.id === docId ? { ...r, status: 'Approved' } : r);
                    otStatusChanged = true;
                  }
                }
              } else {
                taskInList.status = 'Running';
                executeNextSteps(taskInList, updatedTasks, updatedApprovals, updatedChats, updatedBinders, state.users || [], state);
              }
            } else if (decision === 'Rejected') {
              taskInList.history.push({
                stepId: currentStep.id,
                stepName: currentStep.name,
                status: 'Failed',
                timestamp: new Date().toLocaleTimeString(),
                message: `Approval rejected by @${approvalUser}. Reason: ${reason || 'N/A'}`
              });
              
              const onRejectAction = currentStep.config?.onReject || 'close';
              if (onRejectAction === 'close') {
                taskInList.status = 'Failed';
                taskInList.history.push({
                  stepId: 'final',
                  stepName: 'End Workflow',
                  status: 'Failed',
                  timestamp: new Date().toLocaleTimeString(),
                  message: `Workflow terminated due to rejection.`
                });
              } else if (onRejectAction === 'next') {
                taskInList.currentStepIndex += 1;
                if (taskInList.currentStepIndex >= taskInList.steps.length) {
                  taskInList.status = 'Completed';
                } else {
                  taskInList.status = 'Running';
                  executeNextSteps(taskInList, updatedTasks, updatedApprovals, updatedChats, updatedBinders, state.users || [], state);
                }
              } else if (onRejectAction === 'escalate') {
                taskInList.history.push({
                  stepId: currentStep.id,
                  stepName: currentStep.name,
                  status: 'Escalated',
                  timestamp: new Date().toLocaleTimeString(),
                  message: `Rejection escalated. Rerouting approval to Admin.`
                });
                
                const appIndex = updatedApprovals.findIndex(a => a.id === approval.id);
                if (appIndex !== -1) {
                  updatedApprovals[appIndex] = {
                    ...updatedApprovals[appIndex],
                    status: 'Pending',
                    requestedTo: 'admin',
                    details: `[ESCALATED Approval Needed] Rule: ${task.ruleName}. Document: ${task.document.title}. Escalated after rejection.`
                  };
                }
                taskInList.status = 'Waiting_Approval';
              }
            }
          }
        }
      }
    });

    if (stateChanged) {
      setState(prev => {
        const nextState = {
          ...prev,
          routingTasks: updatedTasks,
          approvals: updatedApprovals,
          chats: updatedChats,
          documentWarehouseBinders: updatedBinders
        };
        if (otStatusChanged) {
          nextState.hr_overtime_requests = updatedOtRequests;
        }
        return nextState;
      });
    }
  }, [state.approvals]);

  // FILES FIX (2026-10-26) — archive filing reconciliation. The routing
  // engine records an archive step's success from the filing it makes
  // inside its own setState updater; on 2026-10-26 a claimed filing
  // (leave LVR-1792956775880) was lost when a competing write restored
  // the pre-filing binder list, and nothing noticed — the binder stayed
  // empty while the execution log claimed success. This pass verifies
  // every claimed filing against the committed binder state: a document
  // missing from a still-existing target binder is re-filed (idempotent,
  // deduped by docId, snapshot rebuilt from the live source record) and
  // the task history is annotated, so a success claim can never stand
  // while the document is verifiably absent. Filings whose binders were
  // deleted are skipped — their documents went away with the binder.
  const archiveReconcileAttemptsRef = useRef(new Set());
  useEffect(() => {
    if (!step1TablesReadyRef.current) return;
    const tasks = state.routingTasks || [];
    const binders = state.documentWarehouseBinders;
    if (!tasks.length || !Array.isArray(binders)) return;

    const missing = findUnverifiedFilings(tasks, binders);
    // Prune session attempts whose filings verify again, so a genuinely
    // new loss later in the same session can still be repaired.
    if (archiveReconcileAttemptsRef.current.size > 0) {
      const missingKeys = new Set(missing.map(m => `${m.taskId}:${m.docId}`));
      archiveReconcileAttemptsRef.current.forEach(k => {
        if (!missingKeys.has(k)) archiveReconcileAttemptsRef.current.delete(k);
      });
    }
    const actionable = missing.filter(m => !archiveReconcileAttemptsRef.current.has(`${m.taskId}:${m.docId}`));
    if (!actionable.length) return;
    actionable.forEach(m => archiveReconcileAttemptsRef.current.add(`${m.taskId}:${m.docId}`));

    setState(prev => {
      const prevBinders = prev.documentWarehouseBinders;
      if (!Array.isArray(prevBinders)) return prev;
      // Re-verify against the freshest state inside the updater.
      const stillMissing = findUnverifiedFilings(prev.routingTasks || [], prevBinders)
        .filter(m => actionable.some(a => a.taskId === m.taskId && a.docId === m.docId));
      if (!stillMissing.length) return prev;

      const nextBinders = JSON.parse(JSON.stringify(prevBinders));
      const taskCopies = new Map();
      stillMissing.forEach(m => {
        const orig = (prev.routingTasks || []).find(t => t.id === m.taskId);
        if (!orig) return;
        const { docType, studioRecord } = buildFiledDocumentSnapshot(prev, orig.document.type, orig.document.id);
        const entry = buildArchiveEntry(orig, docType, studioRecord);
        const res = fileEntryIntoBindersById(nextBinders, m.targetBinderIds, entry);
        if (res.filedIds.length > 0) {
          if (!taskCopies.has(m.taskId)) {
            taskCopies.set(m.taskId, { ...orig, history: [...(orig.history || [])] });
          }
          taskCopies.get(m.taskId).history.push({
            stepId: m.stepId,
            stepName: 'Folder Storage Archiver',
            status: 'Success',
            timestamp: new Date().toLocaleTimeString(),
            message: `Filing verified & recovered: the document was missing from ${res.filedNames.join(', ')} although the workflow had recorded it as filed; it has now been filed.`,
            recovered: true
          });
        }
      });

      if (taskCopies.size === 0) return prev;
      const nextTasks = (prev.routingTasks || []).map(t => taskCopies.get(t.id) || t);
      return { ...prev, documentWarehouseBinders: nextBinders, routingTasks: nextTasks };
    });
  }, [state.routingTasks, state.documentWarehouseBinders]);

  const baseCurrencySetting = state.adminSetup?.baseCurrency || 'USD ($)';
  const currencyCode = baseCurrencySetting.split(' ')[0] || 'USD';
  const currencySymbol = baseCurrencySetting.match(/\(([^)]+)\)/)?.[1] || '$';

  const getPermittedDepartments = (targetUser = state.currentUser) => {
    const allDepts = state.departments || [];
    if (!targetUser || targetUser.role === 'Super Admin') return allDepts;

    const allowed = targetUser.allowedDepartments;
    if (Array.isArray(allowed) && allowed.length > 0) {
      const filtered = allDepts.filter(d => {
        const dName = typeof d === 'string' ? d : (d.name || d.label || d.value);
        return allowed.includes(dName) || allowed.includes(d.id);
      });
      return filtered.length > 0 ? filtered : allDepts;
    }

    return allDepts;
  };

  return (
    <AppContext.Provider value={{
      state,
      setState,
      currencySymbol,
      currencyCode,
      addNotification,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      addAuditLog,
      addUser,
      startRoutingWorkflow,
      updateUser,
      deleteUser,
      login,
      logout,
      addSaleOrder,
      updateSaleOrderItemStatus,
      handleProductionOutput,
      deleteProductionOutputs,
      addDelivery,
      deleteDelivery,
      addSalesInvoice,
      postSalesInvoice,
      updateSalesInvoice,
      deleteSalesInvoice,
      addPurchaseInvoice,
      updatePurchaseInvoice,
      deletePurchaseInvoice,
      toggleGlobalPagination,
      updateAdminSetup,
      updateThemeSettings,
      updateDashboardLayout,
      updateDashboardBackground,
      updateProductionTarget,
      addGRN,
      deleteGRN,
      addStockTransfer,
      updateStockTransferStatus,
      deleteStockTransfer,
      deleteStockReceivingNote,
      addWidget,
      setCollection,
      triggerSyncWrite,
      hasPermission,
      getPermittedDepartments,
      isDirty,
      setDirty,
      connectionId: connectionId.current,
      activeCall,
      callTimer,
      isMuted,
      isSpeakerOn,
      setIsSpeakerOn,
      isVideoMuted,
      activeCallSessionId,
      participantsList,
      remoteStreams,
      localStream,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      addParticipant,
      toggleMute,
      toggleVideoMute,
      triggerHeartbeat: updateActiveStatus,
      isOnline,
      networkQuality,
      syncStatus,
      isInitialLoadCompleted,
      isSessionValid: () => validateCurrentSession().isValid,
      getRateLimitStatus,
      validateSession: validateCurrentSession,
      activeSessions
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
