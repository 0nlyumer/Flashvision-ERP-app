import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import ResizableHeader from '../ui/ResizableHeader';
import PrintLayout from '../ui/PrintLayout';
import GlobalPagination from '../ui/GlobalPagination';
import CustomMultiSelect from '../ui/CustomMultiSelect';
import StockReportStudio from './StockReportStudio';
import { normalizeFGConfig, getInitialFGConfig } from '../../utils/fgCombinationUtils';
import {
  UNGRADED,
  getTypeMeta,
  typeUnit,
  buildStockRow,
  sumStockRows,
  groupStockRows,
  buildLedgerEntries,
  computeLedgerBalances,
  getPackingLabel,
  extractPaperCode,
  toCsv,
} from '../../utils/stockReportUtils';

const TX_TYPES = ['Purchase', 'Sale', 'Production', 'Adjustment', 'Return', 'Transfer', 'Consumption'];

const fmt = (n, dp = 2) =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString(undefined, { maximumFractionDigits: dp });
const fmtMoney = (n) =>
  n === null || n === undefined
    ? '—'
    : Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvLedger({ selectedDepartments = [], onBack }) {
  const { state, toggleGlobalPagination, hasPermission } = useApp();
  
  // States
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const itemDropdownRef = useRef(null);
  
  const [activeItemIds, setActiveItemIds] = useState([]); // Controls what is actually fetched

  // Local department filter for modules that don't pass it down (like ProductionModule)
  const [localDepartments, setLocalDepartments] = useState([]);
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedTypes, setSelectedTypes] = useState([...TX_TYPES, 'Initial']);

  // ---- FG Stock Report state ----
  const [reportMode, setReportMode] = useState('stock'); // 'stock' | 'transactions'
  const [selectedGrades, setSelectedGrades] = useState(null); // null = all grades
  const [grouping, setGrouping] = useState('item'); // 'item' | 'paper' | 'packing'
  const [showValue, setShowValue] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [reportModel, setReportModel] = useState(null);

  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isGradeDropdownOpen, setIsGradeDropdownOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const typeDropdownRef = useRef(null);
  const gradeDropdownRef = useRef(null);

  const [currentPages, setCurrentPages] = useState({});
  const itemsPerPage = 20;

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target)) setIsItemDropdownOpen(false);
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) setIsTypeDropdownOpen(false);
      if (gradeDropdownRef.current && !gradeDropdownRef.current.contains(event.target)) setIsGradeDropdownOpen(false);
      if (!event.target.closest('.export-dropdown')) setIsExportDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Stock Value is permission-gated (inventory / stockValue screen in User
  // Control). Without it the toggle is disabled and value data is never
  // computed into the DOM or any export. Super Admin passes via hasPermission.
  const canViewValue = !!hasPermission && hasPermission('inventory', 'stockValue');
  const valueOn = canViewValue && showValue;

  // FG Combo config (paper codes + packings) — same source the combo uses.
  const fgConfig = useMemo(() => {
    try {
      return normalizeFGConfig(state?.fg_combinations_config || getInitialFGConfig());
    } catch (e) {
      return getInitialFGConfig();
    }
  }, [state?.fg_combinations_config]);
  const paperCodeList = useMemo(() => fgConfig?.paperCodes || [], [fgConfig]);
  const packingList = useMemo(() => fgConfig?.packings || [], [fgConfig]);

  const effectiveDepartments = selectedDepartments.length > 0 ? selectedDepartments : localDepartments;

  const filteredItems = useMemo(() => {
    if (!effectiveDepartments || effectiveDepartments.length === 0) return [];
    return state?.items?.filter(item => {
        const depts = (item.department || '').split(',').map(d => d.trim()).filter(Boolean);
        return depts.some(d => effectiveDepartments.includes(d));
    }) || [];
  }, [state?.items, effectiveDepartments]);

  const searchedItems = useMemo(() => {
    if (!itemSearchQuery) return filteredItems;
    const lowerQ = itemSearchQuery.toLowerCase();
    return filteredItems.filter(item => 
        (item.name || '').toLowerCase().includes(lowerQ) || 
        (item.sku || '').toLowerCase().includes(lowerQ)
    );
  }, [filteredItems, itemSearchQuery]);

  const handleToggleItem = (id) => {
      setSelectedItemIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleGrade = (name) => {
      setSelectedGrades(prev => {
          const base = prev === null ? [...discoveredGrades] : [...prev];
          return base.includes(name) ? base.filter(t => t !== name) : [...base, name];
      });
  };

  const handleToggleType = (type) => {
      setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  // ---- Movement stream (audited sources — see stockReportUtils) ----
  const rawEntries = useMemo(() => buildLedgerEntries(state || {}), [state]);

  // Grades known to the system: configured batch output types first, then
  // any extra grade names found in entries / stored stock splits.
  const discoveredGrades = useMemo(() => {
      const names = getTypeMeta(state?.batchOutputTypes || []).map(t => t.name);
      rawEntries.forEach(e => {
          if (e.outputType && e.outputType !== UNGRADED && !names.includes(e.outputType)) names.push(e.outputType);
      });
      (state?.items || []).forEach(i => Object.keys(i.stockByType || {}).forEach(t => {
          if (!names.includes(t)) names.push(t);
      }));
      return names;
  }, [rawEntries, state?.batchOutputTypes, state?.items]);

  const allGradesSelected = selectedGrades === null;
  const effectiveGrades = allGradesSelected ? discoveredGrades : selectedGrades;

  // Grade filter applies to the WHOLE register: the per-grade streams are
  // built from the selected grades only, and balances are anchored per
  // grade so every closing balance equals the current stockByType figure.
  // Ungraded movements (transfers, GRN, other consumption) belong to the
  // All Grades view only.
  const allEntries = useMemo(() => {
      const gradeSet = new Set(effectiveGrades);
      const stream = rawEntries.filter(e => {
          if (e.outputType === UNGRADED) return allGradesSelected;
          return gradeSet.has(e.outputType);
      });
      return computeLedgerBalances(stream, filteredItems);
  }, [rawEntries, effectiveGrades, allGradesSelected, filteredItems]);

  const filteredEntries = useMemo(() => {
      return allEntries.filter(e => {
          // Date Filter
          if (dateFrom) {
              const dFrom = new Date(dateFrom).getTime();
              const eTime = new Date(e.dateStr || e.timestamp).getTime();
              if (eTime < dFrom && (dFrom - eTime) > 86400000) return false; 
          }
          if (dateTo) {
              const dTo = new Date(dateTo).getTime();
              const eTime = new Date(e.dateStr || e.timestamp).getTime();
              if (eTime > dTo + 86400000) return false;
          }

          // Type Filter
          if (!selectedTypes.includes(e.type)) return false;

          // Item Filter (Driven by activeItemIds instead of selectedItemIds)
          if (activeItemIds.length > 0 && !activeItemIds.includes(e.matchedItem.id)) return false;

          return true;
      });
  }, [allEntries, dateFrom, dateTo, selectedTypes, activeItemIds]);

  // Group entries by item and output type
  const groupedEntries = useMemo(() => {
      const groups = {};
      filteredEntries.forEach(e => {
          const itemId = e.matchedItem.id;
          const outputType = e.outputType || '-';
          const groupKey = `${itemId}::${outputType}`;
          
          if (!groups[groupKey]) {
              groups[groupKey] = {
                  id: groupKey,
                  item: e.matchedItem,
                  outputType: outputType,
                  entries: [],
                  inward: 0,
                  outward: 0
              };
          }
          groups[groupKey].entries.push(e);
          groups[groupKey].inward += e.qtyIn || 0;
          groups[groupKey].outward += e.qtyOut || 0;
      });
      return groups;
  }, [filteredEntries]);

  // Stats
  const stats = useMemo(() => {
      let totalStock = 0;
      let itemsCount = new Set();
      let inward = 0;
      let outward = 0;
      
      // Calculate current stock of active items
      const targetItems = activeItemIds.length > 0 ? filteredItems.filter(i => activeItemIds.includes(i.id)) : filteredItems;
      targetItems.forEach(i => {
          let tStock = i.stock || 0;
          // Use stockByType if available to be accurate with the grade filter
          if (i.stockByType && Object.keys(i.stockByType).length > 0) {
              tStock = 0;
              Object.entries(i.stockByType).forEach(([typeName, qty]) => {
                  if (effectiveGrades.includes(typeName)) {
                      tStock += qty;
                  }
              });
          }

          totalStock += tStock;
          itemsCount.add(i.id);
      });

      // Calculate movements in the current filtered view
      filteredEntries.forEach(e => {
          inward += e.qtyIn;
          outward += e.qtyOut;
      });

      return { totalStock, itemCount: itemsCount.size, inward, outward, txCount: filteredEntries.length };
  }, [filteredEntries, filteredItems, activeItemIds, effectiveGrades]);

  const handleGetLedger = () => {
      setActiveItemIds(selectedItemIds);
  };

  const handlePrint = () => {
    // Permission gate (User Control → Inventory → Inventory Ledger → Print):
    // every print entry point on this screen funnels through here.
    if (hasPermission && !hasPermission('inventory', 'ledger', 'print')) return;
      if (reportMode === 'stock') {
          openReportStudio();
          return;
      }
      setTimeout(() => {
          window.print();
      }, 100);
  };

  const handleExport = () => {
      if (filteredEntries.length === 0) return;
      const csvContent = "data:text/csv;charset=utf-8," 
          + "Date,Item,SKU,Type,Ref,Qty In,Qty Out,Balance\n"
          + filteredEntries.map(e => 
              `${new Date(e.timestamp).toLocaleDateString()},"${e.matchedItem.name}","${e.matchedItem.sku}",${e.type},${e.ref},${e.qtyIn || 0},${e.qtyOut || 0},${e.balance}`
          ).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Inventory_Ledger_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const resetFilters = () => {
      setSelectedItemIds([]);
      setActiveItemIds([]);
      setDateFrom('');
      setDateTo('');
      setSelectedTypes([...TX_TYPES, 'Initial']);
      setSelectedGrades(null);
      setGrouping('item');
      setShowValue(false);
  };

  // ---------------- FG Stock Report derivation ----------------
  const stockScopeItems = useMemo(() => {
      return activeItemIds.length > 0
          ? filteredItems.filter(i => activeItemIds.includes(i.id))
          : filteredItems;
  }, [filteredItems, activeItemIds]);

  const stockRows = useMemo(() => stockScopeItems.map(item => {
      const row = buildStockRow(item, {
          departments: effectiveDepartments,
          batchOutputTypes: state?.batchOutputTypes || [],
          showValue: valueOn,
      });
      return {
          ...row,
          packingLabel: getPackingLabel(item, packingList),
          paperCode: extractPaperCode(item, paperCodeList),
      };
  }), [stockScopeItems, effectiveDepartments, state?.batchOutputTypes, valueOn, packingList, paperCodeList]);

  // Grade columns shown in the stock report (selected grades only)
  const stockGradeColumns = useMemo(() => effectiveGrades.map(name => ({
      name,
      unit: typeUnit(name, state?.batchOutputTypes || []),
  })), [effectiveGrades, state?.batchOutputTypes]);

  const stockGroups = useMemo(
      () => groupStockRows(stockRows, grouping, { paperCodes: paperCodeList, packings: packingList }),
      [stockRows, grouping, paperCodeList, packingList],
  );
  const stockGrand = useMemo(() => sumStockRows(stockRows), [stockRows]);
  const missingRateCount = stockRows.filter(r => r.missingRate).length;
  const splitUnavailableCount = stockRows.filter(r => r.hasTypes && !r.splitExact).length;

  const currencyCode = (state?.adminSetup?.baseCurrency || 'PKR').split('(')[0].trim() || 'PKR';
  const deptScopeLabel = effectiveDepartments.length ? effectiveDepartments.join(', ') : 'No department selected';
  const gradeScopeLabel = allGradesSelected ? 'All Grades' : (effectiveGrades.join(', ') || 'No grades');

  // ---------------- Report models (studio + CSV share these) ----------------
  const buildStockReportModel = () => {
      const columns = [
          { key: 'name', label: 'Item Name', width: 250 },
          { key: 'sku', label: 'Item Code', width: 85 },
          { key: 'packing', label: 'Packing Size', width: 85 },
          ...stockGradeColumns.map(c => ({
              key: `t_${c.name}`,
              label: `${c.name} (${c.unit === 'Kgs' ? 'kg' : 'm'})`,
              numeric: true,
              width: 85,
          })),
          { key: 'totalMeters', label: 'Total Meters', numeric: true, width: 100 },
          { key: 'rolls', label: 'Rolls', numeric: true, width: 75 },
          ...(valueOn ? [{ key: 'value', label: `Value (${currencyCode})`, numeric: true, width: 110 }] : []),
      ];

      const rowValues = (r) => {
          const v = {
              name: r.name,
              sku: r.sku,
              packing: r.packingSize ? `${r.packingSize} m` : '—',
              totalMeters: fmt(r.totalMeters),
              rolls: r.rolls === null ? '—' : fmt(r.rolls),
          };
          stockGradeColumns.forEach(c => {
              const q = r.typeQtys[c.name];
              v[`t_${c.name}`] = q === null || q === undefined ? '—' : fmt(q);
          });
          if (valueOn) v.value = r.value === null ? '—' : fmtMoney(r.value);
          return v;
      };
      const totalValues = (rows, label) => {
          const s = sumStockRows(rows);
          const v = { name: label, sku: '', packing: '', totalMeters: fmt(s.totalMeters), rolls: s.rolls === null ? '—' : fmt(s.rolls) };
          stockGradeColumns.forEach(c => {
              v[`t_${c.name}`] = s.typeTotals[c.name] === undefined ? '—' : fmt(s.typeTotals[c.name]);
          });
          if (valueOn) v.value = s.value === null ? '—' : fmtMoney(s.value);
          return v;
      };

      const groups = stockGroups.map(g => ({
          label: g.label || '',
          rows: [
              ...g.rows.map(r => ({ kind: 'data', values: rowValues(r) })),
              ...(g.label ? [{ kind: 'subtotal', values: totalValues(g.rows, `Subtotal — ${g.label}`) }] : []),
          ],
      }));
      groups.push({ label: '', rows: [{ kind: 'grand', values: totalValues(stockRows, 'GRAND TOTAL') }] });

      const footnotes = ['Current Stock at the time of generation (date range applies to the Transactions Report only).'];
      if (splitUnavailableCount > 0) footnotes.push(`${splitUnavailableCount} item(s) also hold stock in departments outside this scope — the grade split is not stored per department, so their grade columns show '—'; their totals are the exact department figures.`);
      if (valueOn && missingRateCount > 0) footnotes.push(`${missingRateCount} item(s) without a rate — value incomplete.`);

      const csvLines = [
          ['Finished Goods Stock Report'],
          [`Departments: ${deptScopeLabel}`],
          [`Grades: ${gradeScopeLabel}`],
          [`Grouping: ${grouping === 'item' ? 'Item-wise' : grouping === 'paper' ? 'Paper-wise' : 'Packing-wise'}`],
          [],
          columns.map(c => c.label),
      ];
      const csvRow = (vals) => columns.map(c => vals[c.key] ?? '');
      stockGroups.forEach(g => {
          if (g.label) csvLines.push([`== ${g.label} ==`]);
          g.rows.forEach(r => csvLines.push(csvRow(rowValues(r))));
          if (g.label) csvLines.push(csvRow(totalValues(g.rows, `Subtotal — ${g.label}`)));
      });
      csvLines.push(csvRow(totalValues(stockRows, 'GRAND TOTAL')));

      return {
          title: 'Finished Goods Stock Report',
          companyName: state?.adminSetup?.companyName || 'FlashVision ERP',
          scopeLines: [
              `Departments: ${deptScopeLabel}`,
              `Grades: ${gradeScopeLabel} • Grouping: ${grouping === 'item' ? 'Item-wise' : grouping === 'paper' ? 'Paper-wise' : 'Packing-wise'} • Stock: Current`,
          ],
          generatedAtLabel: `Generated: ${new Date().toLocaleString()}`,
          columns,
          groups,
          footnotes,
          filenameBase: `FG_Stock_Report_${new Date().toISOString().slice(0, 10)}`,
          csvText: toCsv(csvLines),
      };
  };

  const buildTransactionsReportModel = () => {
      const columns = [
          { key: 'date', label: 'Date', width: 90 },
          { key: 'type', label: 'Type', width: 80 },
          { key: 'ref', label: 'Ref #', width: 110 },
          { key: 'department', label: 'Department', width: 130 },
          { key: 'grade', label: 'Grade', width: 70 },
          { key: 'qtyIn', label: 'Qty In', numeric: true, width: 80 },
          { key: 'qtyOut', label: 'Qty Out', numeric: true, width: 80 },
          { key: 'balance', label: 'Balance', numeric: true, width: 90 },
      ];

      const sections = Object.values(groupedEntries);
      const sectionLabel = (s) => `${s.item.name} (${s.item.sku || s.item.id})${s.outputType !== UNGRADED ? ` — ${s.outputType}` : ''}`;
      const entryRow = (e) => ({
          kind: 'data',
          values: {
              date: e.timestamp === 0 ? 'Opening Balance' : new Date(e.timestamp).toLocaleDateString(),
              type: e.type,
              ref: e.ref || '',
              department: e.department || '—',
              grade: e.outputType || '—',
              qtyIn: e.qtyIn ? fmt(e.qtyIn) : '—',
              qtyOut: e.qtyOut ? fmt(e.qtyOut) : '—',
              balance: fmt(e.balance),
          },
      });
      const sectionRows = (s) => {
          const rows = s.entries.map(entryRow);
          const finalBalance = s.entries.length ? s.entries[s.entries.length - 1].balance : 0;
          rows.push({
              kind: 'subtotal',
              values: {
                  date: `Total — ${s.item.sku || s.item.id}${s.outputType !== UNGRADED ? ` (${s.outputType})` : ''}`,
                  type: '', ref: '', department: '', grade: '',
                  qtyIn: fmt(s.inward), qtyOut: fmt(s.outward), balance: fmt(finalBalance),
              },
          });
          return rows;
      };

      let groups;
      if (grouping === 'item') {
          groups = sections.map(s => ({ label: sectionLabel(s), rows: sectionRows(s) }));
      } else {
          const clusterOf = (item) => grouping === 'paper'
              ? (() => { const c = extractPaperCode(item, paperCodeList); return c === 'Other' ? 'Other' : `Paper ${c}`; })()
              : getPackingLabel(item, packingList);
          const clusters = new Map();
          sections.forEach(s => {
              const label = clusterOf(s.item);
              if (!clusters.has(label)) clusters.set(label, []);
              clusters.get(label).push(s);
          });
          groups = [...clusters.entries()]
              .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
              .map(([label, secs]) => {
                  const rows = [];
                  let inSum = 0, outSum = 0;
                  secs.forEach(s => {
                      inSum += s.inward; outSum += s.outward;
                      rows.push({ kind: 'subhead', values: { __label: sectionLabel(s) } });
                      rows.push(...sectionRows(s));
                  });
                  rows.push({
                      kind: 'subtotal',
                      values: { date: `Subtotal — ${label}`, type: '', ref: '', department: '', grade: '', qtyIn: fmt(inSum), qtyOut: fmt(outSum), balance: '' },
                  });
                  return { label, rows };
              });
      }

      const footnotes = ['Opening balances are anchored so each grade\u2019s closing balance equals the current stock figure for that grade.'];
      if (!allGradesSelected) footnotes.push('Grade filter active — untyped movements (transfers, purchase receipts, other consumption) appear only in the All Grades view.');
      if (dateFrom || dateTo) footnotes.push('Balances are running balances on the full register stream; entries outside the selected date range are not printed.');

      const csvLines = [
          ['Stock Transactions Report'],
          [`Departments: ${deptScopeLabel}`],
          [`Date Range: ${dateFrom || '…'} to ${dateTo || '…'}`],
          [`Grades: ${gradeScopeLabel}`],
          [],
          columns.map(c => c.label),
      ];
      groups.forEach(g => {
          if (g.label) csvLines.push([`== ${g.label} ==`]);
          g.rows.forEach(r => {
              if (r.kind === 'subhead') csvLines.push([`-- ${r.values.__label} --`]);
              else csvLines.push(columns.map(c => r.values[c.key] ?? ''));
          });
      });

      return {
          title: 'Stock Transactions Report',
          companyName: state?.adminSetup?.companyName || 'FlashVision ERP',
          scopeLines: [
              `Departments: ${deptScopeLabel}`,
              `Date Range: ${dateFrom || 'From start'} to ${dateTo || 'To date'} • Grades: ${gradeScopeLabel} • Grouping: ${grouping === 'item' ? 'Item-wise' : grouping === 'paper' ? 'Paper-wise' : 'Packing-wise'}`,
          ],
          generatedAtLabel: `Generated: ${new Date().toLocaleString()}`,
          columns,
          groups,
          footnotes,
          filenameBase: `Stock_Transactions_Report_${new Date().toISOString().slice(0, 10)}`,
          csvText: toCsv(csvLines),
      };
  };

  const openReportStudio = () => {
      setReportModel(reportMode === 'stock' ? buildStockReportModel() : buildTransactionsReportModel());
      setStudioOpen(true);
  };

  return (
    <>
    <div className="animate-in fade-in duration-500 max-w-full px-6 mx-auto pb-4 print:hidden">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-transparent pb-4 mb-8">
        <div className="space-y-4 flex-1 w-full max-w-2xl">
          <div className="flex items-center gap-4">
            {onBack && (
              <button 
                onClick={onBack}
                className="w-10 h-10 flex items-center justify-center bg-surface-container-high rounded-full hover:bg-surface-container-highest transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
              </button>
            )}
            <div>
              <h1 className="text-4xl font-extrabold text-on-surface tracking-tight leading-tight mb-1 font-headline">Multi-Item Ledger</h1>
              <p className="text-on-surface-variant text-base font-body">Consolidated tracking for multiple stocks with advanced filtering.</p>
            </div>
          </div>
          
          {/* Multi-Select Search Dropdown */}
          <div className="relative w-full" ref={itemDropdownRef}>
            <div 
                className="flex flex-wrap items-center gap-2 p-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl min-h-[52px] shadow-sm cursor-text"
                onClick={() => setIsItemDropdownOpen(true)}
            >
              {selectedItemIds.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-primary-container text-on-primary-container px-3 py-1 rounded-lg text-xs font-bold border border-primary/20 shrink-0">
                      <span>{selectedItemIds.length} item(s) selected</span>
                  </div>
              )}
              <input 
                  className="flex-1 min-w-[120px] border-none focus:ring-0 text-sm bg-transparent outline-none" 
                  placeholder={selectedItemIds.length === 0 ? "Search and select items..." : "Search more..."} 
                  type="text" 
                  value={itemSearchQuery}
                  onChange={(e) => {
                      setItemSearchQuery(e.target.value);
                      setIsItemDropdownOpen(true);
                  }}
              />
              {selectedItemIds.length > 0 && (
                  <button className="px-2 text-outline-variant hover:text-error" onClick={(e) => { e.stopPropagation(); setSelectedItemIds([]); }}>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>close</span>
                  </button>
              )}
              <button className="px-2 text-on-surface-variant">
                <span className={`material-symbols-outlined transition-transform ${isItemDropdownOpen ? 'rotate-180' : ''}`} style={{ fontVariationSettings: "'FILL' 0" }}>keyboard_arrow_down</span>
              </button>
            </div>
            
            {isItemDropdownOpen && (
                <div className="absolute z-50 w-full mt-2 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {searchedItems.length > 0 ? (
                        <ul className="py-2">
                            {searchedItems.map(item => {
                                const isSelected = selectedItemIds.includes(item.id);
                                return (
                                <li 
                                    key={item.id}
                                    className={`px-4 py-3 hover:bg-surface-container-low cursor-pointer flex items-center justify-between transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                                    onClick={() => handleToggleItem(item.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary text-white' : 'border-outline-variant/50 bg-surface-container-highest text-transparent'}`}>
                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold transition-colors ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{item.name}</p>
                                            <p className="text-[10px] font-mono text-outline-variant">{item.sku}</p>
                                        </div>
                                    </div>
                                </li>
                            )})}
                        </ul>
                    ) : (
                        <div className="p-6 text-center text-on-surface-variant text-sm">No items found.</div>
                    )}
                </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          {selectedDepartments.length === 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Department:</span>
              <div className="w-[200px]">
                  <CustomMultiSelect
                      options={state?.departments?.map(dept => ({ label: dept.label, value: dept.value })) || []}
                      selectedValues={localDepartments}
                      onChange={(vals) => {
                          setLocalDepartments(vals);
                          setSelectedItemIds([]);
                          setActiveItemIds([]);
                      }}
                      placeholder="Select Depts"
                  />
              </div>
            </div>
          )}
          <div className="flex gap-3 items-center">
          <button 
              onClick={handleGetLedger} 
              className="flex items-center gap-2 px-6 py-3 bg-tertiary-container text-on-tertiary-container rounded-xl font-bold shadow-sm hover:shadow hover:bg-tertiary-container/80 transition-all border border-tertiary/20"
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>analytics</span>
            <span>Get Ledger</span>
          </button>
          
          <div className="relative export-dropdown">
              <button onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)} className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest rounded-xl font-bold text-on-surface hover:bg-surface-container-high transition-colors shadow-sm hover:shadow">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>ios_share</span>
                <span>Export Options</span>
              </button>
              {isExportDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
                      <button onClick={() => { handleExport(); setIsExportDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors font-semibold text-sm rounded-t-xl">Export CSV</button>
                      <button onClick={() => { handlePrint(); setIsExportDropdownOpen(false); }} disabled={hasPermission ? !hasPermission('inventory', 'ledger', 'print') : false} className={`w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors font-semibold text-sm ${(hasPermission && !hasPermission('inventory', 'ledger', 'print')) ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : ''}`}>Export PDF (via Print)</button>
                      <button onClick={() => { handlePrint(); setIsExportDropdownOpen(false); }} disabled={hasPermission ? !hasPermission('inventory', 'ledger', 'print') : false} className={`w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors font-semibold text-sm rounded-b-xl ${(hasPermission && !hasPermission('inventory', 'ledger', 'print')) ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : ''}`}>Export PNG (via Print)</button>
                  </div>
              )}
          </div>

          <button onClick={handlePrint} disabled={hasPermission ? !hasPermission('inventory', 'ledger', 'print') : false} className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-primary to-primary-container rounded-xl font-bold text-white shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all ${(hasPermission && !hasPermission('inventory', 'ledger', 'print')) ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : ''}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>print</span>
            <span>Print Ledger</span>
          </button>
        </div>
        </div>
      </section>

      {/* ===== FG Stock Report Bar ===== */}
      <section className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm mb-8">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          {/* Report mode */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Report</label>
            <div className="flex items-center p-1 bg-surface-container-low border border-outline-variant/20 rounded-xl">
              <button
                type="button"
                onClick={() => setReportMode('stock')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportMode === 'stock' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Stock Report
              </button>
              <button
                type="button"
                onClick={() => setReportMode('transactions')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportMode === 'transactions' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Transactions Report
              </button>
            </div>
          </div>

          {/* Grades / Types — applies to the WHOLE report */}
          <div className="space-y-1.5 relative" ref={gradeDropdownRef}>
            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Grades / Types</label>
            <div
                className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-medium py-2.5 px-4 cursor-pointer min-w-[200px]"
                onClick={() => setIsGradeDropdownOpen(!isGradeDropdownOpen)}
            >
                <span className="material-symbols-outlined text-outline-variant text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>category</span>
                <span className="flex-1 text-on-surface text-sm font-medium">{allGradesSelected ? 'All Grades' : `${effectiveGrades.length} Selected`}</span>
                <span className="material-symbols-outlined text-sm text-outline-variant" style={{ fontVariationSettings: "'FILL' 0" }}>expand_more</span>
            </div>

            {isGradeDropdownOpen && (
                <div className="absolute z-50 top-full mt-2 w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-lg p-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {discoveredGrades.map(name => (
                        <label key={name} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low rounded-lg cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant/30"
                                checked={allGradesSelected || effectiveGrades.includes(name)}
                                onChange={() => handleToggleGrade(name)}
                            />
                            <span className="text-sm font-medium text-on-surface">{name}</span>
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase">{typeUnit(name, state?.batchOutputTypes || [])}</span>
                        </label>
                    ))}
                    {discoveredGrades.length === 0 && (
                         <div className="px-3 py-2 text-sm text-on-surface-variant text-center">No types available</div>
                    )}
                </div>
            )}
          </div>

          {/* Grouping */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Grouping</label>
            <select
                value={grouping}
                onChange={(e) => setGrouping(e.target.value)}
                className="bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-medium py-2.5 px-4 focus:ring-2 focus:ring-primary outline-none cursor-pointer"
            >
                <option value="item">Item-wise</option>
                <option value="paper">Paper-wise</option>
                <option value="packing">Packing-wise</option>
            </select>
          </div>

          {/* Stock Value — permission gated */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Stock Value</label>
            <div className="flex items-center gap-2.5 py-1">
              <button
                type="button"
                disabled={!canViewValue}
                onClick={() => setShowValue(v => !v)}
                title={canViewValue ? 'Show or hide stock value (quantity × rate)' : 'Requires the “View Stock Value” permission (User Control → Inventory)'}
                className={`relative w-11 h-6 rounded-full transition-colors ${!canViewValue ? 'bg-surface-container-highest opacity-50 cursor-not-allowed' : valueOn ? 'bg-primary cursor-pointer' : 'bg-surface-container-highest cursor-pointer'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${valueOn && canViewValue ? 'left-[22px]' : 'left-0.5'}`}></span>
              </button>
              <span className="text-sm font-medium text-on-surface">{valueOn ? 'Value shown' : 'Value hidden'}</span>
              {!canViewValue && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant">
                  <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 0" }}>lock</span>
                  Needs “View Stock Value” permission
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {reportMode === 'stock' && (
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container">
                Current Stock — date range applies to Transactions
              </span>
            )}
            <button
                onClick={openReportStudio}
                disabled={hasPermission ? !hasPermission('inventory', 'ledger', 'print') : false}
                className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-primary to-primary-container rounded-xl font-bold text-white shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all ${(hasPermission && !hasPermission('inventory', 'ledger', 'print')) ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : ''}`}
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>print</span>
              <span>Preview / Export Report</span>
            </button>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl"></div>
          <div className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest mb-4">Total Current Stock</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-primary tracking-tight font-headline">{stats.totalStock.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
            <span className="text-sm font-medium text-on-surface-variant">Units</span>
          </div>
          <div className="mt-4 flex items-center text-xs text-primary font-bold">
            <span className="material-symbols-outlined text-sm mr-1" style={{ fontVariationSettings: "'FILL' 0" }}>analytics</span>
            Across {stats.itemCount} Items
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm">
          <div className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest mb-4">Total Transactions</div>
          <div className="text-3xl font-black text-on-surface tracking-tight font-headline">{stats.txCount}</div>
          <div className="mt-4 text-xs text-on-surface-variant font-medium">In selected date range</div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm">
          <div className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest mb-4">Total Inward</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-secondary tracking-tight font-headline">{stats.inward.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
          </div>
          <div className="mt-4 text-xs text-secondary font-bold flex items-center">
            <span className="material-symbols-outlined text-sm mr-1" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_downward</span>
            Stock Received
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm">
          <div className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest mb-4">Total Outward</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-error tracking-tight font-headline">{stats.outward.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
          </div>
          <div className="mt-4 text-xs text-error font-bold flex items-center">
            <span className="material-symbols-outlined text-sm mr-1" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_upward</span>
            Stock Consumed/Sold
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="bg-surface-container-lowest p-6 rounded-2xl flex flex-wrap items-center justify-between gap-6 mb-8 border border-outline-variant/10 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          {/* Advanced Date Range */}
          <div className="space-y-1.5 p-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Date Range</label>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>calendar_today</span>
                    <input 
                        type="date" 
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-medium py-2 pl-9 pr-3 focus:ring-2 focus:ring-primary outline-none transition-all appearance-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full" 
                    />
                </div>
                <span className="text-outline-variant font-bold">to</span>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>calendar_today</span>
                    <input 
                        type="date" 
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-medium py-2 pl-9 pr-3 focus:ring-2 focus:ring-primary outline-none transition-all appearance-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full" 
                    />
                </div>
            </div>
          </div>
          
          {/* Transaction Type Multi-select */}
          <div className="space-y-1.5 p-2 relative" ref={typeDropdownRef}>
            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Transaction Types</label>
            <div 
                className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-medium py-2 px-4 cursor-pointer min-w-[200px]"
                onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
            >
                <span className="flex-1">{selectedTypes.length >= TX_TYPES.length ? 'All Transactions' : `${selectedTypes.length} Selected`}</span>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>expand_more</span>
            </div>
            
            {isTypeDropdownOpen && (
                <div className="absolute z-50 top-full mt-2 w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-lg p-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {TX_TYPES.map(type => (
                        <label key={type} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low rounded-lg cursor-pointer transition-colors">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant/30"
                                checked={selectedTypes.includes(type)}
                                onChange={() => handleToggleType(type)}
                            />
                            <span className="text-sm font-medium text-on-surface">{type}</span>
                        </label>
                    ))}
                </div>
            )}
          </div>
        </div>

        <button onClick={resetFilters} className="text-primary font-bold text-sm flex items-center gap-1 hover:bg-primary/10 px-4 py-2 rounded-lg transition-colors">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>filter_list_off</span>
          Reset Filters
        </button>
      </section>

      {reportMode === 'stock' ? (
        <div>
          {effectiveDepartments.length === 0 ? (
              <div className="bg-surface-container-lowest p-12 rounded-2xl flex flex-col items-center justify-center border border-outline-variant/10 shadow-sm text-center">
                  <span className="material-symbols-outlined text-6xl text-outline-variant/50 mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                  <h3 className="text-xl font-bold text-on-surface mb-2">Select a Department</h3>
                  <p className="text-on-surface-variant max-w-md">Choose at least one department above to see its current stock report.</p>
              </div>
          ) : stockRows.length === 0 ? (
              <div className="bg-surface-container-lowest p-12 rounded-2xl flex flex-col items-center justify-center border border-outline-variant/10 shadow-sm text-center">
                  <span className="material-symbols-outlined text-6xl text-outline-variant/50 mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                  <h3 className="text-xl font-bold text-on-surface mb-2">No Items in Scope</h3>
                  <p className="text-on-surface-variant max-w-md">No items are mapped to the selected department(s).</p>
              </div>
          ) : (
            <>
              {stockGroups.map(g => {
                  const gSub = sumStockRows(g.rows);
                  return (
                  <section key={g.key} className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10 mb-8">
                      {g.label && (
                          <div className="bg-surface-container-low px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/10">
                              <h3 className="text-base font-black text-on-surface flex items-center gap-2">
                                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{grouping === 'paper' ? 'layers' : 'package_2'}</span>
                                  {grouping === 'paper' ? 'Paper' : 'Packing'}: {g.label}
                              </h3>
                              <span className="text-xs font-bold text-on-surface-variant">{g.rows.length} items • {fmt(gSub.totalMeters)} m total</span>
                          </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                          <thead className="bg-surface-container-low/50 text-on-surface-variant border-b border-outline-variant/10">
                            <tr>
                              <th className="px-6 py-3 text-[11px] font-black uppercase tracking-widest">Item Name</th>
                              <th className="px-6 py-3 text-[11px] font-black uppercase tracking-widest">Item Code</th>
                              <th className="px-6 py-3 text-[11px] font-black uppercase tracking-widest">Packing Size</th>
                              {stockGradeColumns.map(c => (
                                  <th key={c.name} className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-right">{c.name} ({c.unit === 'Kgs' ? 'kg' : 'm'})</th>
                              ))}
                              <th className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-right">Total Meters</th>
                              <th className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-right">Rolls</th>
                              {valueOn && <th className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-right">Value ({currencyCode})</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/10">
                            {g.rows.map(r => (
                              <tr key={r.itemId} className="hover:bg-surface-container-low/50 transition-colors">
                                <td className="px-6 py-3.5 text-sm font-bold text-on-surface">{r.name}</td>
                                <td className="px-6 py-3.5 text-sm font-mono text-on-surface-variant">{r.sku}</td>
                                <td className="px-6 py-3.5 text-sm text-on-surface-variant">{r.packingSize ? `${r.packingSize} m` : '—'}</td>
                                {stockGradeColumns.map(c => (
                                  <td key={c.name} className="px-6 py-3.5 text-right text-sm font-semibold text-on-surface">
                                      {r.typeQtys[c.name] === null || r.typeQtys[c.name] === undefined ? '—' : fmt(r.typeQtys[c.name])}
                                  </td>
                                ))}
                                <td className="px-6 py-3.5 text-right text-sm font-black text-primary">{fmt(r.totalMeters)}</td>
                                <td className="px-6 py-3.5 text-right text-sm font-semibold text-on-surface">{r.rolls === null ? '—' : fmt(r.rolls)}</td>
                                {valueOn && <td className="px-6 py-3.5 text-right text-sm font-semibold text-on-surface">{fmtMoney(r.value)}</td>}
                              </tr>
                            ))}
                            {g.label && (
                              <tr className="bg-primary/5">
                                <td className="px-6 py-3.5 text-sm font-black text-on-surface" colSpan={3}>Subtotal — {g.label}</td>
                                {stockGradeColumns.map(c => (
                                  <td key={c.name} className="px-6 py-3.5 text-right text-sm font-bold text-on-surface">{gSub.typeTotals[c.name] === undefined ? '—' : fmt(gSub.typeTotals[c.name])}</td>
                                ))}
                                <td className="px-6 py-3.5 text-right text-sm font-black text-primary">{fmt(gSub.totalMeters)}</td>
                                <td className="px-6 py-3.5 text-right text-sm font-bold text-on-surface">{gSub.rolls === null ? '—' : fmt(gSub.rolls)}</td>
                                {valueOn && <td className="px-6 py-3.5 text-right text-sm font-bold text-on-surface">{gSub.value === null ? '—' : fmtMoney(gSub.value)}</td>}
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                  </section>
                  );
              })}

              {/* Grand Total */}
              <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-primary/25 mb-4 px-6 py-5">
                  <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
                      <span className="text-sm font-black uppercase tracking-widest text-on-surface">Grand Total</span>
                      {stockGradeColumns.map(c => (
                          <span key={c.name} className="text-sm font-semibold text-on-surface-variant">{c.name}: <strong className="text-on-surface">{stockGrand.typeTotals[c.name] === undefined ? '—' : fmt(stockGrand.typeTotals[c.name])}</strong></span>
                      ))}
                      <span className="text-sm font-semibold text-on-surface-variant">Meters: <strong className="text-primary text-base">{fmt(stockGrand.totalMeters)}</strong></span>
                      <span className="text-sm font-semibold text-on-surface-variant">Rolls: <strong className="text-on-surface">{stockGrand.rolls === null ? '—' : fmt(stockGrand.rolls)}</strong></span>
                      {valueOn && <span className="text-sm font-semibold text-on-surface-variant">Value: <strong className="text-on-surface">{stockGrand.value === null ? '—' : `${currencyCode} ${fmtMoney(stockGrand.value)}`}</strong></span>}
                  </div>
              </section>

              {(splitUnavailableCount > 0 || (valueOn && missingRateCount > 0)) && (
                  <div className="text-xs text-on-surface-variant space-y-1 mb-8 px-2">
                      {splitUnavailableCount > 0 && <p>* {splitUnavailableCount} item(s) also hold stock in departments outside this scope — the grade split is not stored per department, so their grade columns show '—'; totals are the exact department figures.</p>}
                      {valueOn && missingRateCount > 0 && <p>* {missingRateCount} item(s) without a rate — value incomplete.</p>}
                  </div>
              )}
            </>
          )}
        </div>
      ) : (
      <>
      {/* Grouped Ledger Sections */}
      {activeItemIds.length === 0 ? (
          <div className="bg-surface-container-lowest p-12 rounded-2xl flex flex-col items-center justify-center border border-outline-variant/10 shadow-sm text-center">
              <span className="material-symbols-outlined text-6xl text-outline-variant/50 mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
              <h3 className="text-xl font-bold text-on-surface mb-2">No Item Selected</h3>
              <p className="text-on-surface-variant max-w-md">Please search and select one or more items from the dropdown above to view their detailed ledger transactions.</p>
          </div>
      ) : Object.values(groupedEntries).length > 0 ? Object.values(groupedEntries).map(group => (
          <section key={group.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10 mb-8">
            {/* Item Header */}
            <div className="bg-surface-container-low px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/10">
                <div>
                    <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                        {group.item.name}
                        {group.outputType !== '-' && <span className="ml-2 text-xs px-2 py-1 bg-primary text-on-primary rounded-full font-bold">{group.outputType}</span>}
                    </h3>
                    <p className="text-xs font-mono text-on-surface-variant mt-1">{group.item.sku} • {group.entries.length} Transactions</p>
                </div>
                <div className="flex gap-6">
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Total Inward</p>
                        <p className="text-sm font-bold text-success">+{group.inward.toLocaleString(undefined, {maximumFractionDigits:2})}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Total Outward</p>
                        <p className="text-sm font-bold text-error">-{group.outward.toLocaleString(undefined, {maximumFractionDigits:2})}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Final Balance</p>
                        <p className="text-sm font-bold text-primary">{(group.entries[group.entries.length - 1]?.balance || 0).toLocaleString(undefined, {maximumFractionDigits:2})}</p>
                    </div>
                </div>
            </div>

            {/* Item Ledger Table */}
            <div className="overflow-x-auto min-h-[100px]">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-surface-container-low/50 text-on-surface-variant border-b border-outline-variant/10">
                  <tr>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest">Date / Time</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest">Type</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest">Ref #</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest">Output Type</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-right">Qty In</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-right">Qty Out</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-right">Balance</ResizableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {(() => {
                      const page = currentPages[group.item.id] || 1;
                      const displayedEntries = state?.isGlobalPaginated
                          ? group.entries.slice((page - 1) * itemsPerPage, page * itemsPerPage)
                          : group.entries;
                      
                      return displayedEntries.map((e, index) => {
                          const d = new Date(e.timestamp);
                          return (
                              <tr key={`${e.id}-${index}`} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-6 py-4">
                              {e.timestamp === 0 ? (
                                <div className="text-sm font-bold text-on-surface">Opening Balance</div>
                              ) : (
                                <>
                                  <div className="text-sm font-bold text-on-surface">{d.toLocaleDateString()}</div>
                                  <div className="text-[10px] font-bold text-on-surface-variant uppercase">{d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase
                                  ${e.type === 'Sale' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 
                                    e.type === 'Production' ? 'bg-surface-container-highest text-on-surface-variant' : 
                                    e.type === 'Adjustment' ? 'bg-error-container text-error' : 
                                    e.type === 'Initial' ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary-container text-on-primary-container'}
                              `}>
                                  {e.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-mono text-primary font-semibold">{e.ref}</td>
                            <td className="px-6 py-4 text-sm font-medium text-on-surface-variant">{e.outputType || '—'}</td>
                            <td className="px-6 py-4 text-right font-bold text-success text-sm">{e.qtyIn ? `+${e.qtyIn.toLocaleString(undefined, {maximumFractionDigits:2})}` : '—'}</td>
                            <td className="px-6 py-4 text-right font-bold text-error text-sm">{e.qtyOut ? `-${e.qtyOut.toLocaleString(undefined, {maximumFractionDigits:2})}` : '—'}</td>
                            <td className="px-6 py-4 text-right font-bold text-on-surface text-sm">{e.balance.toLocaleString(undefined, {maximumFractionDigits:2})}</td>
                          </tr>
                      );
                  });
                  })()}
                </tbody>
              </table>
            </div>
            
            <GlobalPagination 
                totalItems={group.entries.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPages[group.id] || 1}
                setCurrentPage={(page) => setCurrentPages(prev => ({...prev, [group.id]: page}))}
            />
          </section>
      )) : (
          <div className="bg-surface-container-lowest p-12 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-outline-variant" style={{ fontVariationSettings: "'FILL' 0" }}>receipt_long</span>
            </div>
            <h3 className="text-lg font-black text-on-surface mb-2 tracking-tight">No ledger entries found</h3>
            <p className="text-sm font-medium text-on-surface-variant max-w-sm">Adjust your filters or ensure the selected item has logged transactions.</p>
          </div>
      )}
      </>
      )}
    </div>

    <StockReportStudio isOpen={studioOpen} onClose={() => setStudioOpen(false)} model={reportModel} />

    {/* PRINT ONLY UI */}
    <div className="hidden print:block w-full">
        {Object.values(groupedEntries).length > 0 && Object.values(groupedEntries).map((group, groupIdx) => (
            <div key={`print-${group.id}`} className="mb-10 page-break-after-always" style={{ pageBreakAfter: groupIdx === Object.values(groupedEntries).length - 1 ? 'auto' : 'always' }}>
                <PrintLayout 
                    documentTitle="Inventory Ledger"
                    documentId={`ITEM-${group.item.sku || group.item.id}`}
                    date={new Date().toLocaleDateString()}
                    disclaimerKey="production"
                    extraMeta={[
                        { label: 'Item Name', value: `${group.item.name} ${group.outputType !== '-' ? `(${group.outputType})` : ''}` },
                        { label: 'Total Inward', value: group.inward.toLocaleString(undefined, {maximumFractionDigits:2}) },
                        { label: 'Total Outward', value: group.outward.toLocaleString(undefined, {maximumFractionDigits:2}) },
                        { label: 'Final Balance', value: (group.entries[group.entries.length - 1]?.balance || 0).toLocaleString(undefined, {maximumFractionDigits:2}) }
                    ]}
                >
                    <div className="border border-gray-300 mt-4">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300">Date/Time</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300">Type</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300">Ref #</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300">Output Type</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300 text-right">Qty In</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300 text-right">Qty Out</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300 text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.entries.map((e, index) => {
                                    const d = new Date(e.timestamp);
                                    return (
                                        <tr key={`p-${e.id}-${index}`}>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300">
                                                {e.timestamp === 0 ? 'Opening Balance' : d.toLocaleString()}
                                            </td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300 font-bold">{e.type}</td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300">{e.ref}</td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300">{e.outputType || '—'}</td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300 text-right">{e.qtyIn || '—'}</td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300 text-right">{e.qtyOut || '—'}</td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300 text-right font-bold">{e.balance.toLocaleString(undefined, {maximumFractionDigits:2})}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </PrintLayout>
            </div>
        ))}
    </div>
    </>
  );
}
