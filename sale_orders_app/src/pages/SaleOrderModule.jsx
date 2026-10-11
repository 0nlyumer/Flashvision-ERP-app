import FGCombinationBuilder from "../components/ui/FGCombinationBuilder";
import { parseRollSizeFromPacking } from "../utils/fgCombinationUtils";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Layout from '../components/Layout';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import ResizableHeader from '../components/ui/ResizableHeader';
import PrintLayout from '../components/ui/PrintLayout';
import UniversalPrintStudioModal from '../components/ui/UniversalPrintStudioModal';
import { exportDocumentToPdf, exportDocumentToImage, exportDocumentToCsv } from '../utils/printExportUtils';

const PAPER_DIMENSIONS = {
  A4: { width: '210mm', height: '297mm', widthLandscape: '297mm', heightLandscape: '210mm' },
  A5: { width: '148mm', height: '210mm', widthLandscape: '210mm', heightLandscape: '148mm' },
  Letter: { width: '8.5in', height: '11in', widthLandscape: '11in', heightLandscape: '8.5in' },
  Legal: { width: '8.5in', height: '14in', widthLandscape: '14in', heightLandscape: '8.5in' },
  Executive: { width: '7.25in', height: '10.5in', widthLandscape: '10.5in', heightLandscape: '7.25in' },
  A3: { width: '297mm', height: '420mm', widthLandscape: '420mm', heightLandscape: '297mm' }
};

// Reusable status badge with popup for cancellation
const StatusBadgeWithAction = ({ orderId, itemCode, status, updateStatus }) => {
  const [showPopup, setShowPopup] = useState(false);
  const badgeRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (badgeRef.current && !badgeRef.current.contains(event.target)) {
        setShowPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCancelClick = () => {
    updateStatus(orderId, itemCode, 'Cancelled');
    setShowPopup(false);
  }

    const getStatusColor = (s) => {
    switch (s) {
      case 'Completed':
      case 'Ready': return 'bg-tertiary/10 text-tertiary ring-1 ring-tertiary/20';
      case 'In Process':
      case 'In Production': return 'bg-primary/10 text-primary ring-1 ring-primary/20';
      case 'Pending': return 'bg-warning/10 text-warning ring-1 ring-warning/20';
      case 'Dispatched': return 'bg-surface-container-highest text-on-surface-variant';
      case 'Cancelled': return 'bg-error/10 text-error ring-1 ring-error/20';
      default: return 'bg-surface-variant text-on-surface-variant';
    }
  };

  return (
    <div className="relative inline-block" ref={badgeRef} onMouseEnter={() => setShowPopup(true)} onMouseLeave={() => setShowPopup(false)}>
      <span className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${getStatusColor(status)}`}>
        {status?.toUpperCase()}
      </span>
      {/* Cancel Popup */}
      {showPopup && status !== 'Cancelled' && status !== 'Completed' && status !== 'Dispatched' && (
        <div className="absolute z-20 top-full mt-1 left-1/2 -translate-x-1/2 w-32 bg-white rounded-lg shadow-xl border border-red-100 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <button 
            type="button" 
            onClick={handleCancelClick}
            className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">cancel</span>
            {itemCode ? 'Cancel Item' : 'Cancel Order'}
          </button>
        </div>
      )}
    </div>
  );
};

const DEFAULT_SALE_ORDER_LAYOUT = {
  paperSize: 'A4',
  orientation: 'portrait',
  headerTheme: 'classic_split',
  repeatHeader: true,
  repeatTableHeader: true,
  showPageNumbers: true,
  pageNumberFormat: 'Page X of Y',
  wrapText: true,
  footerAlign: 'left',
  showCustomFooterText: true,
  customFooterText: 'Computer Generated Copy. Powered by Flashvision ERP.',
  showDisclaimer: true,
  disclaimerText: 'Warranty: Goods once sold are subject to standard warehouse inspection prior to return.',
  termsConditions: '1. All sales are final. Goods once sold will not be returned without a valid RMA.\n2. Please inspect goods before signing. The company is not responsible for transit damage after delivery.',
  headerFields: [
    { key: 'so_number', label: 'Sale Order Number', enabled: true, width: 'span-1', style: { color: '#0f172a', bgColor: '#ffffff' } },
    { key: 'date', label: 'Date', enabled: true, width: 'span-1', style: { color: '#0f172a', bgColor: '#ffffff' } },
    { key: 'status', label: 'Status', enabled: true, width: 'span-1', style: { color: '#0f172a', bgColor: '#ffffff' } },
    { key: 'customer', label: 'Customer', enabled: true, width: 'span-2', style: { color: '#0f172a', bgColor: '#ffffff' } },
    { key: 'contact', label: 'Contact', enabled: true, width: 'span-1', style: { color: '#0f172a', bgColor: '#ffffff' } },
    { key: 'shipping_address', label: 'Shipping Address', enabled: true, width: 'span-3', style: { color: '#0f172a', bgColor: '#ffffff' } },
    { key: 'salesperson', label: 'Salesperson', enabled: true, width: 'span-1', style: { color: '#0f172a', bgColor: '#ffffff' } },
    { key: 'payment_terms', label: 'Net Payment Terms', enabled: true, width: 'span-1', style: { color: '#0f172a', bgColor: '#ffffff' } },
    { key: 'delivery_date', label: 'Expected Delivery Date', enabled: true, width: 'span-1', style: { color: '#0f172a', bgColor: '#ffffff' } },
    { key: 'notes', label: 'Order Note', enabled: false, width: 'span-3', style: { color: '#0f172a', bgColor: '#ffffff' } },
    { key: 'type', label: 'Order Type', enabled: false, width: 'span-1', style: { color: '#0f172a', bgColor: '#ffffff' } }
  ],
  gridColumns: [
    { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center', style: { color: '#ffffff', bgColor: '#004277' } },
    { key: 'item_code', label: 'Item Code', enabled: true, width: '15%', align: 'left', style: { color: '#ffffff', bgColor: '#004277' } },
    { key: 'item_name', label: 'Item Name', enabled: true, width: '25%', align: 'left', style: { color: '#ffffff', bgColor: '#004277' } },
    { key: 'qty', label: 'Order Quantity', enabled: true, width: '10%', align: 'right', style: { color: '#ffffff', bgColor: '#004277' } },
    { key: 'rule', label: 'Rule', enabled: true, width: '8%', align: 'center', style: { color: '#ffffff', bgColor: '#004277' } },
    { key: 'rate', label: 'Rate', enabled: true, width: '10%', align: 'right', style: { color: '#ffffff', bgColor: '#004277' } },
    { key: 'discount', label: 'Discount', enabled: true, width: '8%', align: 'right', style: { color: '#ffffff', bgColor: '#004277' } },
    { key: 'sub_total', label: 'Sub-Total', enabled: true, width: '16%', align: 'right', style: { color: '#ffffff', bgColor: '#004277' } },
    { key: 'remarks', label: 'Line Remarks', enabled: false, width: '15%', align: 'left', style: { color: '#ffffff', bgColor: '#004277' } }
  ],
  signatures: [
    { key: 'sig_prepared', label: 'Prepared By', size: '1/3', type: 'text' },
    { key: 'sig_authorized', label: 'Authorized Signatory', size: '1/3', type: 'stamp' }
  ],
  totalsStyle: { width: '30%', bgColor: '#ffffff', textColor: '#0f172a', borderStyle: 'solid' }
};

export default function SaleOrderModule() {
  const navigate = useNavigate();
  const { state, setState, setCollection, addSaleOrder, updateSaleOrderItemStatus, toggleGlobalPagination } = useApp();
  const { appConfirm, appAlert } = useDialog();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';
  const currencySymbol = state.adminSetup?.baseCurrency ? (state.adminSetup.baseCurrency.match(/\(([^)]+)\)/)?.[1] || '$') : '$';
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const getGlobalMaxItemIndex = (additionalItems = []) => {
    let maxIdx = 0;
    const checkCode = (code) => {
        if (!code) return;
        const match = code.match(/ITM-(\d+)$/);
        if (match) {
            const idx = parseInt(match[1], 10);
            if (idx > maxIdx) maxIdx = idx;
        }
    };
    (state.saleOrders || []).forEach(o => (o.items || []).forEach(i => checkCode(i.itemCode)));
    additionalItems.forEach(i => checkCode(i.itemCode));
    return maxIdx;
  };
  
  // --- Creation & Order States (Declared first to avoid TDZ errors) ---
  const getNextOrderId = () => `SO-${String((state.saleOrders || []).length + 1).padStart(3, '0')}`;

  const [orderMeta, setOrderMeta] = useState({
    id: getNextOrderId(),
    date: new Date().toISOString().split('T')[0],
    status: 'Pending',
    type: 'Standard',
    customerId: '',
    shippingAddress: '',
    expectedDelivery: '',
    notes: '',
    paymentTerms: 'Net 30',
    salesperson: ''
  });

  const [items, setItems] = useState(() => {
    let maxIdx = getGlobalMaxItemIndex();
    return [{
      id: Date.now(),
      itemCode: `ITM-${String(maxIdx + 1).padStart(3, '0')}`,
      itemId: '',
      qty: 50,
      rolls: 1,
      rollSize: 50,
      price: 0,
      discount: 0,
      remarks: ""
    }];
  });

  // Re-sync ID on mount in case it shifted
  useEffect(() => {
    setOrderMeta(prev => ({ ...prev, id: getNextOrderId() }));
  }, [state.saleOrders?.length]);

  // Unsaved Changes Guard State
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState(null);

  const hasUnsavedChanges = useMemo(() => {
    if (activeTab !== 'create') return false;
    const hasCustomer = Boolean(orderMeta.customerId);
    const hasSalesperson = Boolean(orderMeta.salesperson);
    const hasNotes = Boolean(orderMeta.notes?.trim());
    const hasShipping = Boolean(orderMeta.shippingAddress?.trim());
    const hasItems = (items || []).some(i => Boolean(i.itemId) || (i.qty && i.qty > 1) || (i.price && i.price > 0));
    return hasCustomer || hasSalesperson || hasNotes || hasShipping || hasItems;
  }, [activeTab, orderMeta, items]);

  const resetCreateForm = () => {
    setOrderMeta({
      id: getNextOrderId(),
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      type: 'Standard',
      customerId: '',
      shippingAddress: '',
      expectedDelivery: '',
      notes: '',
      paymentTerms: 'Net 30',
      salesperson: ''
    });
    let maxIdx = getGlobalMaxItemIndex();
    setItems([{
      id: Date.now(),
      itemCode: `ITM-${String(maxIdx + 1).padStart(3, '0')}`,
      itemId: '',
      qty: 50,
      rolls: 1,
      rollSize: 50,
      price: 0,
      discount: 0,
      remarks: ""
    }]);
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in this Sale Order. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const tabs = ['dashboard', 'create', 'history'];
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    if (activeTab === 'create' && tabId !== 'create' && hasUnsavedChanges) {
      setPendingNavigationAction(() => () => {
        resetCreateForm();
        setActiveTab(tabId);
        setSearchParams({ tab: tabId }, { replace: true });
      });
      setShowUnsavedModal(true);
      return;
    }
    setActiveTab(tabId);
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const subNavConfig = {
    title: 'Sale Orders',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'create', label: 'Create Sale Order', icon: 'add_shopping_cart' },
      { id: 'history', label: 'Order History', icon: 'history' }
    ],
    activeId: activeTab,
    onSelect: handleTabChange
  };

  const [histCust, setHistCust] = useState('');
  const [histDate, setHistDate] = useState('');
  const [histSO, setHistSO] = useState('');

  const filteredHistory = useMemo(() => {
     let filtered = [...(state.saleOrders || [])].sort((a,b) => new Date(b.date) - new Date(a.date));
     if (histCust) filtered = filtered.filter(o => {
         const c = (state.customers || []).find(x => x.id === o.customerId);
         return c && c.name.toLowerCase().includes(histCust.toLowerCase());
     });
     if (histDate) filtered = filtered.filter(o => o.date === histDate);
     if (histSO) filtered = filtered.filter(o => o.id.toLowerCase().includes(histSO.toLowerCase()));
     return filtered;
  }, [state.saleOrders, state.customers, histCust, histDate, histSO]);

  const isPaginated = state?.isGlobalPaginated;
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const displayedHistory = isPaginated 
      ? filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      : filteredHistory;

  const handlePrevTab = () => {
    const currentIndex = tabs.indexOf(activeTab);
    const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    handleTabChange(tabs[prevIndex]);
  };
  
  const handleNextTab = () => {
    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
    handleTabChange(tabs[nextIndex]);
  };
  
  // --- Dashboard Logic & Widgets ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState({
     Pending: true, 'In Process': true, 'In Production': true, Ready: true, Dispatched: true, Completed: true, Cancelled: true
  });
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const statusFilterRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusFilterRef.current && !statusFilterRef.current.contains(event.target)) {
        setShowStatusFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusFilterChange = (status) => {
    setStatusFilter(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const [dashboardView, setDashboardView] = useState('order-wise'); // 'order-wise' | 'item-wise'
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Widget Modal States
  const [showTotalOrdersModal, setShowTotalOrdersModal] = useState(false);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [ordersHistoryOffset, setOrdersHistoryOffset] = useState(0); // 0 = months 1-6, 1 = months 7-12
  const [processingHistoryOffset, setProcessingHistoryOffset] = useState(0);

  // Timeline Modal State
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineOrderInfo, setTimelineOrderInfo] = useState(null); // { orderId, itemCode, type }
  const [timelineSortOrder, setTimelineSortOrder] = useState('desc'); // 'asc' | 'desc'

  const filteredOrders = (state.saleOrders || []).filter(order => {
    const customer = (state.customers || []).find(c => c.id === order.customerId)?.name || '';
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter[order.status] === true;
    return matchesSearch && matchesStatus;
  });

  const flattenedItems = useMemo(() => {
    const allItems = [];
    filteredOrders.forEach(order => {
      const customer = (state.customers || []).find(c => c.id === order.customerId)?.name || 'Unknown';
      order.items.forEach(item => {
        if (statusFilter[item.status] === true) {
          allItems.push({
            orderId: order.id,
            orderDate: order.date,
            customerName: customer,
            ...item
          });
        }
      });
    });
    return allItems;
  }, [filteredOrders, state.customers, statusFilter]);

  // Timeline Data Calculation
  const timelineEvents = useMemo(() => {
    if (!timelineOrderInfo) return [];
    const events = [];
    
    // 1. Order Creation Event
    const order = state.saleOrders.find(o => o.id === timelineOrderInfo.orderId);
    if (order) {
      if (timelineOrderInfo.type === 'order') {
         events.push({
           type: 'created',
           date: new Date(order.date),
           title: 'Sale Order Created',
           desc: `Total Items: ${order.items.length}`,
           icon: 'receipt_long',
           color: 'text-primary'
         });
      } else {
         const item = order.items.find(i => i.itemCode === timelineOrderInfo.itemCode);
         events.push({
           type: 'created',
           date: new Date(order.date),
           title: 'Item Added to Order',
           desc: `Requested Qty: ${item?.quantity || 0}m`,
           icon: 'add_circle',
           color: 'text-primary'
         });
      }
    }

    // 2. Production Outputs
    (state.productionPlans || []).forEach(plan => {
      (plan.items || []).forEach(pItem => {
         if (pItem.orderId === timelineOrderInfo.orderId && (!timelineOrderInfo.itemCode || pItem.itemCode === timelineOrderInfo.itemCode)) {
            (pItem.outputs || []).forEach(out => {
               events.push({
                 type: 'production',
                 date: new Date(out.date),
                 title: 'Production Output',
                 desc: `${out.quantity}m produced (Plan: ${plan.id})${out.typeName ? ` - ${out.typeName}` : ''}`,
                 icon: 'precision_manufacturing',
                 color: 'text-secondary'
               });
            });
         }
      });
    });

    // 3. Dispatch Events
    const relatedDeliveries = state.deliveries.filter(d => (d.items || []).some(di => di.orderId === timelineOrderInfo.orderId));
    relatedDeliveries.forEach(del => {
      (del.items || []).forEach(delItem => {
         if (delItem.orderId === timelineOrderInfo.orderId && (!timelineOrderInfo.itemCode || delItem.itemCode === timelineOrderInfo.itemCode || delItem.itemId === timelineOrderInfo.itemCode)) {
           let remainingText = '';
           if (delItem.itemCode || delItem.itemId) {
             const soItem = state.saleOrders.find(o => o.id === timelineOrderInfo.orderId)?.items.find(i => i.itemCode === (delItem.itemCode || delItem.itemId) || i.itemId === (delItem.itemCode || delItem.itemId));
             if (soItem) {
                const remaining = Math.max(0, (soItem.quantity || 0) - (soItem.deliveredQty || 0));
                remainingText = `. Remaining: ${remaining}m`;
             }
           }
           events.push({
             type: 'dispatch',
             date: new Date(del.date),
             title: 'Dispatched',
             desc: `${delItem.dispatchedQty || delItem.editedQty || 0}m dispatched (DC: ${del.id})${remainingText}`,
             icon: 'local_shipping',
             color: 'text-tertiary'
           });
         }
      });
    });

    // Sort events
    events.sort((a, b) => timelineSortOrder === 'asc' ? a.date - b.date : b.date - a.date);
    return events;
  }, [timelineOrderInfo, state.saleOrders, state.productionPlans, state.deliveries, timelineSortOrder]);

  const activeSaleOrders = (state.saleOrders || []).filter(o => o.status !== 'Deleted');
  const totalOrders = activeSaleOrders.length;
  
  // M-o-M Calculation for Total Orders
  const momPercentage = useMemo(() => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const currMonthOrders = activeSaleOrders.filter(o => new Date(o.date) >= currentMonthStart).length;
      const lastMonthOrders = activeSaleOrders.filter(o => {
          const d = new Date(o.date);
          return d >= lastMonthStart && d < currentMonthStart;
      }).length;

      if (lastMonthOrders === 0) return currMonthOrders > 0 ? 100 : 0;
      return Math.round(((currMonthOrders - lastMonthOrders) / lastMonthOrders) * 100);
  }, [activeSaleOrders]);
  
  const processingCount = activeSaleOrders.filter(o => {
     if (o.status === 'Completed' || o.status === 'Cancelled') return false;
     const inProduction = state.productionPlans?.some(plan => plan.orderId === o.id);
     const hasOutput = o.items.some(i => (i.producedQty || 0) > 0);
     return inProduction || hasOutput;
  }).length;
  
  const totalRevenue = useMemo(() => {
     let rev = 0;
     activeSaleOrders.forEach(o => {
         if(o.status !== 'Cancelled') {
             o.items.forEach(i => { if(i.status !== 'Cancelled' && i.status !== 'Deleted') rev += (i.quantity * i.price) })
         }
     }); 
     return rev.toLocaleString(undefined, {minimumFractionDigits: 2});
  }, [activeSaleOrders]);

  const hasRevenuePermission = state.users?.[0]?.permissions?.includes('all') || state.users?.[0]?.permissions?.includes('view_revenue');


  const handleQuickReport = (format) => {
     let content = "";
     if (format === 'csv') {
         if (dashboardView === 'order-wise') {
             content = "Order ID,Customer,Date,Status,Total Value\n";
             content += filteredOrders.map(o => {
                 const customer = state.customers.find(c => c.id === o.customerId)?.name || '';
                 const val = o.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                 return `"${o.id}","${customer}","${o.date}","${o.status}","${val}"`;
             }).join('\n');
         } else {
             content = "Item Code,Order ID,Product,Qty,Status,Value\n";
             content += flattenedItems.map(i => {
                 const product = state.items.find(x => x.id === i.itemId)?.name || '';
                 return `"${i.itemCode}","${i.orderId}","${product}","${i.quantity}","${i.status}","${i.quantity * i.price}"`;
             }).join('\n');
         }
     } else {
         content = "PDF EXPORT MOCK\nThis generates a PDF payload for order info.";
     }
     const encodedUri = encodeURI(`data:text/${format};charset=utf-8,${content}`);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `Quick_Report.${format}`);
     document.body.appendChild(link);
     link.click();
     link.remove();
     setShowExportMenu(false);
  };

  const [printOrder, setPrintOrder] = useState(null);
  const [showPrintStudio, setShowPrintStudio] = useState(false);
  const [studioDocData, setStudioDocData] = useState(null);

  // Sync body class for print isolation
  useEffect(() => {
    if (printOrder) {
      document.body.classList.add('has-print-modal');
    } else {
      document.body.classList.remove('has-print-modal');
    }
    return () => {
      document.body.classList.remove('has-print-modal');
    };
  }, [printOrder]);

  // Cross-platform native print bridge
  const triggerNativePrint = () => {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        action: 'print',
        documentId: 'sale_order',
        orderId: printOrder?.id
      }));
    } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.printHandler) {
      window.webkit.messageHandlers.printHandler.postMessage({
        action: 'print',
        documentId: 'sale_order',
        orderId: printOrder?.id
      });
    } else {
      window.print();
    }
  };

  const getSixMonthsData = (ordersList, offset, filterCondition) => {
    const data = [];
    const today = new Date();
    today.setDate(1); // Set to 1st to avoid month length issues
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today);
        d.setMonth(today.getMonth() - (i + (offset * 6)));
        const monthStr = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        
        const count = ordersList.filter(o => {
            const oDate = new Date(o.date);
            return oDate.getMonth() === d.getMonth() && oDate.getFullYear() === d.getFullYear() && filterCondition(o);
        }).length;
        data.push({ month: monthStr, count });
    }
    return data;
  };

  // (Creation logic states moved to top of component)

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + ((item.qty * item.price) - (item.discount || 0)), 0), [items]);

  const handleMetaChange = (field, value) => {
    setOrderMeta(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChosen = (rowId, chosenProd) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === rowId) {
        const prodPrice = chosenProd ? (chosenProd.price || parseFloat(String(chosenProd.price).replace(/[^\d.]/g, '')) || 0) : 0;
        const rollSz = Number(chosenProd?.rollSize || chosenProd?.packingSize || parseRollSizeFromPacking(chosenProd?.combinationDetails?.packing) || 50);
        const currentRolls = Math.max(1, Number(item.rolls) || 1);
        return {
          ...item,
          itemId: chosenProd.id,
          price: prodPrice,
          rollSize: rollSz,
          rolls: currentRolls,
          qty: currentRolls * rollSz // Auto total meters: Rolls * Roll Size!
        };
      }
      return item;
    }));
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if(item.id === id) {
          let updated = { ...item, [field]: value };
          const selectedProd = state.items.find(i => i.id === (field === 'itemId' ? value : updated.itemId));
          const prodRollSz = Number(selectedProd?.rollSize || selectedProd?.packingSize || parseRollSizeFromPacking(selectedProd?.combinationDetails?.packing) || 0);

          if (field === 'itemId') {
              const prodPrice = selectedProd ? (selectedProd.price || parseFloat(String(selectedProd.price).replace(/[^\d.]/g, '')) || 0) : 0;
              const resolvedRollSz = prodRollSz > 0 ? prodRollSz : (Number(item.rollSize) || 50);
              const rollCount = Math.max(1, Number(item.rolls) || 1);
              updated.itemId = value;
              updated.price = prodPrice;
              updated.rollSize = resolvedRollSz;
              updated.rolls = rollCount;
              updated.qty = rollCount * resolvedRollSz; // Auto-calculate total meters!
          }
          if (field === 'rolls') {
               const rollCount = Math.max(0, parseInt(value) || 0);
               const rollSz = Number(item.rollSize || prodRollSz || 50);
               updated.rolls = rollCount;
               updated.qty = rollCount * rollSz; // Total meters = roll quantity * roll size!
          }
          if (field === 'rollSize') {
               const rollSz = Math.max(1, parseFloat(value) || 1);
               const rollCount = Math.max(0, parseInt(item.rolls) || 0);
               updated.rollSize = rollSz;
               updated.qty = rollCount * rollSz; // Auto recalculate meters if roll size changes!
          }
          if (field === 'qty') {
               const qtyVal = Math.max(0, parseFloat(value) || 0);
               const rollSz = Number(item.rollSize || prodRollSz || 50);
               updated.qty = qtyVal;
               updated.rolls = rollSz > 0 ? Math.ceil(qtyVal / rollSz) : 1;
          }
          return updated;
      }
      return item;
    }));
  };

  const addNewItem = () => {
    const maxIdx = getGlobalMaxItemIndex(items);
    const newItemCode = `ITM-${String(maxIdx + 1).padStart(3, '0')}`;
    setItems([...items, {
      id: Date.now(),
      itemCode: newItemCode,
      itemId: "",
      qty: 50,
      rolls: 1,
      rollSize: 50,
      price: 0.00,
      discount: 0.00,
      remarks: ""
    }]);
  };

  const handleEditOrder = async (order) => {
    if (!(await appConfirm('Are you sure you want to edit this order?'))) {
        return;
    }
    setOrderMeta({
       id: order.id,
       date: order.date,
       status: order.status,
       type: order.type || 'Standard',
       customerId: order.customerId,
       shippingAddress: order.shippingAddress || '',
       expectedDelivery: order.expectedDelivery || '',
       notes: order.notes || '',
       paymentTerms: order.paymentTerms || 'Net 30',
       salesperson: order.salesperson || 'Alexander Pierce'
    });
    setItems(order.items.map(it => {
       const prod = state.items.find(p => p.id === it.itemId);
       const rollSz = Number(it.rollSize || prod?.rollSize || prod?.packingSize || parseRollSizeFromPacking(prod?.combinationDetails?.packing) || 50);
       const rollCount = it.rolls || (rollSz > 0 ? Math.ceil((it.quantity || it.qty || 1) / rollSz) : 1);
       return {
         ...it,
         id: it.id || Date.now() + Math.random(),
         itemCode: it.itemCode,
         itemId: it.itemId,
         rollSize: rollSz,
         rolls: rollCount,
         qty: it.quantity || it.qty || (rollCount * rollSz),
         price: it.price || 0,
         discount: it.discount || 0,
         remarks: it.remarks || ""
       };
    }));
    setActiveTab('create');
  };

  const removeItem = async (id) => {
    if (!(await appConfirm('Are you sure you want to remove this item?'))) return;
    if (items.length > 1) {
      // Do not re-number existing itemCodes to prevent repeats
      const newItems = items.filter(item => item.id !== id);
      setItems(newItems);
    } else {
      appAlert("At least one line item is required.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!orderMeta.customerId) {
        appAlert("Please select a customer.");
        return;
    }
    if (!orderMeta.salesperson) {
        appAlert("Please select a salesperson.");
        return;
    }
    const invalidItem = items.find(i => !i.itemId || i.qty <= 0);
    if(invalidItem) {
        appAlert("Please select valid items and quantities greater than zero.");
        return;
    }

    const duplicateIds = items.map(i => i.itemId);
    const hasDuplicates = new Set(duplicateIds).size !== duplicateIds.length;
    if (hasDuplicates) {
        appAlert("Duplicate items are not allowed in the same sale order.");
        return;
    }

    const newOrder = {
      ...orderMeta,
      createdBy: orderMeta.createdBy || state?.users?.[0]?.name || 'Unknown',
      modifiedBy: orderMeta.id.startsWith('SO-') && orderMeta.status !== 'Pending' ? (state?.users?.[0]?.name || 'Unknown') : null,
      modifiedDate: orderMeta.id.startsWith('SO-') && orderMeta.status !== 'Pending' ? new Date().toISOString() : null,
      items: items.map(i => ({
        itemCode: i.itemCode,
        itemId: i.itemId,
        quantity: i.qty,
        rolls: i.rolls,
        rollSize: i.rollSize || 50,
        status: 'Pending',
        producedQty: 0,
        deliveredQty: 0, 
        price: i.price,
        discount: i.discount || 0,
        remarks: i.remarks || ''
      }))
    };

    addSaleOrder(newOrder);
    appAlert(`Order ${orderMeta.id} submitted successfully!`);
    
    // Reset form and switch tab
    const nextId = `SO-${String(state.saleOrders.length + 2).padStart(3, '0')}`;
    setOrderMeta({
        id: nextId,
        date: new Date().toISOString().split('T')[0],
        status: 'Pending',
        type: 'Standard',
        customerId: '',
        shippingAddress: '',
        expectedDelivery: '',
        notes: '',
        paymentTerms: 'Net 30',
        salesperson: ''
    });
    const nextMaxIdx = getGlobalMaxItemIndex(items); // Since we just submitted, those items are 'virtually' the latest max before state updates completely
    setItems([{
        id: Date.now(),
        itemCode: `ITM-${String(nextMaxIdx + 1).padStart(3, '0')}`, 
        itemId: '',
        qty: 1,
        rolls: 1,
        price: 0,
        remarks: ""
    }]);
    setActiveTab('dashboard');
  };

  // Item Search State Handlers (for Floating Portal Dropdown - Never Clipped)
  const [activeSearchId, setActiveSearchId] = useState(null);
  const [searchQueries, setSearchQueries] = useState({});
  const [searchDropdownCoords, setSearchDropdownCoords] = useState({ top: 0, left: 0, width: 480 });
  const searchDropdownRef = useRef(null);
  const activeInputRef = useRef(null);

  const updateSearchDropdownPosition = () => {
    if (activeInputRef.current) {
      const rect = activeInputRef.current.getBoundingClientRect();
      const screenHeight = window.innerHeight;
      const spaceBelow = screenHeight - rect.bottom;
      const dropdownHeight = 320;
      let top = rect.bottom + 6;
      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        top = rect.top - dropdownHeight - 6;
      }
      setSearchDropdownCoords({
        top: Math.round(top),
        left: Math.round(rect.left),
        width: Math.max(480, Math.round(rect.width))
      });
    }
  };

  useEffect(() => {
    if (activeSearchId) {
      updateSearchDropdownPosition();
      const handleScrollOrResize = () => updateSearchDropdownPosition();
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [activeSearchId]);

  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustSearch, setShowCustSearch] = useState(false);
  const custSearchRef = useRef(null);

  useEffect(() => {
    const handleClickOutsideItem = (event) => {
      if (
        searchDropdownRef.current && 
        !searchDropdownRef.current.contains(event.target) &&
        (!activeInputRef.current || !activeInputRef.current.contains(event.target))
      ) {
        setActiveSearchId(null);
      }
      if (custSearchRef.current && !custSearchRef.current.contains(event.target)) {
        setShowCustSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideItem);
    return () => document.removeEventListener('mousedown', handleClickOutsideItem);
  }, []);


  return (
    <div className="h-full w-full print:m-0 print:p-0">
      
    {/* PRINT ONLY UI & PREVIEW MODAL */}
    {printOrder && (() => {
        const printSettings = state.adminSetup?.printSettings || {};
        const localSavedLayout = (() => {
            try {
              const item = localStorage.getItem('fv_print_layout_sale_order');
              return item ? JSON.parse(item) : null;
            } catch(e) { return null; }
          })();
          const salesLayout = localSavedLayout || printSettings.documentLayouts?.sale_order || DEFAULT_SALE_ORDER_LAYOUT;
        
        // Load layout options with fallbacks
        const headerTheme = salesLayout.headerTheme || DEFAULT_SALE_ORDER_LAYOUT.headerTheme;
        const repeatHeader = salesLayout.repeatHeader !== false;
        const repeatTableHeader = salesLayout.repeatTableHeader !== false;
        const showPageNumbers = salesLayout.showPageNumbers !== false;
        const pageNumberFormat = salesLayout.pageNumberFormat || DEFAULT_SALE_ORDER_LAYOUT.pageNumberFormat;
        const wrapText = salesLayout.wrapText !== false;
        const showCustomFooterText = salesLayout.showCustomFooterText !== false;
        const customFooterText = salesLayout.customFooterText || DEFAULT_SALE_ORDER_LAYOUT.customFooterText;
        const showDisclaimer = salesLayout.showDisclaimer !== false;
        const disclaimerText = salesLayout.disclaimerText || DEFAULT_SALE_ORDER_LAYOUT.disclaimerText;
        const termsConditions = salesLayout.termsConditions || DEFAULT_SALE_ORDER_LAYOUT.termsConditions;
        
        const headerFieldsList = salesLayout.headerFields || DEFAULT_SALE_ORDER_LAYOUT.headerFields;
        const gridColumnsList = salesLayout.gridColumns || DEFAULT_SALE_ORDER_LAYOUT.gridColumns;
        const signaturesList = salesLayout.signatures || DEFAULT_SALE_ORDER_LAYOUT.signatures;
        const totalsStyle = salesLayout.totalsStyle || DEFAULT_SALE_ORDER_LAYOUT.totalsStyle;

        const activeHeaderFields = headerFieldsList.filter(f => f.enabled);
        const activeGridColumns = gridColumnsList.filter(c => c.enabled);
        
        // Load company info overrides
        const logoUrl = printSettings.logoUrl || state.adminSetup?.logoUrl || '';
        const address = printSettings.address || state.adminSetup?.address || '123 Logistics Avenue, Industrial Estate, TX 75001';
        const phone = printSettings.phone || state.adminSetup?.phone || '+1 (555) 123-4567';
        const email = printSettings.email || state.adminSetup?.email || 'operations@flashvision.com';
        const companyName = state.adminSetup?.companyName || 'FLASHVISION LOGISTICS';

        // Paper sizing details
        const paperSize = salesLayout.paperSize || 'A4';
        const orientation = salesLayout.orientation || 'portrait';
        const isLandscape = orientation === 'landscape';
        
        const dimensions = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.A4;
        const pageWidth = isLandscape ? dimensions.widthLandscape : dimensions.width;
        const pageHeight = isLandscape ? dimensions.heightLandscape : dimensions.height;
        const paperDetails = {
          width: pageWidth,
          height: pageHeight,
          label: `${paperSize} ${isLandscape ? 'Landscape' : 'Portrait'}`
        };

        // Header field resolver
        const getHeaderFieldValue = (fieldKey, order) => {
          switch (fieldKey) {
            case 'so_number':
              return order.id;
            case 'date':
              return new Date(order.date).toLocaleDateString();
            case 'status':
              return order.status;
            case 'customer': {
              const c = state.customers?.find(cust => cust.id === order.customerId);
              return c ? c.name : 'Unknown Customer';
            }
            case 'contact': {
              const c = state.customers?.find(cust => cust.id === order.customerId);
              return c ? c.contactPerson || 'N/A' : 'N/A';
            }
            case 'shipping_address':
              return order.shippingAddress || 'No shipping address provided.';
            case 'salesperson':
              return order.salesperson || 'Alexander Pierce';
            case 'payment_terms':
              return order.paymentTerms || 'Net 30';
            case 'delivery_date':
              return order.expectedDelivery || 'N/A';
            case 'notes':
              return order.notes || '---';
            case 'type':
              return order.type || 'Standard';
            default:
              return '---';
          }
        };

        // Table column resolver
        const getColumnValue = (colKey, item, index) => {
          switch (colKey) {
            case 'serial_no':
              return String(index + 1).padStart(2, '0');
            case 'item_code':
              return item.itemCode;
            case 'item_name': {
              const prod = state.items?.find(p => p.id === item.itemId);
              return prod ? prod.name : 'Unknown Item';
            }
            case 'qty':
              return `${item.quantity || item.qty} ${state.items?.find(p => p.id === item.itemId)?.unit === 'Meters' ? 'm' : ''}`;
            case 'rolls':
              case 'roll_qty':
              case 'rule':
                return item.rolls || item.rollQty || item.rollsCount || '-';
              case 'uom':
              case 'unit': {
                const prod = state.items?.find(p => p.id === item.itemId);
                return prod?.unit || item.uom || 'Meters';
              }
            case 'rate':
              return Number(item.price || 0).toLocaleString();
            case 'discount':
              return Number(item.discount || 0).toLocaleString();
            case 'sub_total': {
              const sub = ((item.quantity || item.qty) * (item.price || 0)) - (item.discount || 0);
              return Number(sub).toLocaleString();
            }
            case 'remarks':
              return item.remarks || '---';
            default:
              return '---';
          }
        };

        // Render header theme layout (10 designs matching PrintSettings.jsx)
        const renderHeaderThemeLocal = (themeId, order) => {
          const docTitle = "SALE ORDER";
          const logoElement = logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-12 max-h-16 object-contain" />
          ) : (
            <div className="border border-slate-200 border-dashed rounded flex flex-col items-center justify-center bg-slate-50 text-[8px] text-slate-400 font-bold select-none h-12 w-24">
              <span className="material-symbols-outlined text-[12px]">image</span>
              NO LOGO
            </div>
          );

          const infoElement = (
            <div className="text-[9px] text-slate-500 leading-tight">
              <h3 className="font-bold text-slate-800 uppercase tracking-tight text-[10px]">{companyName}</h3>
              <p className="truncate max-w-xs">{address}</p>
              <p>{phone} | {email}</p>
            </div>
          );

          const titleElement = (
            <div className="text-right">
              <h2 className="text-lg font-black uppercase tracking-wider text-slate-850">{docTitle}</h2>
              <span className="text-[8px] text-slate-400 font-mono">Original Copy</span>
            </div>
          );

          switch (themeId) {
            case 'centered_brand':
              return (
                <div className="flex flex-col items-center text-center gap-2 pb-4 mb-4 border-b border-slate-250 w-full">
                  <div className="flex justify-between w-full items-center">
                    <span className="text-[8px] text-slate-400 font-mono">Original Copy</span>
                    <h2 className="text-lg font-black uppercase text-slate-850">{docTitle}</h2>
                  </div>
                  {logoElement}
                  {infoElement}
                </div>
              );
            case 'left_heavy':
              return (
                <div className="flex justify-between items-start pb-4 mb-4 border-b border-slate-250 w-full">
                  <div className="max-w-[50%]">
                    <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tight leading-none mb-1">{docTitle}</h2>
                    <span className="text-[8px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">Ref: {order.id}</span>
                  </div>
                  <div className="flex flex-col items-end text-right gap-1.5">
                    {logoElement}
                    {infoElement}
                  </div>
                </div>
              );
            case 'right_heavy':
              return (
                <div className="flex justify-between items-start pb-4 mb-4 border-b border-slate-250 w-full">
                  <div className="flex gap-3 items-center">
                    {logoElement}
                    {infoElement}
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tight leading-none mb-1">{docTitle}</h2>
                    <p className="text-[9px] text-slate-400">System Generated Document</p>
                  </div>
                </div>
              );
            case 'modern_strip':
              return (
                <div className="flex flex-col gap-3 pb-4 mb-4 border-b border-slate-250 w-full">
                  <div className="bg-slate-800 text-white py-1.5 px-3 rounded-lg flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest">{docTitle}</span>
                    <span className="text-[8px] font-mono tracking-widest uppercase">Verified Outbound Copy</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2 items-center">{logoElement}{infoElement}</div>
                    <span className="text-[9px] text-slate-400 font-mono">Date: {new Date(order.date).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            case 'minimalist_grid':
              return (
                <div className="grid grid-cols-3 gap-2 pb-4 mb-4 border-b border-slate-250 items-center w-full">
                  <div>{logoElement}</div>
                  <div className="text-center">{infoElement}</div>
                  <div className="text-right">
                    <h2 className="text-md font-bold uppercase text-slate-850">{docTitle}</h2>
                    <span className="text-[8px] text-slate-400 font-mono">{order.id}</span>
                  </div>
                </div>
              );
            case 'elegant_divider':
              return (
                <div className="flex flex-col gap-2 pb-4 mb-4 w-full">
                  <div className="flex justify-between items-end">
                    <h2 className="text-xl font-bold uppercase tracking-wide text-slate-850">{docTitle}</h2>
                    {logoElement}
                  </div>
                  <div className="h-0.5 bg-slate-300 w-full mb-1"></div>
                  <div className="text-left">{infoElement}</div>
                </div>
              );
            case 'corporate_boxed':
              return (
                <div className="flex justify-between items-stretch gap-4 pb-4 mb-4 border-b border-slate-250 w-full">
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex-1 flex gap-3 items-center">
                    {logoElement}
                    {infoElement}
                  </div>
                  <div className="flex flex-col justify-between text-right p-1 shrink-0">
                    <h2 className="text-lg font-black uppercase tracking-wider text-slate-900">{docTitle}</h2>
                    <span className="text-[8px] text-slate-400 font-mono">Date: {new Date(order.date).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            case 'accent_stripe':
              return (
                <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-250 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-10 bg-slate-800 rounded-full"></div>
                    <div>
                      <h2 className="text-md font-black uppercase text-slate-850 tracking-wide leading-tight">{docTitle}</h2>
                      <span className="text-[9px] text-slate-400">{companyName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {infoElement}
                    {logoElement}
                  </div>
                </div>
              );
            case 'invoice_editorial':
              return (
                <div className="flex flex-col pb-4 mb-4 border-b-2 border-slate-850 w-full">
                  <div className="flex justify-between items-baseline">
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-850 leading-none">{docTitle}</h2>
                    <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">SO Ref: {order.id}</span>
                  </div>
                  <div className="flex justify-between items-end mt-4">
                    {logoElement}
                    <div className="text-right text-[8px] text-slate-400 tracking-wider">
                      <p className="font-bold text-slate-600 uppercase">{companyName}</p>
                      <p>{address}</p>
                    </div>
                  </div>
                </div>
              );
            case 'classic_split':
            default:
              return (
                <div className="flex justify-between items-start pb-4 mb-4 border-b border-slate-250 w-full">
                  <div className="flex items-center gap-3 max-w-[60%]">
                    {logoElement}
                    {infoElement}
                  </div>
                  {titleElement}
                </div>
              );
          }
        };

        // Chunk items list dynamically based on height constraints
        const getPagesForPrint = (itemsList) => {
          const pages = [];
          const maxOnFirstPage = Number(salesLayout.firstPageRows || (repeatHeader ? 6 : 8));
            const maxOnSubsequentPages = Number(salesLayout.continuationPageRows || (repeatHeader ? 6 : 14));

          let remainingItems = [...itemsList];
          
          // Page 1
          const p1Items = remainingItems.splice(0, maxOnFirstPage);
          pages.push(p1Items);
          
          // Subsequent pages
          while (remainingItems.length > 0) {
            const pItems = remainingItems.splice(0, maxOnSubsequentPages);
            pages.push(pItems);
          }
          
          return pages;
        };

        const pages = getPagesForPrint(printOrder.items);

        return createPortal(
          <>
              {/* Styles for print overlay to hide everything except the print modal */}
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  @page {
                    size: ${paperDetails.width} ${paperDetails.height} !important;
                    margin: 0 !important;
                  }
                  body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                  }
                  body > *:not(#antigravity-print-preview-modal) {
                    display: none !important;
                  }
                  #antigravity-print-preview-modal, #antigravity-print-preview-modal * {
                    visibility: visible !important;
                  }
                  #antigravity-print-preview-modal {
                    position: static !important;
                    background: transparent !important;
                    backdrop-filter: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    overflow: visible !important;
                    width: ${paperDetails.width} !important;
                    height: auto !important;
                    display: block !important;
                  }
                  .print-preview-control-header {
                    display: none !important;
                  }
                  .print-preview-page-break {
                    page-break-after: always !important;
                    break-after: page !important;
                  }
                  .print-preview-page {
                    box-shadow: none !important;
                    border: none !important;
                    margin: 0 !important;
                    padding: ${printSettings.margin || '0.5in'} !important;
                    width: ${paperDetails.width} !important;
                    height: ${paperDetails.height} !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }
                }
              ` }} />

              {/* Digital Twin Print Preview Modal */}
              <div 
                id="antigravity-print-preview-modal"
                className="fixed inset-0 z-[110] bg-slate-900/90 backdrop-blur-md flex flex-col items-center p-8 overflow-y-auto"
              >
                {/* Controls Bar at top */}
                <div className="w-full max-w-[800px] bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-xl flex justify-between items-center print-preview-control-header">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 text-primary p-2 rounded-xl">
                      <span className="material-symbols-outlined text-[20px] font-bold">print</span>
                    </div>
                    <div className="text-left font-sans">
                      <h4 className="text-sm font-black text-slate-800">Print Preview Digital Twin</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Doc: Sale Order ({paperDetails.label})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-sans">
                    <button
                      type="button"
                      onClick={() => setPrintOrder(null)}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Close Preview
                    </button>
                    
                    <button
                      type="button"
                      onClick={triggerNativePrint}
                      className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary/95 transition-all shadow flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] font-bold">print</span>
                      Confirm &amp; Print
                    </button>
                  </div>
                </div>

                {/* Stacked Pages Mockup */}
                <div className="w-full max-w-[800px] flex flex-col gap-8 items-center bg-transparent select-none">
                   {pages.map((pageItems, pageIdx) => {
                      const isFirstPage = pageIdx === 0;
                      const isLastPage = pageIdx === pages.length - 1;
                      
                      return (
                         <div 
                           key={pageIdx}
                           className="bg-white text-slate-850 p-8 flex flex-col relative transition-all duration-300 overflow-hidden print-preview-page"
                           style={{ 
                             width: paperDetails.width,
                             height: paperDetails.height,
                             minWidth: paperDetails.width,
                             minHeight: paperDetails.height,
                             fontSize: printSettings.fontSize || '12px',
                             padding: printSettings.margin || '0.5in',
                             boxSizing: 'border-box'
                           }}
                         >
                            {/* Page Header Theme */}
                            {(isFirstPage || repeatHeader) ? (
                               renderHeaderThemeLocal(headerTheme, printOrder)
                            ) : (
                               <div className="pb-2 mb-4 border-b border-dashed border-slate-100 flex justify-between items-center text-[8px] text-slate-400 italic font-sans w-full">
                                 <span>Sale Order - Continuation sheet ({printOrder.id})</span>
                                 <span>Page {pageIdx + 1} of {pages.length}</span>
                                </div>
                            )}

                            {/* Metadata Grid (only on first page) */}
                            {isFirstPage && (
                              <div className="mb-6 w-full">
                                <div className="grid grid-cols-3 gap-2 w-full">
                                  {activeHeaderFields.map(field => {
                                    const spanClass = field.width === 'span-2' ? 'col-span-2' : (field.width === 'span-3' ? 'col-span-3' : 'col-span-1');
                                    return (
                                      <div
                                        key={field.key}
                                        className={`border p-2 rounded-lg flex flex-col ${spanClass}`}
                                        style={{
                                          backgroundColor: field.style?.bgColor || '#ffffff',
                                          color: field.style?.color || '#0f172a'
                                        }}
                                      >
                                        <span className="text-[8px] uppercase font-bold text-slate-400 tracking-wider font-sans">{field.label}</span>
                                        <span className="text-[10px] font-bold mt-0.5 truncate font-mono text-slate-850">
                                          {getHeaderFieldValue(field.key, printOrder)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Items Grid Table */}
                            <div className="flex-grow border border-slate-200 rounded-lg overflow-hidden bg-white mb-4 w-full">
                              <table className="w-full border-collapse text-left font-sans">
                                 {/* Table Header Row */}
                                 {(isFirstPage || repeatTableHeader) && (
                                    <thead>
                                      <tr>
                                        {activeGridColumns.map(col => {
                                          const alignClass = col.align === 'right' ? 'text-right' : (col.align === 'center' ? 'text-center' : 'text-left');
                                          return (
                                            <th 
                                              key={col.key} 
                                              className={`p-2 border border-slate-200 text-[9px] ${alignClass}`}
                                              style={{ 
                                                width: col.width,
                                                backgroundColor: col.style?.bgColor || '#004277',
                                                color: col.style?.color || '#ffffff'
                                              }}
                                            >
                                              {col.label}
                                            </th>
                                          );
                                        })}
                                      </tr>
                                    </thead>
                                 )}
                                 <tbody>
                                    {pageItems.map((item, itemIdx) => {
                                       const absIndex = pages.slice(0, pageIdx).reduce((acc, p) => acc + p.length, 0) + itemIdx;
                                       return (
                                          <tr key={absIndex} className="hover:bg-slate-50/50">
                                            {activeGridColumns.map(col => {
                                              const alignClass = col.align === 'right' ? 'text-right' : (col.align === 'center' ? 'text-center' : 'text-left');
                                              return (
                                                <td key={col.key} className={`p-2 border border-slate-100 text-[8px] text-slate-700 font-mono ${alignClass}`}>
                                                  {getColumnValue(col.key, item, absIndex)}
                                                </td>
                                              );
                                            })}
                                          </tr>
                                       );
                                    })}
                                 </tbody>
                              </table>
                            </div>

                            {/* Totals, Disclaimers, Signatures (Only on last page) */}
                            {isLastPage && (
                              <div className="mt-auto w-full">
                                {/* Totals calculation and styling */}
                                <div 
                                  className="ml-auto border p-3 rounded-xl bg-white mb-4"
                                  style={{
                                    width: totalsStyle?.width || '30%',
                                    backgroundColor: totalsStyle?.bgColor || '#ffffff',
                                    color: totalsStyle?.textColor || '#0f172a',
                                    borderStyle: totalsStyle?.borderStyle || 'solid'
                                  }}
                                >
                                  <div className="space-y-1 text-[9px] font-sans">
                                    <div className="flex justify-between text-slate-500">
                                      <span>Subtotal:</span>
                                      <span className="font-mono font-bold">
                                        {currencyCode} {printOrder.items.reduce((sum, item) => sum + (item.quantity * item.price), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                      <span>Discount:</span>
                                      <span className="font-mono font-bold">
                                        {currencyCode} {printOrder.items.reduce((sum, item) => sum + (item.discount || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-300 pt-1 font-bold text-slate-850">
                                      <span>Grand Total:</span>
                                      <span className="font-mono font-black">
                                        {currencyCode} {(printOrder.items.reduce((sum, item) => sum + (item.quantity * item.price), 0) - printOrder.items.reduce((sum, item) => sum + (item.discount || 0), 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Terms & Conditions and Disclaimer */}
                                <div className="border-t border-slate-300 pt-3">
                                  <div className="grid grid-cols-2 gap-4 mb-4 font-sans text-left">
                                    <div className="text-[8px] leading-tight">
                                      <span className="font-bold text-slate-400 block mb-1">Terms &amp; Conditions</span>
                                      <p className={`text-slate-500 whitespace-pre-line ${wrapText ? 'break-all text-justify' : 'truncate'}`}>
                                        {termsConditions}
                                      </p>
                                    </div>
                                    {showDisclaimer && (
                                      <div className="text-[8px] leading-tight border-l border-slate-200 pl-3">
                                        <span className="font-bold text-slate-400 block mb-1">Disclaimer</span>
                                        <p className={`text-slate-500 ${wrapText ? 'break-all text-justify' : 'truncate'}`}>
                                          {disclaimerText}
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Signatures */}
                                  {signaturesList && signaturesList.length > 0 && (
                                    <div className="flex gap-4 justify-between items-end mb-4 border-t border-slate-100 pt-3">
                                      {signaturesList.map(sig => {
                                        const widthClass = sig.size === 'full' ? 'w-full' : (sig.size === '1/2' ? 'w-1/2' : 'w-1/3');
                                        return (
                                          <div key={sig.key} className={`text-center flex flex-col items-center ${widthClass}`}>
                                            {sig.type === 'stamp' ? (
                                              <div className="w-14 h-8 rounded-full border border-dashed border-primary/30 flex items-center justify-center text-[7px] text-primary/45 font-bold uppercase mb-1">
                                                STAMP ZONE
                                              </div>
                                            ) : (
                                              <div className="h-6"></div>
                                            )}
                                            <div className="border-b border-slate-300 w-32 mb-1"></div>
                                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{sig.label}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Page Footer Attribution */}
                            <div className="mt-auto pt-4 flex justify-between items-center border-t border-slate-100 text-[8px] text-slate-450 font-mono w-full">
                              <span>{showCustomFooterText ? customFooterText : 'Digital Outbound Document.'}</span>
                              {showPageNumbers && (
                                <span>
                                  {pageNumberFormat === 'X/Y' ? `${pageIdx + 1}/${pages.length}` : (pageNumberFormat === 'Page X' ? `Page ${pageIdx + 1}` : `Page ${pageIdx + 1} of ${pages.length}`)}
                                </span>
                              )}
                            </div>
                         </div>
                      );
                   })}
                </div>
             </div>
          </>, document.body
        );
    })()}

    {/* MAIN APP (hidden during print) */}
    <div className="h-full w-full print:hidden">

    {/* Timeline Modal */}
    {showTimelineModal && timelineOrderInfo && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
         <div className="bg-surface text-on-surface w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
             <div className="bg-surface-container-lowest px-8 py-6 border-b border-outline-variant/20 flex justify-between items-center">
                 <div>
                     <h2 className="text-2xl font-extrabold tracking-tight">Timeline & Tracking</h2>
                     <p className="text-sm font-semibold text-on-surface-variant">Order <span className="font-mono bg-surface-container px-1 py-0.5 rounded mx-1 text-primary">{timelineOrderInfo.orderId}</span> {timelineOrderInfo.itemCode && <span>• Item <span className="font-mono bg-surface-container px-1 py-0.5 rounded ml-1 text-secondary">{timelineOrderInfo.itemCode}</span></span>}</p>
                 </div>
                 <button onClick={() => setShowTimelineModal(false)} className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors">
                     <span className="material-symbols-outlined">close</span>
                 </button>
             </div>
             <div className="p-8 overflow-y-auto flex-1 bg-surface-container-lowest">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-on-surface">Event History</h3>
                    <button onClick={() => setTimelineSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="text-xs font-bold bg-surface-container px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-surface-container-high transition-colors text-slate-600">
                       <span className="material-symbols-outlined text-[14px]">swap_vert</span>
                       {timelineSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                    </button>
                 </div>
                 {timelineEvents && timelineEvents.length > 0 ? (
                     <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-outline-variant/20 before:to-transparent">
                         {timelineEvents.map((evt, idx) => (
                             <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active animate-in fade-in slide-in-from-bottom-2 duration-300" style={{animationFillMode: 'both', animationDelay: `${idx * 50}ms`}}>
                                 <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface ${evt.color.replace('text-', 'bg-')} text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2`}>
                                     <span className="material-symbols-outlined text-[18px]">{evt.icon}</span>
                                 </div>
                                 <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-outline-variant/10 shadow-sm group-hover:border-primary/20 group-hover:shadow-md transition-all">
                                     <div className="flex justify-between items-start mb-2">
                                         <span className={`font-extrabold ${evt.color} text-base`}>{evt.title}</span>
                                         <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-1 rounded tracking-wider uppercase">{evt.date.toLocaleDateString()}</span>
                                     </div>
                                     <p className="text-sm font-semibold text-slate-600">{evt.desc}</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="text-center py-10 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                         <span className="material-symbols-outlined text-4xl text-outline mb-2">hourglass_empty</span>
                         <p className="text-on-surface-variant font-medium text-sm">No tracking events recorded yet.</p>
                     </div>
                 )}
             </div>
         </div>
      </div>
    )}

    <Layout subNavConfig={subNavConfig}>
      {/* Navigation Tabs Moved to Left Sidebar */}

      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
          {/* Header Section with Arrows */}
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex mr-2">
                <button onClick={() => navigate('/')} className="w-9 h-9 flex items-center justify-center bg-surface hover:bg-surface-container-low rounded-lg border border-outline-variant/30 text-slate-500 hover:text-primary transition-all shadow-sm" title="Back to Home"><span className="material-symbols-outlined text-[18px]">arrow_back</span></button>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight text-on-surface font-headline">All Sale Orders</h1>
                <p className="text-on-surface-variant mt-2 max-w-lg font-body">Manage, track, and monitor your global sales pipeline with real-time logistics intelligence.</p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              {/* History Quick Access Button */}
              <button 
                onClick={() => setActiveTab('history')}
                className="bg-surface-container hover:bg-surface-container-high text-on-surface text-sm font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 border border-outline-variant/20 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                Sale Order History
              </button>

              {/* VIEW MODE TOGGLE BUTTONS */}
              <div className="flex p-1 bg-surface-container-low rounded-xl border border-outline-variant/20 shadow-sm">
                <button 
                  onClick={() => setDashboardView('order-wise')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${dashboardView === 'order-wise' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  Order Wise
                </button>
                <button 
                  onClick={() => setDashboardView('item-wise')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${dashboardView === 'item-wise' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">category</span>
                  Item Wise
                </button>
              </div>
            </div>
          </div>
          
          {/* Bento Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 select-none">
            <div 
              onDoubleClick={() => { setShowTotalOrdersModal(true); setOrdersHistoryOffset(0); }} 
              className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_20px_40px_rgba(0,28,56,0.04)] border border-outline-variant/10 group hover:-translate-y-1 transition-transform cursor-pointer"
              title="Double click for 6-month history"
            >
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Total Sale Orders</p>
              <p className="text-3xl font-extrabold text-on-surface">{totalOrders}</p>
              <div className={`mt-4 flex items-center text-xs font-semibold ${momPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span className="material-symbols-outlined text-sm mr-1">{momPercentage >= 0 ? 'trending_up' : 'trending_down'}</span> 
                {momPercentage >= 0 ? '+' : ''}{momPercentage}% from last month
              </div>
            </div>
            
            <div 
              onClick={() => { setShowProcessingModal(true); setProcessingHistoryOffset(0); }}
              className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_20px_40px_rgba(0,28,56,0.04)] border border-outline-variant/10 group hover:-translate-y-1 transition-transform cursor-pointer"
              title="Click for completed orders history"
            >
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Processing</p>
              <p className="text-3xl font-extrabold text-on-surface">{processingCount}</p>
              <div className="mt-4 flex items-center text-xs text-secondary font-semibold">
                <span className="material-symbols-outlined text-sm mr-1">bolt</span> Active in Production
              </div>
            </div>

            {hasRevenuePermission ? (
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_20px_40px_rgba(0,28,56,0.04)] border border-outline-variant/10 group hover:-translate-y-1 transition-transform">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Revenue (Total)</p>
                <p className="text-3xl font-extrabold text-tertiary">{totalRevenue}</p>
                <div className="mt-4 flex items-center text-xs text-tertiary font-semibold">
                  <span className="material-symbols-outlined text-sm mr-1">payments</span> Live settlement estimation
                </div>
              </div>
            ) : (
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 flex items-center justify-center opacity-50">
                 <div className="text-center">
                    <span className="material-symbols-outlined text-2xl text-slate-400">lock</span>
                    <p className="text-xs font-bold text-slate-400 mt-2">Restricted Access</p>
                 </div>
              </div>
            )}
            <div className="bg-primary/5 p-6 rounded-xl border border-primary/10 flex items-center justify-between group hover:-translate-y-1 transition-transform relative">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Quick Report</p>
                <p className="text-sm font-medium text-primary-container leading-tight">Generate full export for {dashboardView === 'order-wise' ? 'Orders' : 'Items'}.</p>
              </div>
              <div className="relative">
                <button onClick={() => setShowExportMenu(!showExportMenu)} className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center relative hover:opacity-90 shadow-md transition-all">
                  <span className="material-symbols-outlined">download</span>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-12 bg-white shadow-xl rounded-xl border border-outline-variant/20 overflow-hidden z-20 flex flex-col w-36 py-1 animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => handleQuickReport('csv')} className="px-4 py-3 hover:bg-surface-container-low text-sm font-bold text-left w-full flex items-center gap-2 transition-colors text-slate-700 hover:text-primary"><span className="material-symbols-outlined text-[18px]">table_chart</span> CSV / Excel</button>
                    <button onClick={() => handleQuickReport('pdf')} className="px-4 py-3 hover:bg-surface-container-low text-sm font-bold text-left w-full flex items-center gap-2 transition-colors text-slate-700 hover:text-primary"><span className="material-symbols-outlined text-[18px]">picture_as_pdf</span> PDF Report</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search and Multi-Select Filters */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
              <div className="relative w-full md:max-w-md">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline">search</span>
                <input 
                   type="text" 
                   className="w-full bg-surface-container-lowest border-none font-body text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-primary/20 shadow-sm" 
                   placeholder={dashboardView === 'order-wise' ? "Search orders or customers..." : "Search items, codes, or orders..."}
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 relative w-full md:w-auto" ref={statusFilterRef}>
                 <span className="text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Status:</span>
                 <button 
                   onClick={() => setShowStatusFilter(!showStatusFilter)} 
                   className="bg-surface-container-lowest border-none shadow-sm font-bold text-sm rounded-lg px-4 py-2 flex items-center justify-between gap-4 hover:bg-surface-container-high transition-colors w-full md:w-auto"
                 >
                   <span>{Object.values(statusFilter).filter(Boolean).length} Selected</span>
                   <span className="material-symbols-outlined text-[18px] text-slate-400">arrow_drop_down</span>
                 </button>
                 
                 {showStatusFilter && (
                    <div className="absolute right-0 top-12 mt-1 w-48 bg-white shadow-xl rounded-xl border border-outline-variant/20 py-2 z-30 animate-in fade-in zoom-in-95 duration-200">
                       {Object.keys(statusFilter).map(statusKey => (
                          <label key={statusKey} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-low cursor-pointer transition-colors group">
                             <div className="relative flex items-center justify-center">
                               <input 
                                  type="checkbox" 
                                  checked={statusFilter[statusKey]} 
                                  onChange={() => handleStatusFilterChange(statusKey)}
                                  className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-outline-variant/50 cursor-pointer"
                               />
                             </div>
                             <span className="text-sm font-bold text-slate-700 group-hover:text-primary transition-colors">{statusKey}</span>
                          </label>
                       ))}
                    </div>
                 )}
              </div>
          </div>

          {/* Table Section */}
          <div className="bg-surface-container-lowest rounded-xl shadow-[0_20px_40px_rgba(0,28,56,0.04)] overflow-hidden border border-outline-variant/10">
            <div className="overflow-x-auto min-h-[300px]">
              {dashboardView === 'order-wise' ? (
                /* ORDER-WISE TABLE with Auto-layout */
                <table className="w-full text-left border-collapse table-auto whitespace-nowrap">
                  <thead>
                    <tr className="bg-surface-container-low dark:bg-[#121620] border-y border-outline-variant/10">
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant w-1">Order ID</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant w-1">Date</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Customer</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right w-24">Order Metres</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right w-32">Output (m)</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right w-32">Dispatched (m)</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right w-32">Value ({currencyCode})</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant w-32">Status</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right w-1">Actions</ResizableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low font-body text-sm">
                    {filteredOrders.length > 0 ? filteredOrders.map(order => {
                      const customer = state.customers.find(c => c.id === order.customerId);
                      const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
                      const outputCount = order.items.reduce((sum, item) => sum + (item.producedQty || 0), 0);
                      const dispatchedCount = order.items.reduce((sum, item) => sum + (item.deliveredQty || 0), 0);
                      const orderValue = order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                      
                      return (
                      <tr key={order.id} className="hover:bg-surface-container-low/30 transition-colors group">
                        <td className="px-6 py-5 font-bold text-on-surface">{order.id}</td>
                        <td className="px-6 py-5 text-on-surface-variant font-medium">{new Date(order.date).toLocaleDateString()}</td>
                        <td className="px-6 py-5">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-secondary-container/50 flex items-center justify-center text-xs font-bold text-secondary">
                              {customer?.name?.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-800">{customer?.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right font-bold text-slate-600">{itemCount}</td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-slate-700 text-xs">{outputCount} / {itemCount}</span>
                            <div className="w-16 h-1 mt-1.5 bg-surface-container rounded-full overflow-hidden">
                              <div className="h-full bg-secondary" style={{ width: `${itemCount > 0 ? Math.min((outputCount/itemCount)*100, 100) : 0}%`}}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-tertiary text-xs">{dispatchedCount} / {itemCount}</span>
                            <div className="w-16 h-1 mt-1.5 bg-surface-container rounded-full overflow-hidden">
                              <div className="h-full bg-tertiary" style={{ width: `${itemCount > 0 ? Math.min((dispatchedCount/itemCount)*100, 100) : 0}%`}}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 font-extrabold text-slate-800 text-right">{orderValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td className="px-6 py-5 overflow-visible">
                           <StatusBadgeWithAction orderId={order.id} itemCode={null} status={order.status} updateStatus={updateSaleOrderItemStatus} />
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end space-x-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setTimelineOrderInfo({ orderId: order.id, itemCode: null, type: 'order' }); setShowTimelineModal(true); }} className="p-2 hover:text-primary transition-colors hover:bg-primary/10 rounded-lg" title="Timeline View"><span className="material-symbols-outlined text-[20px]">history</span></button>
                            <button onClick={() => handleEditOrder(order)} className="p-2 hover:text-primary transition-colors hover:bg-primary/10 rounded-lg" title="Modify"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                            <button onClick={() => setPrintOrder(order)} className="p-2 hover:text-primary transition-colors hover:bg-primary/10 rounded-lg" title="Print"><span className="material-symbols-outlined text-[20px]">print</span></button>
                          </div>
                        </td>
                      </tr>
                      );
                    }) : (
                       <tr>
                          <td colSpan="9" className="px-6 py-16 text-center text-slate-500 font-bold italic">No orders found matching criteria.</td>
                       </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                /* ITEM-WISE TABLE with Auto-layout */
                <table className="w-full text-left border-collapse table-auto whitespace-nowrap animate-in fade-in duration-300">
                  <thead>
                    <tr className="bg-surface-container-low dark:bg-[#121620] border-y border-outline-variant/10">
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant w-1">Date</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant w-1">Order Details</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Item Info</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right w-24">Order Metres</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-slate-700 text-right w-32">Output (m)</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-tertiary text-right w-32">Dispatched (m)</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right w-24">Pending</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant w-32">Item Status</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right w-1">Actions</ResizableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low font-body text-sm">
                    {flattenedItems.length > 0 ? flattenedItems.map((item, idx) => {
                      const prodObj = state.items.find(i => i.id === item.itemId);
                      const pendingQty = item.quantity - (item.deliveredQty || 0);

                      return (
                      <tr key={`${item.orderId}-${idx}`} className="hover:bg-surface-container-low/30 transition-colors group">
                        <td className="px-6 py-5 text-on-surface-variant font-bold">{new Date(item.orderDate).toLocaleDateString()}</td>
                        <td className="px-6 py-5">
                          <div className="font-extrabold text-on-surface">{item.orderId}</div>
                          <div className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-wider font-bold truncate max-w-[150px]">{item.customerName}</div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-mono text-xs font-bold bg-slate-100 text-slate-800 rounded px-2 py-0.5 inline-block mb-1.5 border border-slate-200">{item.itemCode}</div>
                          <div className="text-sm font-semibold text-slate-700">{prodObj?.name || 'Unknown Item'}</div>
                        </td>
                        <td className="px-6 py-5 text-right font-extrabold text-slate-800">{item.quantity}</td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-slate-700 text-xs">{item.producedQty || 0} / {item.quantity}</span>
                            <div className="w-16 h-1 mt-1.5 bg-surface-container rounded-full overflow-hidden">
                              <div className="h-full bg-secondary" style={{ width: `${item.quantity > 0 ? Math.min(((item.producedQty || 0)/item.quantity)*100, 100) : 0}%`}}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-tertiary text-xs">{item.deliveredQty || 0} / {item.quantity}</span>
                            <div className="w-16 h-1 mt-1.5 bg-surface-container rounded-full overflow-hidden">
                              <div className="h-full bg-tertiary" style={{ width: `${item.quantity > 0 ? Math.min(((item.deliveredQty || 0)/item.quantity)*100, 100) : 0}%`}}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right font-bold text-slate-500">{pendingQty}</td>
                        <td className="px-6 py-5 overflow-visible">
                           <StatusBadgeWithAction orderId={item.orderId} itemCode={item.itemCode} status={item.status} updateStatus={updateSaleOrderItemStatus} />
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end space-x-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setTimelineOrderInfo({ orderId: item.orderId, itemCode: item.itemCode, type: 'item' }); setShowTimelineModal(true); }} className="p-2 hover:text-primary transition-colors hover:bg-primary/10 rounded-lg" title="Timeline View"><span className="material-symbols-outlined text-[20px]">history</span></button>
                          </div>
                        </td>
                      </tr>
                      );
                    }) : (
                       <tr>
                          <td colSpan="8" className="px-6 py-16 text-center text-slate-500 font-bold italic">No items found matching the selected filters.</td>
                       </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Pagination */}
            <div className="p-4 border-t border-surface-container-low flex items-center justify-between">
              <p className="text-xs text-on-surface-variant font-bold">
                Showing {dashboardView === 'order-wise' ? filteredOrders.length + ' orders' : flattenedItems.length + ' line items'}
              </p>
              <div className="flex items-center space-x-2">
                <button className="p-2 rounded-lg hover:bg-surface-container-low disabled:opacity-30 transition-colors" disabled><span className="material-symbols-outlined text-[20px]">chevron_left</span></button>
                <button className="w-8 h-8 rounded-lg bg-primary text-white text-xs font-bold shadow-md">1</button>
                <button className="p-2 rounded-lg hover:bg-surface-container-low disabled:opacity-30 transition-colors" disabled><span className="material-symbols-outlined text-[20px]">chevron_right</span></button>
              </div>
            </div>
          </div>
          
          {/* --- Dashboard Modals --- */}
          {showTotalOrdersModal && (() => {
             const data = getSixMonthsData(activeSaleOrders, ordersHistoryOffset, () => true);
             return (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
                 <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-slide-up relative">
                    <button onClick={() => setShowTotalOrdersModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors">
                       <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                    <h3 className="text-xl font-bold text-on-surface mb-2">Total Sale Orders History</h3>
                    <p className="text-sm text-on-surface-variant mb-6">Showing historical trend for order volume.</p>
                    
                    <div className="flex justify-between items-end h-48 mb-6 border-b border-surface-container pb-2 px-2 gap-2">
                       {data.map((item, idx) => {
                          const maxCount = Math.max(...data.map(d => d.count), 1);
                          const heightPct = Math.round((item.count / maxCount) * 100);
                          return (
                             <div key={idx} className="flex flex-col items-center flex-1 group">
                                <div className="text-xs font-bold text-primary mb-2 opacity-0 group-hover:opacity-100 transition-opacity">{item.count}</div>
                                <div className="w-full bg-primary/20 rounded-t-lg relative overflow-hidden group-hover:bg-primary/30 transition-colors" style={{ height: `${heightPct}%`, minHeight: '4px' }}>
                                   <div className="absolute bottom-0 w-full bg-primary rounded-t-lg transition-all duration-500" style={{ height: '100%' }}></div>
                                </div>
                                <div className="text-[10px] font-bold text-on-surface-variant mt-2 uppercase">{item.month}</div>
                             </div>
                          );
                       })}
                    </div>
                    
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-surface-container">
                       <button onClick={() => setOrdersHistoryOffset(prev => prev + 1)} className="px-4 py-2 bg-surface border border-outline-variant/30 text-on-surface rounded-xl text-xs font-bold hover:bg-surface-container flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">arrow_back</span> Previous 6 Months
                       </button>
                       <span className="text-xs font-bold text-slate-400">Offset: {ordersHistoryOffset * 6} months</span>
                       <button disabled={ordersHistoryOffset === 0} onClick={() => setOrdersHistoryOffset(prev => Math.max(0, prev - 1))} className={`px-4 py-2 bg-surface border border-outline-variant/30 text-on-surface rounded-xl text-xs font-bold flex items-center gap-1 ${ordersHistoryOffset === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-container'}`}>
                          Next 6 Months <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                       </button>
                    </div>
                 </div>
               </div>
             );
          })()}

          {showProcessingModal && (() => {
             const data = getSixMonthsData(activeSaleOrders, processingHistoryOffset, o => o.status === 'Completed');
             return (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
                 <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-slide-up relative">
                    <button onClick={() => setShowProcessingModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors">
                       <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                    <h3 className="text-xl font-bold text-on-surface mb-2">Completed Orders History</h3>
                    <p className="text-sm text-on-surface-variant mb-6">Showing historical trend for completed order processing.</p>
                    
                    <div className="flex justify-between items-end h-48 mb-6 border-b border-surface-container pb-2 px-2 gap-2">
                       {data.map((item, idx) => {
                          const maxCount = Math.max(...data.map(d => d.count), 1);
                          const heightPct = Math.round((item.count / maxCount) * 100);
                          return (
                             <div key={idx} className="flex flex-col items-center flex-1 group">
                                <div className="text-xs font-bold text-secondary mb-2 opacity-0 group-hover:opacity-100 transition-opacity">{item.count}</div>
                                <div className="w-full bg-secondary/20 rounded-t-lg relative overflow-hidden group-hover:bg-secondary/30 transition-colors" style={{ height: `${heightPct}%`, minHeight: '4px' }}>
                                   <div className="absolute bottom-0 w-full bg-secondary rounded-t-lg transition-all duration-500" style={{ height: '100%' }}></div>
                                </div>
                                <div className="text-[10px] font-bold text-on-surface-variant mt-2 uppercase">{item.month}</div>
                             </div>
                          );
                       })}
                    </div>
                    
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-surface-container">
                       <button onClick={() => setProcessingHistoryOffset(prev => prev + 1)} className="px-4 py-2 bg-surface border border-outline-variant/30 text-on-surface rounded-xl text-xs font-bold hover:bg-surface-container flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">arrow_back</span> Previous 6 Months
                       </button>
                       <span className="text-xs font-bold text-slate-400">Offset: {processingHistoryOffset * 6} months</span>
                       <button disabled={processingHistoryOffset === 0} onClick={() => setProcessingHistoryOffset(prev => Math.max(0, prev - 1))} className={`px-4 py-2 bg-surface border border-outline-variant/30 text-on-surface rounded-xl text-xs font-bold flex items-center gap-1 ${processingHistoryOffset === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-container'}`}>
                          Next 6 Months <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                       </button>
                    </div>
                 </div>
               </div>
             );
          })()}

        </div>
      )}

      {/* CREATE ORDER TAB */}
      {activeTab === 'create' && (
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
          <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-center gap-4">
               <div className="flex mr-2">
                  <button type="button" onClick={() => handleTabChange('dashboard')} className="w-9 h-9 flex items-center justify-center bg-surface hover:bg-surface-container-low rounded-lg border border-outline-variant/30 text-slate-500 hover:text-primary transition-all shadow-sm cursor-pointer" title="Back to Dashboard"><span className="material-symbols-outlined text-[18px]">arrow_back</span></button>
               </div>
               <div className="space-y-1">
                 <h1 className="text-3xl font-extrabold tracking-tight text-on-surface font-headline">New Sale Order</h1>
                 <p className="text-on-surface-variant font-body text-sm">Create and dispatch synthetic logistics requests.</p>
               </div>
            </div>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-surface-container-low p-8 rounded-xl border border-outline-variant/10 shadow-sm">
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Sale Order #</label>
              <input readOnly type="text" className="w-full bg-surface-container-highest/50 border-none rounded-lg text-on-surface font-extrabold focus:ring-0 cursor-not-allowed" value={orderMeta.id} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Order Date</label>
              <input type="date" value={orderMeta.date} onChange={(e) => handleMetaChange('date', e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:ring-2 ring-primary/20 font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</label>
              <select disabled className="w-full bg-surface-container-highest/50 border-none rounded-lg font-bold text-slate-500 cursor-not-allowed text-sm">
                <option>Pending</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Order Type</label>
              <select value={orderMeta.type} onChange={(e) => handleMetaChange('type', e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:ring-2 ring-primary/20 font-bold text-sm">
                <option>Standard</option>
                <option className="text-tertiary font-bold">Urgent</option>
              </select>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <section className="lg:col-span-8 space-y-6 bg-surface-container-low p-8 rounded-xl border border-outline-variant/10 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-on-surface-variant">person_search</span>
                <h2 className="text-lg font-bold text-on-surface font-headline">Customer Information</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 col-span-full relative" ref={custSearchRef}>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Select Customer</label>
                  <input 
                    type="text"
                    value={showCustSearch ? customerSearchQuery : (state.customers.find(c => c.id === orderMeta.customerId)?.name || '')} 
                    onFocus={() => {
                       setShowCustSearch(true);
                       setCustomerSearchQuery('');
                    }}
                    onChange={(e) => {
                       setCustomerSearchQuery(e.target.value);
                       handleMetaChange('customerId', '');
                    }}
                    placeholder="Search by customer name..."
                    className="w-full bg-white border border-outline-variant/30 rounded-lg px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 shadow-sm"
                  />
                  {showCustSearch && (
                      <ul className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] bg-white border border-outline-variant/20 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                          {state.customers.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())).map(c => (
                              <li 
                                key={c.id} 
                                onClick={() => {
                                    handleMetaChange('customerId', c.id);
                                    setShowCustSearch(false);
                                }}
                                className="px-5 py-3 hover:bg-primary/5 cursor-pointer border-b border-outline-variant/10 last:border-0 transition-colors"
                              >
                                  <div className="font-extrabold text-sm text-slate-800">{c.name}</div>
                              </li>
                          ))}
                          {state.customers.filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())).length === 0 && (
                             <li className="p-4 text-sm font-bold text-slate-400 text-center italic">No customers found.</li>
                          )}
                      </ul>
                  )}
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Contact Person</label>
                   <input type="text" readOnly value={state.customers.find(c => c.id === orderMeta.customerId)?.contactPerson || ''} placeholder="Full Name" className="w-full bg-surface-container-highest/50 border-none rounded-lg focus:ring-0 text-sm font-medium cursor-not-allowed text-slate-500"/>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Contact Phone</label>
                   <input type="tel" readOnly value={state.customers.find(c => c.id === orderMeta.customerId)?.phone || ''} placeholder="+1 (555) 000-0000" className="w-full bg-surface-container-highest/50 border-none rounded-lg focus:ring-0 text-sm font-medium cursor-not-allowed text-slate-500"/>
                </div>
                <div className="space-y-2 col-span-full">
                   <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Shipping Address</label>
                   <textarea rows="3" value={orderMeta.shippingAddress} onChange={(e) => handleMetaChange('shippingAddress', e.target.value)} placeholder="Full geographical address..." className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:ring-2 ring-primary/20 text-sm font-medium resize-y"></textarea>
                </div>
              </div>
            </section>

            <section className="lg:col-span-4 space-y-6 bg-surface-container-low p-8 rounded-xl border border-outline-variant/10 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-on-surface-variant">assignment_turned_in</span>
                <h2 className="text-lg font-bold text-on-surface font-headline">Sales & Terms</h2>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Salesperson *</label>
                  <select value={orderMeta.salesperson} onChange={(e) => handleMetaChange('salesperson', e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:ring-2 ring-primary/20 font-bold text-sm">
                    <option value="">Select Salesperson</option>
                    <option value="Alexander Pierce">Alexander Pierce</option>
                    <option value="Elena Rodriguez">Elena Rodriguez</option>
                    {(state.users || []).map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Payment Terms</label>
                  <select value={orderMeta.paymentTerms} onChange={(e) => handleMetaChange('paymentTerms', e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:ring-2 ring-primary/20 font-bold text-sm">
                    <option>Net 30</option>
                    <option>Net 60</option>
                    <option>COD</option>
                    <option>Prepaid</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Expected Delivery</label>
                  <input type="date" value={orderMeta.expectedDelivery} onChange={(e) => handleMetaChange('expectedDelivery', e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg focus:ring-2 ring-primary/20 font-bold text-sm" />
                </div>
              </div>
            </section>
          </div>

          {/* Line Items Table with Dropdown Search */}
          <section className="bg-surface-container-lowest shadow-[0_20px_40px_rgba(0,28,56,0.06)] rounded-xl overflow-visible border border-outline-variant/10">
            <div className="px-8 py-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
              <h2 className="text-lg font-bold text-on-surface font-headline">Order Line Items</h2>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => navigate('/settings?tab=finish-good')} className="flex items-center gap-2 text-on-surface text-sm font-bold hover:bg-surface-container-high transition-colors px-4 py-2.5 rounded-lg border border-outline-variant/50 shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">category</span> Add Finish Good
                </button>
                <button type="button" onClick={addNewItem} className="flex items-center gap-2 text-white text-sm font-bold hover:opacity-90 transition-opacity bg-primary px-5 py-2.5 rounded-lg shadow-md">
                  <span className="material-symbols-outlined text-[18px]">add_circle</span> Add Line
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left border-collapse table-auto whitespace-nowrap">
                <thead>
                  <tr className="bg-surface border-b border-outline-variant/10">
                    <ResizableHeader className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant w-1">Sr.</ResizableHeader>
                    <ResizableHeader className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant min-w-[460px]">Item Code / Selective Search</ResizableHeader>
                    <ResizableHeader className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right w-28">Order Qty</ResizableHeader>
                    <ResizableHeader className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right w-24">Rolls</ResizableHeader>
                    <ResizableHeader className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right w-24">Rate ({currencyCode})</ResizableHeader>
                    <ResizableHeader className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right w-24">Disc. ({currencyCode})</ResizableHeader>
                    <ResizableHeader className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right w-32">Subtotal</ResizableHeader>
                    <ResizableHeader className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant min-w-[200px]">Line Remarks</ResizableHeader>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest w-1"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {items.map((item, idx) => {
                     const itemSubtotal = (item.qty * item.price) - (item.discount || 0);
                     const prodObj = state.items.find(i => i.id === item.itemId);
                     const actRollSz = item.rollSize || prodObj?.rollSize || prodObj?.packingSize || parseRollSizeFromPacking(prodObj?.combinationDetails?.packing) || 50;
                     const filteredItemsList = state.items.filter(i => 
                        (i.type === 'Finish Good' || i.category === 'Finished Goods') && 
                        (i.name.toLowerCase().includes((searchQueries[item.id] || '').toLowerCase()) || i.sku.toLowerCase().includes((searchQueries[item.id] || '').toLowerCase())) &&
                        !items.some(existingItem => existingItem.itemId === i.id && existingItem.id !== item.id)
                     );
                     
                     return (
                      <tr key={item.id} className="group hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-outline text-center align-top pt-6">{String(idx + 1).padStart(2, '0')}</td>
                        <td className="px-4 py-4 align-top pt-5">
                          <div className="flex items-start gap-4 relative">
                            <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 mt-0.5">
                              <span className="material-symbols-outlined text-primary-container text-[20px]">science</span>
                            </div>
                            <div className="w-full flex flex-col pt-0.5">
                               <div className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded tracking-wide w-fit mb-2 border border-slate-200">
                                  {item.itemCode}
                               </div>
                               <div className="flex items-center gap-2 flex-1">
                               <div className="relative flex-1 min-w-[340px] max-w-[580px]">
                                   <div className="relative flex items-center">
                                     <input 
                                       ref={(el) => {
                                         if (activeSearchId === item.id) activeInputRef.current = el;
                                       }}
                                       type="text" 
                                       placeholder="Search FG Name or SKU..."
                                       onFocus={(e) => {
                                          activeInputRef.current = e.target;
                                          setActiveSearchId(item.id);
                                       }}
                                       onClick={(e) => {
                                          activeInputRef.current = e.target;
                                          setActiveSearchId(item.id);
                                       }}
                                       onChange={(e) => {
                                          setSearchQueries({...searchQueries, [item.id]: e.target.value});
                                          if (item.itemId) handleItemChange(item.id, 'itemId', '');
                                       }}
                                       value={item.itemId && activeSearchId !== item.id ? (prodObj?.name || '') : (searchQueries[item.id] || '')}
                                       title={item.itemId ? (prodObj?.name || '') : ''}
                                       className={`w-full bg-white dark:bg-[#14171f] border rounded-xl pl-3.5 pr-8 py-2 text-xs font-bold transition-all outline-none focus:ring-2 focus:ring-primary/20 shadow-xs ${
                                          item.itemId ? 'border-primary/60 text-primary bg-primary/[0.03]' : 'border-outline-variant/30 text-on-surface'
                                       }`}
                                     />
                                     {item.itemId && (
                                       <button
                                         type="button"
                                         onClick={() => {
                                           handleItemChange(item.id, 'itemId', '');
                                           setSearchQueries({ ...searchQueries, [item.id]: '' });
                                           setActiveSearchId(item.id);
                                         }}
                                         className="absolute right-2 text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                         title="Clear and search another item"
                                       >
                                         <span className="material-symbols-outlined text-[15px]">close</span>
                                       </button>
                                     )}
                                   </div>

                                   {/* Portal-based Floating Dropdown: Renders directly in document.body - NEVER CLIPPED BY TABLE */}
                                   {activeSearchId === item.id && typeof document !== 'undefined' && createPortal(
                                       <div 
                                         ref={searchDropdownRef}
                                         style={{
                                           position: 'fixed',
                                           top: `${searchDropdownCoords.top}px`,
                                           left: `${searchDropdownCoords.left}px`,
                                           width: `${searchDropdownCoords.width}px`,
                                           zIndex: 99999
                                         }}
                                         className="bg-white/98 dark:bg-[#14171f]/98 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,28,56,0.18)] max-h-80 overflow-y-auto print:hidden animate-in fade-in zoom-in-95 duration-150 p-1.5 space-y-1"
                                       >
                                           <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                                             <span>Finished Goods ({filteredItemsList.length})</span>
                                             <span className="text-primary font-bold">Press ESC or click outside to close</span>
                                           </div>
                                           {filteredItemsList.map(p => (
                                               <button 
                                                 key={p.id} 
                                                 type="button"
                                                 onClick={() => {
                                                     handleItemChange(item.id, 'itemId', p.id);
                                                     setSearchQueries({...searchQueries, [item.id]: ''});
                                                     setActiveSearchId(null);
                                                 }}
                                                 className="w-full text-left p-2.5 hover:bg-primary/5 dark:hover:bg-primary/15 rounded-xl cursor-pointer border border-transparent hover:border-primary/20 transition-all flex flex-col gap-1 group"
                                               >
                                                   <div className="font-extrabold text-xs text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors flex items-center gap-1.5">
                                                       <span className="material-symbols-outlined text-[15px] text-primary shrink-0">category</span>
                                                       <span>{p.name}</span>
                                                   </div>
                                                   <div className="flex items-center gap-x-3 mt-0.5 flex-wrap text-[10px]">
                                                       <span className="font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">{p.sku}</span>
                                                       <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                         <span className="material-symbols-outlined text-[13px]">inventory_2</span> 
                                                         {p.stock ?? 0} {p.unit || 'm'}
                                                       </span>
                                                       <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                         <span className="material-symbols-outlined text-[13px]">straighten</span> 
                                                         Roll: {p.rollSize || 50}m
                                                       </span>
                                                       {p.department && (
                                                         <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                           <span className="material-symbols-outlined text-[13px]">business</span> 
                                                           {p.department}
                                                         </span>
                                                       )}
                                                   </div>
                                               </button>
                                           ))}
                                           {filteredItemsList.length === 0 && (
                                             <div className="p-4 text-xs font-bold text-slate-400 text-center italic">
                                               No matching finished goods found.
                                             </div>
                                           )}
                                       </div>,
                                       document.body
                                   )}
                               </div>
                               <FGCombinationBuilder
                                 compact={true}
                                 allowCreation={true}
                                 allowQuickConfig={true}
                                 placeholder="Builder"
                                 onSelectItem={(chosen) => {
                                   if (chosen.isNewFromOrder) {
                                     setCollection('items', prevItems => {
                                       const existing = (prevItems || []).find(x => x.id === chosen.id);
                                       if (existing) return prevItems;
                                       return [...(prevItems || []), chosen];
                                     });
                                   }
                                   handleItemChosen(item.id, chosen);
                                   setSearchQueries({ ...searchQueries, [item.id]: chosen.name });
                                   setActiveSearchId(null);
                                 }}
                               />
                             </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right align-top pt-11">
                          <div className="flex items-center justify-end gap-1.5">
                            <input type="number" min="1" value={item.qty} onChange={(e) => handleItemChange(item.id, 'qty', parseInt(e.target.value.replace(/\D/g, '') || 0))} className="w-24 text-right bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-2.5 text-sm font-extrabold focus:ring-2 focus:ring-primary/20 shadow-sm" />
                            <span className="text-xs text-slate-400 font-bold w-6 text-left">{prodObj?.unit === 'Meters' ? 'm' : (prodObj?.unit || 'm') }</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right align-top pt-11">
                          <div className="flex items-center justify-center gap-1.5">
                            <input type="number" min="1" value={item.rolls} onChange={(e) => handleItemChange(item.id, 'rolls', parseInt(e.target.value.replace(/\D/g, '') || 0))} className="w-16 text-right bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-2.5 text-sm font-extrabold focus:ring-2 focus:ring-primary/20 shadow-sm" />
                            <span className="text-xs text-slate-400 font-bold">rolls</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right align-top pt-11">
                          <input type="number" value={item.price} onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)} className="w-24 text-right bg-white border border-outline-variant/30 rounded-lg p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </td>
                        <td className="px-4 py-4 text-right align-top pt-11">
                          <input type="number" value={item.discount} onChange={(e) => handleItemChange(item.id, 'discount', parseFloat(e.target.value) || 0)} className="w-20 text-right bg-white border border-outline-variant/30 rounded-lg p-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/20 shadow-sm" />
                        </td>
                        <td className="px-4 py-4 text-right align-top pt-[54px] text-sm font-extrabold text-on-surface">{itemSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td className="px-4 py-4 align-top pt-12">
                          <input type="text" value={item.remarks} onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)} className="w-full bg-transparent border-b border-dashed border-outline-variant/50 pb-1 text-xs focus:outline-none focus:border-primary italic text-slate-600 font-medium" placeholder="Add specific requirements..." />
                        </td>
                        <td className="px-6 py-4 text-right align-top pt-11">
                          <button type="button" onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors p-2.5 flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                        </td>
                      </tr>
                   );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <section className="md:col-span-7 bg-surface-container-low p-8 rounded-xl border border-outline-variant/10 space-y-4 shadow-sm">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">notes</span> Overall Order Notes</label>
              <textarea value={orderMeta.notes} onChange={(e) => handleMetaChange('notes', e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl focus:ring-2 ring-primary/20 p-4 text-sm resize-y font-medium text-slate-700 shadow-inner" placeholder="Specify any logistical constraints, laboratory requirements, or compliance codes here..." rows="5"></textarea>
            </section>
            
            <section className="md:col-span-5 bg-surface-container-high border border-outline-variant/30 text-on-surface p-8 rounded-xl shadow-lg relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-8 -bottom-8 opacity-10">
                <span className="material-symbols-outlined text-[180px]" style={{ fontVariationSettings: "'FILL' 1" }}>request_quote</span>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-80 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">point_of_sale</span> Financial Summary</h3>
              <div className="space-y-4 relative z-10 w-full mb-4">
                <div className="flex justify-between items-center text-on-surface-variant">
                  <span className="text-sm font-semibold">Net Subtotal</span>
                  <span className="text-sm font-bold">{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between items-center text-on-surface-variant/80">
                  <span className="text-sm font-semibold">Estimated Freight (0%)</span>
                  <span className="text-sm font-bold">0.00</span>
                </div>
              </div>
              <div className="pt-6 border-t border-white/20 flex justify-between items-end relative z-10 w-full">
                 <span className="text-lg font-extrabold uppercase tracking-wide">Grand Total</span>
                 <span className="text-4xl font-black tracking-tight">{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-lg opacity-70 ml-1">{currencyCode}</span></span>
              </div>
            </section>
          </div>

          <footer className="flex flex-col md:flex-row justify-between items-center gap-4 pt-10 pb-6">
            <button type="button" onClick={() => handleTabChange('dashboard')} className="px-8 py-3.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors w-full md:w-auto cursor-pointer">Cancel Workflow</button>
            <button type="submit" className="px-10 py-3.5 bg-primary text-white font-extrabold rounded-xl shadow-[0_10px_20px_rgba(0,113,227,0.2)] hover:shadow-[0_15px_30px_rgba(0,113,227,0.3)] transition-all w-full md:w-auto transform hover:-translate-y-0.5">Submit Sale Order</button>
          </footer>
        </form>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-8 animate-in mt-10 fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex flex-col md:flex-row items-start md:items-end gap-4 justify-between">
              <div className="flex items-center gap-4">
                <div className="flex mr-2">
                   <button onClick={() => setActiveTab('dashboard')} className="w-9 h-9 flex items-center justify-center bg-surface hover:bg-surface-container-low rounded-lg border border-outline-variant/30 text-slate-500 hover:text-primary transition-all shadow-sm" title="Back to Dashboard"><span className="material-symbols-outlined text-[18px]">arrow_back</span></button>
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-on-surface font-headline">Sale Order History</h1>
                  <p className="text-on-surface-variant mt-2 max-w-lg font-body text-sm">Historical timeline and audit log for sale orders.</p>
                </div>
              </div>
              <div className="flex flex-wrap md:flex-nowrap gap-3 bg-surface-container-lowest p-2 rounded-xl shadow-sm border border-outline-variant/10 w-full md:w-auto">
                 <input type="text" placeholder="Customer Name..." value={histCust} onChange={e => setHistCust(e.target.value)} className="w-full md:w-auto flex-1 bg-surface-container-low border-none rounded-lg text-xs font-bold px-4 py-2.5 focus:ring-2 focus:ring-primary/20" />
                 <input type="date" value={histDate} onChange={e => setHistDate(e.target.value)} className="bg-surface-container-low border-none rounded-lg text-xs font-bold px-4 py-2.5 focus:ring-2 focus:ring-primary/20" />
                 <input type="text" placeholder="Order ID..." value={histSO} onChange={e => setHistSO(e.target.value)} className="w-full md:w-32 bg-surface-container-low border-none rounded-lg text-xs font-bold px-4 py-2.5 focus:ring-2 focus:ring-primary/20" />
              </div>
           </div>

           <div className="bg-surface-container-lowest rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-outline-variant/10 overflow-hidden">
              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left border-collapse table-auto whitespace-nowrap">
                    <thead>
                      <tr className="bg-surface-container-low dark:bg-[#121620] border-y border-outline-variant/10">
                        <ResizableHeader className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant w-1">Order ID & Date</ResizableHeader>
                        <ResizableHeader className="px-6 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Customer</ResizableHeader>
                        <ResizableHeader className="px-6 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Order Items Overview</ResizableHeader>
                        <ResizableHeader className="px-6 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Created By</ResizableHeader>
                        <ResizableHeader className="px-6 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Modified By</ResizableHeader>
                        <ResizableHeader className="px-6 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Modified Date</ResizableHeader>
                        <ResizableHeader className="px-6 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right">Value ({currencyCode})</ResizableHeader>
                        <ResizableHeader className="px-6 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant w-1">Status</ResizableHeader>
                        <ResizableHeader className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right w-1">Audit Details</ResizableHeader>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-low font-body text-sm">
                      {displayedHistory.map(order => {
                         const customer = state.customers.find(c => c.id === order.customerId);
                         const orderValue = order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                         
                         return (
                            <tr key={order.id} className="hover:bg-surface-container-low/40 transition-colors">
                                <td className="px-8 py-6">
                                   <div className="font-extrabold text-on-surface text-base">{order.id}</div>
                                   <div className="text-[11px] text-slate-500 font-bold mt-1.5">{new Date(order.date).toLocaleDateString()}</div>
                                </td>
                                <td className="px-6 py-6 font-extrabold text-slate-700">{customer?.name || 'Unknown'}</td>
                                <td className="px-6 py-6">
                                   <div className="flex flex-wrap gap-2 max-w-[350px]">
                                      <span className="text-sm font-bold text-slate-700">{order.items.length} {order.items.length === 1 ? 'Item' : 'Items'}</span>
                                   </div>
                                </td>
                                <td className="px-6 py-6 text-sm font-medium text-slate-700">{order.createdBy || 'Unknown'}</td>
                                <td className="px-6 py-6 text-sm font-medium text-slate-700">{order.modifiedBy || '-'}</td>
                                <td className="px-6 py-6 text-sm font-medium text-slate-700">{order.modifiedDate ? new Date(order.modifiedDate).toLocaleDateString() : '-'}</td>
                                <td className="px-6 py-6 text-right font-black text-slate-800 text-base">{orderValue.toLocaleString()}</td>
                                <td className="px-6 py-6 overflow-visible"><StatusBadgeWithAction orderId={order.id} itemCode={null} status={order.status} updateStatus={updateSaleOrderItemStatus} /></td>
                                <td className="px-8 py-6 text-right">
                                   <div className="flex items-center justify-end gap-2">
                                     <button onClick={() => setPrintOrder(order)} className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors flex items-center justify-center" title="Print Record">
                                        <span className="material-symbols-outlined text-[20px]">print</span>
                                     </button>
                                     <button onClick={() => handleEditOrder(order)} title="Edit Order" className="text-on-surface-variant hover:text-primary hover:bg-surface-container-high p-2 rounded-lg transition-colors flex items-center justify-center">
                                       <span className="material-symbols-outlined text-[20px]">edit</span>
                                     </button>
                                     <button onClick={() => updateSaleOrderItemStatus(order.id, null, 'Deleted')} title="Delete Order" className="text-red-400 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center justify-center">
                                       <span className="material-symbols-outlined text-[20px]">delete</span>
                                     </button>
                                   </div>
                                </td>
                            </tr>
                         )
                      })}
                      {displayedHistory.length === 0 && (
                          <tr><td colSpan="6" className="py-16 text-center text-slate-400 font-bold italic">No history matches the current filters.</td></tr>
                      )}
                    </tbody>
                </table>
              </div>
              
              {/* Pagination & Toggle Area */}
              <div className="px-6 py-4 bg-surface-container-low flex flex-col md:flex-row justify-between items-center border-t border-outline-variant/10 gap-4 no-print">
                <div className="flex items-center gap-4">
                    <div className="text-xs font-medium text-on-surface-variant">
                        Showing {displayedHistory.length} of {filteredHistory.length} orders
                    </div>
                    
                    {/* Pagination Toggle Switch */}
                    <div className="flex items-center gap-2 border-l border-outline-variant/20 pl-4">
                        <span className={`text-xs font-bold ${!isPaginated ? 'text-primary' : 'text-on-surface-variant'}`}>List View</span>
                        <button 
                            onClick={toggleGlobalPagination}
                            className={`w-10 h-5 rounded-full relative transition-colors ${isPaginated ? 'bg-primary' : 'bg-surface-container-highest'}`}
                        >
                            <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${isPaginated ? 'left-[22px]' : 'left-[3px]'}`}></div>
                        </button>
                        <span className={`text-xs font-bold ${isPaginated ? 'text-primary' : 'text-on-surface-variant'}`}>Pages</span>
                    </div>
                </div>
                
                {isPaginated && totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button 
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className="p-1 rounded hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      ><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>chevron_left</span></button>
                      
                      {/* Simple page numbers mapping */}
                      {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                          let pageNum = currentPage;
                          if (currentPage <= 3) pageNum = idx + 1;
                          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + idx;
                          else pageNum = currentPage - 2 + idx;
                          
                          if (pageNum > totalPages || pageNum < 1) return null;
                          
                          return (
                              <button 
                                  key={pageNum}
                                  onClick={() => setCurrentPage(pageNum)}
                                  className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${currentPage === pageNum ? 'bg-primary text-white shadow-md' : 'hover:bg-surface-container-high text-on-surface'}`}
                              >
                                  {pageNum}
                              </button>
                          );
                      })}
                      
                      <button 
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className="p-1 rounded hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      ><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>chevron_right</span></button>
                    </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="bg-surface-container-lowest/95 dark:bg-[#14171f]/95 border border-white/10 dark:border-white/[0.08] rounded-3xl p-7 max-w-md w-full shadow-[0_25px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl text-center space-y-5 animate-in zoom-in-95 duration-200 text-on-surface">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>
            <div>
              <h3 className="text-xl font-black text-on-surface tracking-tight font-headline">
                Unsaved Changes Warning
              </h3>
              <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                You have unsaved changes in this Sale Order. If you leave this page without saving, all entered items, customer selections, and order specifications will be permanently lost.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  if (pendingNavigationAction) {
                    pendingNavigationAction();
                    setPendingNavigationAction(null);
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold text-xs transition-colors cursor-pointer"
              >
                Discard & Leave
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  setPendingNavigationAction(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
      {showPrintStudio && (
        <UniversalPrintStudioModal
          isOpen={showPrintStudio}
          onClose={() => setShowPrintStudio(false)}
          documentType="sale_order"
          documentData={studioDocData || printOrder}
          documentTitle="Sale Order Print Designer"
        />
      )}
    </Layout>
    </div>
    </div>
  );
}
