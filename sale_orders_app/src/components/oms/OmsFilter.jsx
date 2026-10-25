import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import ResizableHeader from '../ui/ResizableHeader';
import GlobalPagination from '../ui/GlobalPagination';
import UniversalPrintStudioModal from '../ui/UniversalPrintStudioModal';

export default function OmsFilter({ pendingItems = [], customers = [] }) {
    const { state, toggleGlobalPagination, updateSaleOrderItemStatus, setCollection } = useApp();
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('omsViewMode') || 'item');
    const [editingStatusItem, setEditingStatusItem] = useState(null);

    const defaultStatusColors = {
      'Pending': '#fcd34d',
      'In Process': '#60a5fa',
      'Completed': '#34d399',
      'Cancelled': '#f87171',
      'Pending due to shortage': '#fb923c'
    };

    const getTextColorForBg = (hexColor) => {
        if (!hexColor) return 'inherit';
        const cleanHex = hexColor.replace('#', '');
        if (cleanHex.length !== 6) return 'inherit';
        const r = parseInt(cleanHex.substring(0, 2), 16);
        const g = parseInt(cleanHex.substring(2, 4), 16);
        const b = parseInt(cleanHex.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 128 ? '#1e293b' : '#ffffff';
    };

    const [showStatusModal, setShowStatusModal] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);
    const [newStatusName, setNewStatusName] = useState('');
    const [newStatusColor, setNewStatusColor] = useState('#3b82f6');
    const [isAddingStockItem, setIsAddingStockItem] = useState(false);
    const [newStockItem, setNewStockItem] = useState({
        itemCode: '',
        itemId: '',
        productName: '',
        quantity: '',
        date: new Date().toISOString().split('T')[0],
        status: 'Pending'
    });

    const [itemSearchVal, setItemSearchVal] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const [isFiltersHidden, setIsFiltersHidden] = useState(() => {
        return localStorage.getItem('omsFiltersHidden') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('omsFiltersHidden', isFiltersHidden ? 'true' : 'false');
    }, [isFiltersHidden]);

    const [rowHeight, setRowHeight] = useState(() => {
        return localStorage.getItem('omsRowHeight') || 'normal';
    });

    useEffect(() => {
        localStorage.setItem('omsRowHeight', rowHeight);
    }, [rowHeight]);

    const paddingClass = rowHeight === 'compact' ? 'py-2 px-4' : rowHeight === 'tall' ? 'py-8 px-8' : 'py-5 px-6';

    const getNextItemCode = () => {
        let maxIdx = 0;
        // scan sale orders
        (state.saleOrders || []).forEach(order => {
            (order.items || []).forEach(item => {
                const code = item.itemCode || '';
                const match = code.match(/ITM-(\d+)$/);
                if (match) {
                    const idx = parseInt(match[1]);
                    if (idx > maxIdx) maxIdx = idx;
                }
            });
        });
        // scan custom OMS items
        (state.customOmsItems || []).forEach(item => {
            const code = item.itemCode || '';
            const match = code.match(/ITM-(\d+)$/);
            if (match) {
                const idx = parseInt(match[1]);
                if (idx > maxIdx) maxIdx = idx;
            }
        });
        // scan production plans
        (state.productionPlans || []).forEach(plan => {
            (plan.items || []).forEach(item => {
                const code = item.itemCode || '';
                const match = code.match(/ITM-(\d+)$/);
                if (match) {
                    const idx = parseInt(match[1]);
                    if (idx > maxIdx) maxIdx = idx;
                }
            });
        });
        return `ITM-${String(maxIdx + 1).padStart(3, '0')}`;
    };

    const filteredSearchItems = useMemo(() => {
        const query = itemSearchVal.toLowerCase();
        const finishGoodsList = (state.items || []).filter(i => i.type === 'Finish Good' || i.category === 'Finished Goods' || i.type === 'Finished Goods');
        if (!query) return finishGoodsList;
        return finishGoodsList.filter(item => item.name.toLowerCase().includes(query));
    }, [itemSearchVal, state.items]);
    const [acknowledgedCautionItems, setAcknowledgedCautionItems] = useState(() => {
        try {
            const saved = localStorage.getItem('omsAcknowledgedCautions');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch (e) {
            return new Set();
        }
    });

    useEffect(() => {
        localStorage.setItem('omsAcknowledgedCautions', JSON.stringify(Array.from(acknowledgedCautionItems)));
    }, [acknowledgedCautionItems]);

    const [activeFilter, setActiveFilter] = useState(() => localStorage.getItem('omsActiveFilter') || 'All Orders'); 
    const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('omsSearchTerm') || '');
    const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem('omsStatusFilter') || 'All Statuses');
    const [customerFilter, setCustomerFilter] = useState(() => localStorage.getItem('omsCustomerFilter') || 'All Customers');
    const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('omsSortOrder') || 'desc');

    useEffect(() => { localStorage.setItem('omsViewMode', viewMode); }, [viewMode]);
    useEffect(() => { localStorage.setItem('omsActiveFilter', activeFilter); }, [activeFilter]);
    useEffect(() => { localStorage.setItem('omsSearchTerm', searchTerm); }, [searchTerm]);
    useEffect(() => { localStorage.setItem('omsStatusFilter', statusFilter); }, [statusFilter]);
    useEffect(() => { localStorage.setItem('omsCustomerFilter', customerFilter); }, [customerFilter]);
    useEffect(() => { localStorage.setItem('omsSortOrder', sortOrder); }, [sortOrder]);


    // Dynamic Columns State
    const defaultColumns = [
        { id: 'orderId', label: 'Sale Order No', visible: true, width: 'auto' },
        { id: 'date', label: 'Order Date', visible: true, width: 'auto' },
        { id: 'itemCode', label: 'Item Code', visible: true, width: 'auto' },
        { id: 'productName', label: 'Item Name', visible: true, width: 'auto' },
        { id: 'customerName', label: 'Customer Name', visible: true, width: 'auto' },
        { id: 'quantity', label: 'Order Metre', visible: true, width: 'auto' },
        { id: 'producedQty', label: 'Output Metres', visible: true, width: 'auto' },
        { id: 'remaining', label: 'Remaining Qty', visible: true, width: 'auto' },
        { id: 'status', label: 'Status', visible: true, width: 'auto' },
        { id: 'completedDate', label: 'Completed Date', visible: true, width: 'auto' },
        { id: 'actions', label: 'Actions', visible: true, width: 'auto' }
    ];

    const [columns, setColumns] = useState(() => {
        const saved = localStorage.getItem('omsFilterColumns');
        return saved ? JSON.parse(saved) : defaultColumns;
    });

    useEffect(() => {
        localStorage.setItem('omsFilterColumns', JSON.stringify(columns));
    }, [columns]);

    const [isHeaderPinned, setIsHeaderPinned] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Column Filters (Excel-like) state
    const [colFilters, setColFilters] = useState(() => {
        try {
            const saved = localStorage.getItem('omsColFilters');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    useEffect(() => {
        localStorage.setItem('omsColFilters', JSON.stringify(colFilters));
    }, [colFilters]);

    // reset current page on filter change
    useEffect(() => { setCurrentPage(1); }, [activeFilter, searchTerm, statusFilter, customerFilter, colFilters, viewMode]);


    // Drag and drop state for columns
    const [draggedCol, setDraggedCol] = useState(null);

    const [openFilterPopup, setOpenFilterPopup] = useState(null); 

    // Modals
    const [viewOrderPopup, setViewOrderPopup] = useState(null); 
    const [viewTimelinePopup, setViewTimelinePopup] = useState(null); 

    const handleFilterButtonClick = (filterName) => {
        setActiveFilter(filterName);
    };

    const handleColDragStart = (e, index) => {
        setDraggedCol(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleColDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedCol === null || draggedCol === index) return;
        
        const newCols = [...columns];
        const draggedItem = newCols[draggedCol];
        newCols.splice(draggedCol, 1);
        newCols.splice(index, 0, draggedItem);
        setColumns(newCols);
        setDraggedCol(index);
    };

    const handleColDrop = (e) => {
        setDraggedCol(null);
    };

    const handleColResize = (colId, newWidth) => {
        setColumns(prev => prev.map(c => c.id === colId ? { ...c, width: newWidth } : c));
    };

    const handleColFilterChange = (colId, value) => {
        setColFilters(prev => {
            const current = prev[colId] || [];
            if (current.includes(value)) {
                return { ...prev, [colId]: current.filter(v => v !== value) };
            } else {
                return { ...prev, [colId]: [...current, value] };
            }
        });
    };

    const getCompletedDate = (item) => {
        if (item.status === 'Completed') {
            const outputs = state.productionOutputs?.filter(o => o.orderId === item.orderId && o.itemCode === item.itemCode);
            if (outputs && outputs.length > 0) {
                const sorted = [...outputs].sort((a,b) => new Date(b.date) - new Date(a.date));
                return new Date(sorted[0].date).toLocaleDateString();
            }
            const so = state.saleOrders.find(o => o.id === item.orderId);
            return so?.modifiedDate ? new Date(so.modifiedDate).toLocaleDateString() : new Date().toLocaleDateString();
        }
        return '-';
    };

    const processedData = useMemo(() => {
        let itemsToProcess = [...pendingItems];

        itemsToProcess = itemsToProcess.map(item => ({
            ...item,
            customerName: customers.find(c => c.id === item.customerId)?.name || item.customer || 'Unknown',
            completedDate: getCompletedDate(item),
            remaining: parseInt(item.quantity) - parseInt(item.producedQty || 0),
            dateFormatted: new Date(item.date).toLocaleDateString()
        }));

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            itemsToProcess = itemsToProcess.filter(item => 
                (item.orderId && item.orderId.toLowerCase().includes(lowerSearch)) ||
                (item.itemCode && item.itemCode.toLowerCase().includes(lowerSearch)) ||
                (item.productName && item.productName.toLowerCase().includes(lowerSearch))
            );
        }

        if (statusFilter !== 'All Statuses') {
            itemsToProcess = itemsToProcess.filter(item => item.status === statusFilter);
        }

        if (customerFilter !== 'All Customers') {
            itemsToProcess = itemsToProcess.filter(item => item.customerName === customerFilter);
        }

        Object.keys(colFilters).forEach(colId => {
            const selectedVals = colFilters[colId];
            if (selectedVals.length > 0) {
                itemsToProcess = itemsToProcess.filter(item => {
                    let val = item[colId];
                    if (colId === 'remaining') val = item.remaining;
                    if (colId === 'date') val = item.dateFormatted;
                    return selectedVals.includes(String(val));
                });
            }
        });

        if (activeFilter === 'By Customer') {
            itemsToProcess.sort((a, b) => sortOrder === 'asc' ? a.customerName.localeCompare(b.customerName) : b.customerName.localeCompare(a.customerName));
        } else {
            // Default to By Date or All Orders
            itemsToProcess.sort((a, b) => sortOrder === 'asc' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date));
        }

        if (viewMode === 'item') {
            itemsToProcess.sort((a, b) => {
                const aCaution = (parseInt(a.producedQty || 0) > 0 && a.status !== 'Completed' && !acknowledgedCautionItems.has(a.orderId + a.itemCode)) ? 1 : 0;
                const bCaution = (parseInt(b.producedQty || 0) > 0 && b.status !== 'Completed' && !acknowledgedCautionItems.has(b.orderId + b.itemCode)) ? 1 : 0;
                // Caution items bubble to top regardless of sort direction
                return bCaution - aCaution;
            });
            return itemsToProcess;
        }

        if (viewMode === 'order') {
            const orderGroups = itemsToProcess.reduce((acc, item) => {
                if (!acc[item.orderId]) {
                    acc[item.orderId] = {
                        orderId: item.orderId,
                        date: item.date,
                        customerName: item.customerName,
                        totalItems: 0,
                        totalQuantity: 0,
                        totalProduced: 0,
                        status: 'Multiple'
                    };
                }
                const group = acc[item.orderId];
                group.totalItems += 1;
                group.totalQuantity += parseInt(item.quantity) || 0;
                group.totalProduced += parseInt(item.producedQty) || 0;
                if (group.totalItems === 1) {
                    group.status = item.status;
                } else if (group.status !== item.status) {
                    group.status = 'Mixed';
                }
                return acc;
            }, {});
            
            let arr = Object.values(orderGroups);
            if (activeFilter === 'By Customer') {
                arr.sort((a, b) => sortOrder === 'asc' ? a.customerName.localeCompare(b.customerName) : b.customerName.localeCompare(a.customerName));
            } else {
                arr.sort((a, b) => sortOrder === 'asc' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date));
            }
            return arr;
        }

        return itemsToProcess;
    }, [pendingItems, customers, searchTerm, statusFilter, customerFilter, activeFilter, viewMode, colFilters, state.productionOutputs, state.saleOrders, sortOrder, acknowledgedCautionItems]);

    // Orders Report print rows: the same search / status / customer /
    // column-filter pipeline as the on-screen list, but always item rows
    // (never the order-grouped view) so the print mirrors the item list.
    const printItems = useMemo(() => {
        let itemsToProcess = [...pendingItems];
        itemsToProcess = itemsToProcess.map(item => ({
            ...item,
            customerName: customers.find(c => c.id === item.customerId)?.name || item.customer || 'Unknown',
            completedDate: getCompletedDate(item),
            remaining: parseInt(item.quantity) - parseInt(item.producedQty || 0),
            dateFormatted: new Date(item.date).toLocaleDateString()
        }));
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            itemsToProcess = itemsToProcess.filter(item =>
                (item.orderId && item.orderId.toLowerCase().includes(lowerSearch)) ||
                (item.itemCode && item.itemCode.toLowerCase().includes(lowerSearch)) ||
                (item.productName && item.productName.toLowerCase().includes(lowerSearch))
            );
        }
        if (statusFilter !== 'All Statuses') {
            itemsToProcess = itemsToProcess.filter(item => item.status === statusFilter);
        }
        if (customerFilter !== 'All Customers') {
            itemsToProcess = itemsToProcess.filter(item => item.customerName === customerFilter);
        }
        Object.keys(colFilters).forEach(colId => {
            const selectedVals = colFilters[colId];
            if (selectedVals.length > 0) {
                itemsToProcess = itemsToProcess.filter(item => {
                    let val = item[colId];
                    if (colId === 'remaining') val = item.remaining;
                    if (colId === 'date') val = item.dateFormatted;
                    return selectedVals.includes(String(val));
                });
            }
        });
        if (activeFilter === 'By Customer') {
            itemsToProcess.sort((a, b) => sortOrder === 'asc' ? a.customerName.localeCompare(b.customerName) : b.customerName.localeCompare(a.customerName));
        } else {
            itemsToProcess.sort((a, b) => sortOrder === 'asc' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date));
        }
        return itemsToProcess;
    }, [pendingItems, customers, searchTerm, statusFilter, customerFilter, activeFilter, colFilters, sortOrder]);

    const printRecord = useMemo(() => {
        const items = printItems.map((item, idx) => ({
            sr_no: idx + 1,
            order_date: item.date ? new Date(item.date).toLocaleDateString('en-GB') : '',
            order_id: item.orderId || item.itemCode || '',
            customer_name: item.customerName || 'Unknown',
            item_name: item.productName || item.itemCode || '',
            order_m: Number(item.quantity || 0),
            produced_m: Number(item.producedQty || 0),
            status: item.status || '',
            _group: item.customerName || 'Unknown'
        }));
        return {
            header: {
                report_date: new Date().toLocaleDateString('en-GB'),
                status_filter: statusFilter,
                total_orders: items.length,
                total_meters: items.reduce((s, it) => s + (it.order_m || 0), 0).toLocaleString()
            },
            items,
            totals: {
                order_m: items.reduce((s, it) => s + (it.order_m || 0), 0),
                produced_m: items.reduce((s, it) => s + (it.produced_m || 0), 0)
            }
        };
    }, [printItems, statusFilter]);

    const getUniqueValues = (colId) => {
        let itemsToProcess = [...pendingItems];

        itemsToProcess = itemsToProcess.map(item => ({
            ...item,
            customerName: customers.find(c => c.id === item.customerId)?.name || item.customer || 'Unknown',
            completedDate: getCompletedDate(item),
            remaining: parseInt(item.quantity) - parseInt(item.producedQty || 0),
            dateFormatted: new Date(item.date).toLocaleDateString()
        }));
        
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            itemsToProcess = itemsToProcess.filter(item => 
                (item.orderId && item.orderId.toLowerCase().includes(lowerSearch)) ||
                (item.itemCode && item.itemCode.toLowerCase().includes(lowerSearch)) ||
                (item.productName && item.productName.toLowerCase().includes(lowerSearch))
            );
        }

        if (statusFilter !== 'All Statuses') {
            itemsToProcess = itemsToProcess.filter(item => item.status === statusFilter);
        }

        if (customerFilter !== 'All Customers') {
            itemsToProcess = itemsToProcess.filter(item => item.customerName === customerFilter);
        }

        Object.keys(colFilters).forEach(key => {
            if (key !== colId) { // skip current col filter for its own dropdown
                const selectedVals = colFilters[key];
                if (selectedVals.length > 0) {
                    itemsToProcess = itemsToProcess.filter(item => {
                        let val = item[key];
                        if (key === 'remaining') val = item.remaining;
                        if (key === 'date') val = item.dateFormatted;
                        return selectedVals.includes(String(val));
                    });
                }
            }
        });

        const vals = itemsToProcess.map(item => {
            if (colId === 'remaining') return String(item.remaining);
            if (colId === 'date') return item.dateFormatted;
            return String(item[colId] || '-');
        });
        return [...new Set(vals)].filter(v => v !== 'undefined' && v !== 'null').sort();
    };

    const displayedData = state.isGlobalPaginated 
        ? processedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) 
        : processedData;


    const handleOrderClick = (orderId) => {
        const order = state.saleOrders.find(o => o.id === orderId);
        if(order) setViewOrderPopup(order);
    };

    const handleViewTimeline = (item) => {
        let outputs = [];
        (state.productionPlans || []).forEach(plan => {
            (plan.items || []).forEach(pItem => {
                if (pItem.orderId === item.orderId && ((item.lineCode && pItem.lineCode) ? pItem.lineCode === item.lineCode : (pItem.itemCode === item.itemCode || pItem.itemId === item.itemId))) {
                    if (pItem.outputs && pItem.outputs.length > 0) {
                        outputs = [...outputs, ...pItem.outputs.map(o => ({...o, planId: plan.id, planDate: plan.createdAt}))];
                    }
                }
            });
        });
        outputs.sort((a,b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date));
        setViewTimelinePopup({ ...item, outputs });
    };

    const renderCellContent = (item, colId, statusColor, textColor, idx, totalLength) => {
        const cellStyle = statusColor ? { color: textColor } : {};
        switch(colId) {
            case 'orderId':
                return <span onClick={() => handleOrderClick(item.orderId)} className={`font-manrope font-bold cursor-pointer hover:underline ${statusColor ? '' : 'text-primary'}`} style={cellStyle}>{item.orderId === '-' ? '-' : item.orderId}</span>;
            case 'date':
                return <span className="text-sm font-semibold" style={cellStyle}>{item.dateFormatted}</span>;
            case 'itemCode':
                return <span className={`font-mono text-xs font-semibold rounded px-2 py-0.5 w-fit ${statusColor ? 'bg-white/20' : 'bg-slate-100 text-slate-700'}`} style={cellStyle}>{item.itemCode}</span>;
            case 'productName':
                return <span className="text-sm font-semibold" style={cellStyle}>{item.productName}</span>;
            case 'customerName':
                return <span className="text-sm font-semibold" style={cellStyle}>{item.customerName}</span>;
            case 'quantity':
                return <span className="text-sm font-semibold" style={cellStyle}>{item.quantity}m</span>;
            case 'producedQty':
                return <span className="text-sm font-bold" style={cellStyle}>{item.producedQty || 0}m</span>;
            case 'remaining':
                return <span className={`text-sm font-bold ${statusColor ? '' : 'text-tertiary'}`} style={cellStyle}>{item.remaining}m</span>;
            case 'completedDate':
                return <span className="text-sm font-medium" style={cellStyle}>{item.completedDate}</span>;
            case 'status': {
                const s = item.status || 'Pending';
                const isCompleted = s === 'Completed';
                const isInProcess = s === 'In Process';
                const itemKey = item.orderId + item.itemCode;
                const hasOutputButNotCompleted = (parseInt(item.producedQty || 0) > 0 && !isCompleted && !acknowledgedCautionItems.has(itemKey));
                
                const isNearBottom = idx !== undefined && totalLength !== undefined && idx >= totalLength - 3 && totalLength > 3;
                const popupPositionClass = isNearBottom ? "bottom-full mb-1" : "top-full mt-1";

                if (statusColor) {
                    return (
                        <div className="flex items-center gap-2 relative">
                            {hasOutputButNotCompleted && (
                                <span className="material-symbols-outlined text-warning text-lg" title="Action Required: Finalize Status">warning</span>
                            )}
                            <button 
                                onClick={(e) => { e.stopPropagation(); setEditingStatusItem(editingStatusItem === itemKey ? null : itemKey); }}
                                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight flex items-center w-fit gap-1 border border-white/30 bg-white/10 hover:bg-white/20 transition-all cursor-pointer text-inherit"
                                style={cellStyle}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                {s}
                                <span className="material-symbols-outlined text-[12px] ml-1">arrow_drop_down</span>
                            </button>
                            
                            {editingStatusItem === itemKey && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setEditingStatusItem(null); }}></div>
                                    <div className={`absolute ${popupPositionClass} left-0 bg-surface-container-lowest shadow-xl border border-outline-variant/20 rounded-xl z-20 py-2 max-h-64 overflow-y-auto min-w-[150px] custom-scrollbar`}>
                                        {Object.keys(state.omsStatusColors || defaultStatusColors).map(st => (
                                            <button 
                                                key={st}
                                                className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-surface-container-low text-on-surface"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateSaleOrderItemStatus(item.orderId, item.itemCode, st, 0, item.lineCode || null);
                                                    setAcknowledgedCautionItems(prev => { const n = new Set(prev); n.add(itemKey); return n; });
                                                    setEditingStatusItem(null);
                                                }}
                                            >{st}</button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                }

                const badgeClass = isCompleted ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : isInProcess ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-warning/10 text-warning';
                const dotClass = isCompleted ? 'bg-tertiary' : isInProcess ? 'bg-primary animate-pulse' : 'bg-warning';
                return (
                    <div className="flex items-center gap-2 relative">
                        {hasOutputButNotCompleted && (
                            <span className="material-symbols-outlined text-warning text-lg" title="Action Required: Finalize Status">warning</span>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); setEditingStatusItem(editingStatusItem === itemKey ? null : itemKey); }}
                            className={`${badgeClass} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight flex items-center w-fit gap-1 hover:brightness-95 transition-all cursor-pointer`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
                            {s}
                            <span className="material-symbols-outlined text-[12px] ml-1">arrow_drop_down</span>
                        </button>
                        
                        {editingStatusItem === itemKey && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setEditingStatusItem(null); }}></div>
                                <div className={`absolute ${popupPositionClass} left-0 bg-surface-container-lowest shadow-xl border border-outline-variant/20 rounded-xl z-20 py-2 max-h-64 overflow-y-auto min-w-[150px] custom-scrollbar`}>
                                    {Object.keys(state.omsStatusColors || defaultStatusColors).map(st => (
                                        <button 
                                            key={st}
                                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-surface-container-low text-on-surface"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateSaleOrderItemStatus(item.orderId, item.itemCode, st, 0, item.lineCode || null);
                                                setAcknowledgedCautionItems(prev => { const n = new Set(prev); n.add(itemKey); return n; });
                                                setEditingStatusItem(null);
                                            }}
                                        >{st}</button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                );
            }
            case 'actions':
                return (
                    <div className="flex gap-2">
                        <button onClick={() => handleViewTimeline(item)} className="p-2 bg-surface-container-low hover:bg-primary/10 hover:text-primary text-on-surface-variant rounded-lg transition-colors flex items-center gap-2 text-xs font-bold" title="View Timeline" style={cellStyle}>
                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>visibility</span>
                            View
                        </button>
                        {item.isCustom && (
                            <button 
                                onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this custom stock item?')) {
                                        const updated = (state.customOmsItems || []).filter(ci => ci.id !== item.id);
                                        setCollection('customOmsItems', updated);
                                    }
                                }} 
                                className="p-2 bg-surface-container-low hover:bg-error/10 hover:text-error text-on-surface-variant rounded-lg transition-colors flex items-center justify-center" 
                                title="Delete Custom Item"
                                style={cellStyle}
                            >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="animate-in fade-in duration-500 w-full max-w-full px-0 relative pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-manrope font-extrabold tracking-tight text-on-surface">Order Management</h1>
                    <p className="text-on-surface-variant font-body mt-1">Real-time status tracking for synthetic order workflows.</p>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 bg-surface-container-lowest p-1.5 rounded-full shadow-sm border border-outline-variant/15 w-fit">
                        {['All Orders', 'By Customer', 'By Date'].map(btn => (
                            <button 
                                key={btn}
                                onClick={() => handleFilterButtonClick(btn)}
                                className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                                    activeFilter === btn ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low'
                                }`}
                            >{btn}</button>
                        ))}
                    </div>
                    <div className="flex items-center bg-surface-container-lowest p-1.5 rounded-full shadow-sm border border-outline-variant/15 gap-2 w-fit">
                        <button 
                            onClick={() => setViewMode('item')}
                            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${viewMode === 'item' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                        >Item-wise</button>
                        <button 
                            onClick={() => setViewMode('order')}
                            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${viewMode === 'order' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                        >Sale Order-wise</button>
                    </div>
                    <button
                        onClick={() => setPrintOpen(true)}
                        className="px-5 py-2 rounded-full text-sm font-semibold bg-secondary/10 text-secondary hover:bg-secondary/20 shadow-sm border border-outline-variant/15 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-base">print</span>
                        Print Orders Report
                    </button>
                </div>
            </div>

            {/* Filter Controls */}
            {!isFiltersHidden && (
                <div className="bg-surface-container-low p-6 rounded-2xl mb-8 flex flex-wrap items-center gap-6 border-none">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 px-1">Search Database</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">manage_search</span>
                            <input 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 focus:ring-primary rounded-xl py-3 pl-11 pr-4 text-sm font-medium" 
                                placeholder="Sale Order / Code..." type="text" 
                            />
                        </div>
                    </div>
                    <div className="w-48">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 px-1">Status</label>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 focus:ring-primary rounded-xl py-3 px-4 text-sm font-medium">
                            <option>All Statuses</option>
                            <option>Pending</option>
                            <option>In Process</option>
                            <option>Completed</option>
                        </select>
                    </div>
                    <div className="w-48">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 px-1">Customer</label>
                        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="w-full bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 focus:ring-primary rounded-xl py-3 px-4 text-sm font-medium">
                            <option>All Customers</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-40">
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 px-1">Sort Order</label>
                        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 focus:ring-primary rounded-xl py-3 px-4 text-sm font-medium">
                            <option value="desc">Descending</option>
                            <option value="asc">Ascending</option>
                        </select>
                    </div>
                    <div className="pt-6">
                        <button onClick={() => { setSearchTerm(''); setStatusFilter('All Statuses'); setCustomerFilter('All Customers'); setSortOrder('desc'); setColFilters({}); }} className="bg-surface-container-highest p-3 rounded-xl text-primary hover:bg-primary hover:text-white transition-all" title="Clear Filters">
                            <span className="material-symbols-outlined">filter_list_off</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Data Table Section */}
            <div className="flex justify-end items-center gap-3 mb-4 flex-wrap">
                <button 
                    onClick={() => {
                        setRowHeight(prev => prev === 'normal' ? 'compact' : prev === 'compact' ? 'tall' : 'normal');
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-surface-container-highest text-on-surface-variant hover:bg-outline-variant/20 transition-all shadow-sm"
                    title="Change row spacing"
                >
                    <span className="material-symbols-outlined text-lg">
                        {rowHeight === 'compact' ? 'density_small' : rowHeight === 'tall' ? 'density_large' : 'density_medium'}
                    </span>
                    Density: {rowHeight.charAt(0).toUpperCase() + rowHeight.slice(1)}
                </button>
                <button 
                    onClick={() => setShowStatusModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-surface-container-highest text-on-surface-variant hover:bg-outline-variant/20 transition-all shadow-sm"
                >
                    <span className="material-symbols-outlined text-lg">palette</span>
                    Manage Statuses
                </button>
                {viewMode === 'item' && (
                    <button 
                        onClick={() => setIsAddingStockItem(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-primary text-on-primary hover:bg-primary/95 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined text-lg">add_circle</span>
                        Add Stock Item
                    </button>
                )}
                <div className="flex items-center bg-surface-container-highest rounded-full shadow-sm">
                    <button 
                        onClick={() => setIsHeaderPinned(!isHeaderPinned)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${isHeaderPinned ? 'bg-primary text-white shadow-md' : 'bg-surface-container-highest text-on-surface-variant hover:bg-outline-variant/20'}`}
                    >
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>
                        {isHeaderPinned ? 'Headers Pinned' : 'Pin Headers'}
                    </button>
                    <button 
                        onClick={() => setIsFiltersHidden(!isFiltersHidden)}
                        className="flex items-center justify-center p-2 rounded-full text-on-surface-variant hover:bg-outline-variant/20 transition-all ml-1 mr-2"
                        title={isFiltersHidden ? 'Show Filters' : 'Hide Filters'}
                    >
                        <span className="material-symbols-outlined text-lg font-bold">
                            {isFiltersHidden ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
                        </span>
                    </button>
                </div>
            </div>
            <div className="bg-surface-container-lowest rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] overflow-hidden">
                <div className="overflow-x-auto overflow-y-visible w-full h-auto relative custom-scrollbar">
                    {viewMode === 'item' ? (
                        <table className="w-full text-left border-collapse">
                            <thead className={`bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider ${isHeaderPinned ? 'sticky top-0 z-30 shadow-sm' : ''}`}>
                                <tr>
                                    {columns.filter(c => c.visible).map((col, index) => (
                                            <ResizableHeader 
                                                key={col.id}
                                                defaultWidth={col.width}
                                                onResize={(w) => handleColResize(col.id, w)}
                                                onDragOver={(e) => handleColDragOver(e, index)}
                                                onDrop={handleColDrop}
                                                className={`py-5 px-6 border-b border-outline-variant/10 relative group ${draggedCol === index ? 'opacity-50' : ''}`}
                                            >
                                            <div className="flex items-center justify-between gap-2 select-none">
                                                <span>{col.label}</span>
                                                {col.id !== 'actions' && (
                                                    <div className="flex items-center gap-1">
                                                        <span 
                                                            draggable={true}
                                                            onDragStart={(e) => handleColDragStart(e, index)}
                                                            className="material-symbols-outlined text-[16px] cursor-grab active:cursor-grabbing text-outline-variant hover:text-on-surface p-1"
                                                            title="Drag to reorder column"
                                                        >
                                                            drag_indicator
                                                        </span>
                                                        <div className="relative">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpenFilterPopup(openFilterPopup === col.id ? null : col.id); }} 
                                                                className={`p-1 rounded hover:bg-surface-container-highest transition-colors flex items-center justify-center ${(colFilters[col.id] && colFilters[col.id].length > 0) ? 'text-primary' : 'text-outline-variant'}`}
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">filter_alt</span>
                                                            </button>
                                                        </div>
                                                        {openFilterPopup === col.id && (
                                                            <>
                                                                <div className="fixed inset-0 z-10" onClick={() => setOpenFilterPopup(null)}></div>
                                                                <div className="absolute top-full right-0 mt-1 w-48 bg-surface-container-lowest shadow-xl border border-outline-variant/20 rounded-xl z-20 py-2 max-h-64 overflow-y-auto custom-scrollbar">
                                                                    <div className="px-3 pb-2 mb-2 border-b border-outline-variant/10">
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Filter {col.label}</span>
                                                                    </div>
                                                                    {getUniqueValues(col.id).map(val => (
                                                                        <label key={val} className="flex items-center px-4 py-2 hover:bg-surface-container-low cursor-pointer gap-3 text-xs font-medium text-on-surface capitalize">
                                                                            <input 
                                                                                type="checkbox" 
                                                                                className="rounded border-outline-variant text-primary focus:ring-primary/20 bg-transparent"
                                                                                checked={colFilters[col.id]?.includes(val) || false}
                                                                                onChange={() => handleColFilterChange(col.id, val)}
                                                                            />
                                                                            <span className="truncate">{val}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </ResizableHeader>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-container">
                                {isAddingStockItem && (
                                    <tr className="bg-surface-container-low/60 border-b border-outline-variant/30">
                                        <td className={`${paddingClass} align-middle font-bold text-on-surface-variant`}>-</td>
                                        <td className={`${paddingClass} align-middle`}>
                                            <input 
                                                type="date"
                                                value={newStockItem.date}
                                                onChange={e => setNewStockItem(prev => ({ ...prev, date: e.target.value }))}
                                                className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-32"
                                            />
                                        </td>
                                        <td className={`${paddingClass} align-middle`}>
                                            <span className="font-mono text-xs font-semibold bg-slate-100 rounded px-2 py-1.5 w-fit text-slate-700">
                                                {getNextItemCode()}
                                            </span>
                                        </td>
                                        <td className={`${paddingClass} align-middle relative`}>
                                            <div className="relative">
                                                <input 
                                                    type="text"
                                                    placeholder="Search item name..."
                                                    value={itemSearchVal}
                                                    onChange={e => {
                                                        setItemSearchVal(e.target.value);
                                                        setDropdownOpen(true);
                                                    }}
                                                    onFocus={() => setDropdownOpen(true)}
                                                    className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-full min-w-[200px]"
                                                />
                                                {dropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)}></div>
                                                        <ul className="absolute left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto py-1 w-64 custom-scrollbar">
                                                            {filteredSearchItems.length > 0 ? (
                                                                filteredSearchItems.map(item => (
                                                                    <li 
                                                                        key={item.id} 
                                                                        onClick={() => {
                                                                            setNewStockItem(prev => ({
                                                                                ...prev,
                                                                                itemId: item.id,
                                                                                productName: item.name
                                                                            }));
                                                                            setItemSearchVal(item.name);
                                                                            setDropdownOpen(false);
                                                                        }}
                                                                        className="px-3 py-2 text-xs hover:bg-surface-container-low cursor-pointer font-semibold text-on-surface"
                                                                    >
                                                                        {item.name}
                                                                    </li>
                                                                ))
                                                            ) : (
                                                                <li className="px-3 py-2 text-xs text-on-surface-variant italic">No finished goods found</li>
                                                            )}
                                                        </ul>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`${paddingClass} align-middle`}>
                                            <span className="text-xs font-bold text-on-surface-variant uppercase">FOR STOCK</span>
                                        </td>
                                        <td className={`${paddingClass} align-middle`}>
                                            <input 
                                                type="number"
                                                placeholder="Metres"
                                                value={newStockItem.quantity}
                                                onChange={e => setNewStockItem(prev => ({ ...prev, quantity: e.target.value }))}
                                                className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-2 py-1.5 text-xs font-bold text-right focus:outline-none focus:ring-1 focus:ring-primary w-24"
                                            />
                                        </td>
                                        <td className={`${paddingClass} align-middle font-semibold text-right`}>0</td>
                                        <td className={`${paddingClass} align-middle font-bold text-tertiary text-right`}>{newStockItem.quantity || 0}</td>
                                        <td className={`${paddingClass} align-middle`}>
                                            <select 
                                                value={newStockItem.status}
                                                onChange={e => setNewStockItem(prev => ({ ...prev, status: e.target.value }))}
                                                className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary w-28"
                                            >
                                                {Object.keys(state.omsStatusColors || defaultStatusColors).map(st => (
                                                    <option key={st} value={st}>{st}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className={`${paddingClass} align-middle text-on-surface-variant`}>-</td>
                                        <td className={`${paddingClass} align-middle`}>
                                            <div className="flex gap-2 justify-center">
                                                <button 
                                                    onClick={() => {
                                                        if (!newStockItem.productName || !newStockItem.quantity) return;
                                                        const nextCode = getNextItemCode();
                                                        const newItem = {
                                                            id: `CUSTOM-${Date.now()}`,
                                                            itemCode: nextCode,
                                                            itemId: newStockItem.itemId,
                                                            productName: newStockItem.productName,
                                                            quantity: Number(newStockItem.quantity),
                                                            producedQty: 0,
                                                            status: newStockItem.status,
                                                            date: newStockItem.date,
                                                            customerName: 'FOR STOCK',
                                                            customerId: 'FOR STOCK'
                                                        };
                                                        setCollection('customOmsItems', [...(state.customOmsItems || []), newItem]);
                                                        setIsAddingStockItem(false);
                                                        setItemSearchVal('');
                                                        setNewStockItem({
                                                            itemCode: '',
                                                            itemId: '',
                                                            productName: '',
                                                            quantity: '',
                                                            date: new Date().toISOString().split('T')[0],
                                                            status: 'Pending'
                                                        });
                                                    }}
                                                    className="px-2.5 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary/90"
                                                >
                                                    Save
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setIsAddingStockItem(false);
                                                        setItemSearchVal('');
                                                    }}
                                                    className="px-2.5 py-1.5 bg-surface-container-highest text-on-surface-variant rounded-lg text-xs font-bold hover:bg-outline-variant/20"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {displayedData.length > 0 ? displayedData.map((item, idx) => {
                                    const statusColors = state.omsStatusColors || defaultStatusColors;
                                    const statusColor = statusColors[item.status] || '';
                                    const textColor = statusColor ? getTextColorForBg(statusColor) : '';
                                    const rowStyle = statusColor ? { backgroundColor: statusColor, color: textColor } : {};
                                    return (
                                        <tr key={`item-${idx}`} style={rowStyle} className="hover:bg-surface-container-low/30 transition-colors group">
                                            {columns.filter(c => c.visible).map(col => (
                                                <td key={col.id} className={`${paddingClass} align-middle`} style={statusColor ? { color: 'inherit' } : {}}>
                                                    {renderCellContent(item, col.id, statusColor, textColor, idx, displayedData.length)}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={columns.filter(c => c.visible).length} className="py-10 text-center text-on-surface-variant">No items match the current filters.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className={`bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider ${isHeaderPinned ? 'sticky top-0 z-30 shadow-sm' : ''}`}>
                                <tr>
                                    <th className="py-5 px-6 border-b border-outline-variant/10">Sale Order No</th>
                                    <th className="py-5 px-6 border-b border-outline-variant/10">Order Date</th>
                                    <th className="py-5 px-6 border-b border-outline-variant/10">Customer Name</th>
                                    <th className="py-5 px-6 border-b border-outline-variant/10">Total Line Items</th>
                                    <th className="py-5 px-6 border-b border-outline-variant/10">Total Order Metre</th>
                                    <th className="py-5 px-6 border-b border-outline-variant/10">Total Output Metres</th>
                                    <th className="py-5 px-6 border-b border-outline-variant/10 font-extrabold text-tertiary">Total Remaining Qty</th>
                                    <th className="py-5 px-6 border-b border-outline-variant/10">Aggregated Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-container">
                                {displayedData.length > 0 ? displayedData.map((group, idx) => {
                                    const diff = group.totalQuantity - group.totalProduced;
                                    const statusColors = state.omsStatusColors || defaultStatusColors;
                                    const statusColor = statusColors[group.status] || '';
                                    const textColor = statusColor ? getTextColorForBg(statusColor) : '';
                                    const rowStyle = statusColor ? { backgroundColor: statusColor, color: textColor } : {};
                                    return (
                                    <tr key={`group-${idx}`} style={rowStyle} className="hover:bg-surface-container-low/30 transition-colors group">
                                        <td className={`${paddingClass} font-manrope font-extrabold cursor-pointer hover:underline ${statusColor ? '' : 'text-primary'}`} style={statusColor ? { color: textColor } : {}} onClick={() => handleOrderClick(group.orderId)}>{group.orderId}</td>
                                        <td className={`${paddingClass} text-sm font-semibold`} style={statusColor ? { color: textColor } : {}}>{new Date(group.date).toLocaleDateString()}</td>
                                        <td className={`${paddingClass} text-sm font-semibold`} style={statusColor ? { color: textColor } : {}}>{group.customerName}</td>
                                        <td className={`${paddingClass} text-sm font-medium`} style={statusColor ? { color: textColor } : {}}>{group.totalItems}</td>
                                        <td className={`${paddingClass} text-sm font-medium`} style={statusColor ? { color: textColor } : {}}>{group.totalQuantity}m</td>
                                        <td className={`${paddingClass} text-sm font-bold`} style={statusColor ? { color: textColor } : {}}>{group.totalProduced}m</td>
                                        <td className={`${paddingClass} text-sm font-bold ${statusColor ? '' : 'text-tertiary'}`} style={statusColor ? { color: textColor } : {}}>{diff}m</td>
                                        <td className={`${paddingClass}`}>
                                            {(() => {
                                                const s = group.status || 'Pending';
                                                const isCompleted = s === 'Completed';
                                                const isInProcess = s === 'In Process';
                                                if (statusColor) {
                                                    return (
                                                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight flex items-center w-fit gap-1 border border-white/30 bg-white/10 text-inherit">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                            {s}
                                                        </span>
                                                    );
                                                }
                                                const badgeClass = isCompleted ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : isInProcess ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-warning/10 text-warning';
                                                const dotClass = isCompleted ? 'bg-tertiary' : isInProcess ? 'bg-primary animate-pulse' : 'bg-warning';
                                                return (
                                                    <span className={`${badgeClass} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight flex items-center w-fit gap-1`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
                                                        {s}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                )}) : (
                                    <tr>
                                        <td colSpan="8" className="py-10 text-center text-on-surface-variant">No orders match the current filters.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
 
                {/* Pagination */}
                {state.isGlobalPaginated && (
                    <GlobalPagination 
                        totalItems={processedData.length}
                        itemsPerPage={itemsPerPage}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        className="rounded-b-2xl"
                    />
                )}
            </div>

            {/* Sale Order Details Popup */}
            {viewOrderPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-surface text-on-surface w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
                        <div className="bg-surface-container-lowest px-8 py-6 border-b border-outline-variant/20 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-extrabold tracking-tight">Sale Order Details</h2>
                                <p className="text-sm font-semibold text-primary">{viewOrderPopup.id}</p>
                            </div>
                            <button onClick={() => setViewOrderPopup(null)} className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-6 mb-8">
                                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest block mb-1">Customer</span>
                                    <span className="font-semibold">{customers.find(c => c.id === viewOrderPopup.customerId)?.name || viewOrderPopup.customerId}</span>
                                </div>
                                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest block mb-1">Date</span>
                                    <span className="font-semibold">{new Date(viewOrderPopup.date).toLocaleDateString()}</span>
                                </div>
                                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest block mb-1">Status</span>
                                    <span className="font-semibold text-primary">{viewOrderPopup.status || 'Pending'}</span>
                                </div>
                                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest block mb-1">Total Items</span>
                                    <span className="font-semibold">{viewOrderPopup.items?.length || 0}</span>
                                </div>
                            </div>
                            <h3 className="font-bold mb-4 border-b border-outline-variant/10 pb-2">Order Items</h3>
                            <ul className="space-y-3">
                                {viewOrderPopup.items?.map((it, i) => {
                                    const productName = state.items.find(stIt => stIt.id === it.itemId)?.name || 'Unknown';
                                    return (
                                    <li key={i} className="flex justify-between items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant/5">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-semibold text-sm">{productName}</span>
                                            <span className="font-mono text-xs text-on-surface-variant bg-surface-container px-1 py-0.5 rounded w-fit">{it.itemCode}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-black text-on-surface block">{it.quantity}m</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{it.status}</span>
                                        </div>
                                    </li>
                                )})}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Production Timeline Popup */}
            {viewTimelinePopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-surface text-on-surface w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
                        <div className="bg-surface-container-lowest px-8 py-6 border-b border-outline-variant/20 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-extrabold tracking-tight">Production Timeline</h2>
                                <p className="text-sm font-semibold text-on-surface-variant">{viewTimelinePopup.productName} <span className="font-mono bg-surface-container px-1 py-0.5 rounded ml-2">{viewTimelinePopup.itemCode}</span></p>
                            </div>
                            <button onClick={() => setViewTimelinePopup(null)} className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="flex gap-8 mb-8 pb-8 border-b border-outline-variant/10">
                                <div className="flex-1">
                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest block mb-1">Target Output</span>
                                    <span className="text-2xl font-black text-on-surface">{viewTimelinePopup.quantity}m</span>
                                </div>
                                <div className="flex-1">
                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest block mb-1">Produced So Far</span>
                                    <span className="text-2xl font-black text-primary">{viewTimelinePopup.producedQty || 0}m</span>
                                </div>
                            </div>
                            
                            <h3 className="font-bold mb-6 text-on-surface">Production Steps History</h3>
                            {viewTimelinePopup.outputs && viewTimelinePopup.outputs.length > 0 ? (
                                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-outline-variant/20 before:to-transparent">
                                    {viewTimelinePopup.outputs.map((out, idx) => (
                                        <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface bg-primary text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                                <span className="material-symbols-outlined text-[18px]">precision_manufacturing</span>
                                            </div>
                                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-primary text-lg">{out.quantity}m</span>
                                                        {out.typeName && <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest bg-surface-container w-fit px-1.5 py-0.5 rounded mt-1">{out.typeName}</span>}
                                                    </div>
                                                    <span className="text-xs font-semibold text-on-surface-variant bg-surface-container px-2 py-1 rounded">{new Date(out.createdAt || out.date).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-xs text-on-surface-variant">Plan ID: <span className="font-mono font-bold text-on-surface">{out.planId}</span></p>
                                                {out.rolls && <p className="text-[10px] font-bold uppercase tracking-widest text-outline mt-2">{out.rolls} Rolls Produced</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                                    <span className="material-symbols-outlined text-4xl text-outline mb-2">hourglass_empty</span>
                                    <p className="text-on-surface-variant font-medium text-sm">No production output recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Manage Statuses Modal */}
            {showStatusModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface rounded-3xl w-full max-w-md shadow-2xl flex flex-col border border-outline-variant/20 animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="flex justify-between items-center p-6 border-b border-outline-variant/10">
                            <h3 className="text-xl font-bold font-manrope text-on-surface">Manage Statuses & Colors</h3>
                            <button onClick={() => setShowStatusModal(false)} className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant transition-colors">
                                <span className="material-symbols-outlined font-bold">close</span>
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                            <div className="flex gap-2 items-center">
                                <input 
                                    type="text" 
                                    placeholder="Status Name (e.g. In Production)"
                                    value={newStatusName}
                                    onChange={e => setNewStatusName(e.target.value)}
                                    className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm focus:border-primary focus:outline-none text-on-surface"
                                />
                                <input 
                                    type="color" 
                                    value={newStatusColor}
                                    onChange={e => setNewStatusColor(e.target.value)}
                                    className="w-10 h-10 border border-outline-variant/30 rounded-xl cursor-pointer bg-transparent"
                                />
                                <button 
                                    onClick={() => {
                                        if (!newStatusName) return;
                                        const currentColors = state.omsStatusColors || defaultStatusColors;
                                        const updatedColors = {
                                            ...currentColors,
                                            [newStatusName]: newStatusColor
                                        };
                                        setCollection('omsStatusColors', updatedColors);
                                        setNewStatusName('');
                                    }} 
                                    className="bg-primary text-on-primary px-3 py-2 rounded-xl font-bold hover:bg-primary/90 text-sm"
                                >
                                    Add
                                </button>
                            </div>

                            <div className="space-y-2 mt-4">
                                {Object.entries(state.omsStatusColors || defaultStatusColors).map(([status, color]) => (
                                    <div key={status} className="flex justify-between items-center p-3 bg-surface-container-lowest border border-outline-variant/20 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: color }}></span>
                                            <span className="font-bold text-sm text-on-surface">{status}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="color"
                                                value={color}
                                                onChange={e => {
                                                    const currentColors = state.omsStatusColors || defaultStatusColors;
                                                    const updatedColors = {
                                                        ...currentColors,
                                                        [status]: e.target.value
                                                    };
                                                    setCollection('omsStatusColors', updatedColors);
                                                }}
                                                className="w-8 h-8 border border-outline-variant/30 rounded-lg cursor-pointer bg-transparent"
                                            />
                                            {/* Don't allow deleting core system statuses */}
                                            {!['Pending', 'In Process', 'Completed', 'Cancelled'].includes(status) && (
                                                <button 
                                                    onClick={() => {
                                                        const currentColors = { ...(state.omsStatusColors || defaultStatusColors) };
                                                        delete currentColors[status];
                                                        setCollection('omsStatusColors', currentColors);
                                                    }} 
                                                    className="text-error hover:bg-error/10 p-1.5 rounded-lg transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[16px] font-bold">delete</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 border-t border-outline-variant/10 bg-surface-container-lowest flex justify-end">
                            <button onClick={() => setShowStatusModal(false)} className="px-6 py-2.5 rounded-xl font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors">Done</button>
                        </div>
                    </div>
                </div>
            )}
            {printOpen && (
                <UniversalPrintStudioModal
                    isOpen={printOpen}
                    onClose={() => setPrintOpen(false)}
                    documentType="pending_orders"
                    documentData={printRecord}
                />
            )}
        </div>
    );
}
