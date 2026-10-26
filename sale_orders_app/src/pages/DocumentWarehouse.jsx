import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import { loadOnboardingHistory } from '../utils/onboardingHistory';
import UniversalPrintStudioModal from '../components/ui/UniversalPrintStudioModal';
import BinderFormModal from '../components/warehouse/BinderFormModal';
import SlipDocumentPopup from '../components/warehouse/SlipDocumentPopup';
import { isSlipFamilyDocType, resolveFiledDocumentView, getFiledDocumentViewSource, resolveBinderColor, resolveBinderFrameToken } from '../utils/studioSnapshot';
import { searchFiledDocuments } from '../utils/filedDocSearch';
import { SYSTEM_DOCUMENTS } from '../utils/printSchemaRegistry';

export default function DocumentWarehouse({ insideDashboard = false }) {
  const { state, setState, hasPermission } = useApp();
  // Permissions redesign (2026-10-27): Files cabinet action gates.
  const canCreateBinder = hasPermission ? hasPermission('files', 'cabinet', 'createBinder') : true;
  const canEditBinder = hasPermission ? hasPermission('files', 'cabinet', 'editBinder') : true;
  const canDeleteBinder = hasPermission ? hasPermission('files', 'cabinet', 'deleteBinder') : true;

  // Stage states: 'browsing' | 'grabbing' | 'opened'
  const [stage, setStage] = useState('browsing');
  const [activeFolder, setActiveFolder] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [highlightedField, setHighlightedField] = useState('');
  
  // Shelf-specific search filter state
  const [shelfSearchQuery, setShelfSearchQuery] = useState('');
  const [allCabinetBinders, setAllCabinetBinders] = useState([]);
  
  // Hover and customization states
  const [grabbingBinderId, setGrabbingBinderId] = useState(null);
  const cabinetRef = useRef(null);
  const [hoveredBinderId, setHoveredBinderId] = useState(null);
  const [isCustomizeMode, setIsCustomizeMode] = useState(false);

  // Modal display states (the Add/Edit forms themselves live in the shared
  // BinderFormModal — the Routing Center's Create File prompt uses it too)
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBinder, setEditingBinder] = useState(null);

  // Filed-document print viewers: the studio modal for graphic documents,
  // the slip popup for the 12 PrintLayout (slip-family) documents.
  const [studioAttachment, setStudioAttachment] = useState(null);
  const [slipAttachment, setSlipAttachment] = useState(null);

  // Per-user spine colours (this user's overrides from user_settings)
  const binderColors = state?.binderColors || {};

  // Adapters linking system data arrays into dynamic shelves layout
  useEffect(() => {
    // 1. Finance Documents
    const salesList = state?.saleOrders || [];
    const financeDocs = salesList.length > 0 ? salesList.map(so => ({
      id: so.id || `SO-${so.orderId}`,
      title: so.customerName || 'Walk-in Customer',
      date: so.date || 'Today',
      details: [
        { label: 'Invoice Reference', value: so.id || `SO-${so.orderId}` },
        { label: 'Customer Entity', value: so.customerName || 'N/A' },
        { label: 'Grand Total Value', value: `$${so.total || 0}` },
        { label: 'Dispatched Status', value: so.status || 'Pending' }
      ]
    })) : [
      { id: 'SO-FN-201', title: 'Al-Haq Textile Corp', date: '2026-05-20', details: [{ label: 'Invoice Reference', value: 'SO-FN-201' }, { label: 'Customer Entity', value: 'Al-Haq Textile Corp' }, { label: 'Grand Total Value', value: '$8,240.00' }, { label: 'Dispatched Status', value: 'Dispatched' }] }
    ];

    // 2. HR Profiles
    const onboardingList = loadOnboardingHistory();
    const hrDocs = onboardingList.length > 0 ? onboardingList.map(emp => ({
      id: emp.id || `EMP-${emp.employeeCode || '101'}`,
      title: emp.employeeName || 'Staff Member',
      date: emp.joiningDate || 'Active',
      details: [
        { label: 'Employee ID', value: emp.id || `EMP-${emp.employeeCode || '101'}` },
        { label: 'Full Name', value: emp.employeeName || 'N/A' },
        { label: 'Job Designation', value: emp.designation || 'Specialist' },
        { label: 'Date of Joining', value: emp.joiningDate || '2026-05-15' },
        { label: 'Profile Status', value: emp.status || 'Active' }
      ]
    })) : [
      { id: 'EMP-HR-99', title: 'Kamil Khan', date: '2026-05-01', details: [{ label: 'Employee ID', value: 'EMP-HR-99' }, { label: 'Full Name', value: 'Kamil Khan' }, { label: 'Job Designation', value: 'Operations Manager' }, { label: 'Date of Joining', value: '2026-05-01' }, { label: 'Profile Status', value: 'Active' }] }
    ];

    // 3. Routing Rules
    const routingRaw = localStorage.getItem('hr_routing_rules_config');
    let routingList = [];
    if (routingRaw) {
      try { routingList = JSON.parse(routingRaw); } catch(e){}
    }
    const routingDocs = routingList.length > 0 ? routingList.map(rule => ({
      id: rule.id,
      title: rule.name,
      date: rule.lastExecuted || 'Never',
      details: [
        { label: 'Rule Serial', value: rule.id },
        { label: 'Workflow Title', value: rule.name },
        { label: 'Trigger Document', value: rule.trigger },
        { label: 'DMS Targets', value: rule.folders?.join(', ') || 'N/A' },
        { label: 'Status Active', value: rule.status || 'Active' }
      ]
    })) : [
      { id: 'RUL-DMS-12', title: 'Onboarding Router', date: 'Yesterday', details: [{ label: 'Rule Serial', value: 'RUL-DMS-12' }, { label: 'Workflow Title', value: 'Onboarding Router' }, { label: 'Trigger Document', value: 'Onboarding' }, { label: 'DMS Targets', value: 'HR Records' }, { label: 'Status Active', value: 'Active' }] }
    ];

    // 4. Item Master
    const itemsList = state?.items || [];
    const itemDocs = itemsList.length > 0 ? itemsList.map(item => ({
      id: item.sku || item.id,
      title: item.name,
      date: item.status || 'Active',
      details: [
        { label: 'SKU Identifier', value: item.sku || item.id },
        { label: 'Material Name', value: item.name },
        { label: 'Inventory Group', value: item.category || 'Goods' },
        { label: 'Available Capacity', value: `${item.stock || 0} ${item.unit || 'Units'}` },
        { label: 'Active Status', value: item.status || 'Active' }
      ]
    })) : [
      { id: 'RM-SKU-99', title: 'Premium Silk Spool', date: 'Active', details: [{ label: 'SKU Identifier', value: 'RM-SKU-99' }, { label: 'Material Name', value: 'Premium Silk Spool' }, { label: 'Inventory Group', value: 'Raw Materials' }, { label: 'Available Capacity', value: '1,420 Meters' }, { label: 'Active Status', value: 'Active' }] }
    ];

    // Build default folders database (each mapped dynamically and colored corporate blue by default)
    const folderTemplates = [
      // Shelf 1 (Finance)
      { name: 'FINANCIAL REPORTS', icon: 'receipt_long', documents: financeDocs },
      { name: 'SALES_INVOICES', icon: 'receipt_long', documents: financeDocs },
      { name: 'VENDOR_LEDGERS', icon: 'receipt_long', documents: financeDocs },
      { name: '2023_BUDGET_REPORTS', icon: 'receipt_long', documents: financeDocs },
      { name: 'QUARTERLY_TAXES', icon: 'receipt_long', documents: financeDocs },
      { name: 'PAYMENT_RECEIPTS', icon: 'receipt_long', documents: financeDocs },
      { name: 'ASSETS_AUDIT', icon: 'receipt_long', documents: financeDocs },
      { name: 'CAPITAL_CREDITS', icon: 'receipt_long', documents: financeDocs },
      { name: 'SALARY_SLIPS', icon: 'receipt_long', documents: financeDocs },
      { name: 'BUDGET_LOGS', icon: 'receipt_long', documents: financeDocs },
      { name: 'TAX_ARCHIVE', icon: 'receipt_long', documents: financeDocs },
      { name: 'LEDGER_SUMMARY', icon: 'receipt_long', documents: financeDocs },
      
      // Shelf 2 (HR & DMS Rules)
      { name: 'HR_ONBOARDING_PROFILES', icon: 'assignment_ind', documents: hrDocs },
      { name: 'EMPLOYEE_ROSTER', icon: 'assignment_ind', documents: hrDocs },
      { name: 'INTERN_REGISTRIES', icon: 'assignment_ind', documents: hrDocs },
      { name: 'OFFICIAL_RECORDS', icon: 'assignment_ind', documents: hrDocs },
      { name: 'DOC_ROUTING_CONFIG', icon: 'account_tree', documents: routingDocs },
      { name: 'FLOWS_AUTOMATION', icon: 'account_tree', documents: routingDocs },
      { name: 'ECABIN_SYNCS', icon: 'account_tree', documents: routingDocs },
      { name: 'ROUTING_STATS', icon: 'account_tree', documents: routingDocs },
      { name: 'APPROVALS_FLOW', icon: 'account_tree', documents: routingDocs },
      { name: 'DMS_GATEWAYS', icon: 'account_tree', documents: routingDocs },
      { name: 'HR_BACKUPS', icon: 'assignment_ind', documents: hrDocs },
      { name: 'DMS_SYNC_LOG', icon: 'account_tree', documents: routingDocs },

      // Shelf 3 & Spillover (Operations & Stocks)
      { name: 'PRODUCTION_BOM_RECORDS', icon: 'category', documents: itemDocs },
      { name: 'INVENTORY_GOODS', icon: 'category', documents: itemDocs },
      { name: 'STOCK_LEVEL_LOGS', icon: 'category', documents: itemDocs },
      { name: 'BOM_CALCULATIONS', icon: 'category', documents: itemDocs },
      { name: 'SHIPPING_RECORDS', icon: 'category', documents: itemDocs },
      { name: 'DISPATCH_INVOICES', icon: 'category', documents: itemDocs },
      { name: 'SUPPLIERS_LOG', icon: 'category', documents: itemDocs },
      { name: 'OMS_COMPLIANCES', icon: 'category', documents: itemDocs },
      { name: 'ITEM_CATEGORIES', icon: 'category', documents: itemDocs },
      { name: 'WAREHOUSE_INDEX', icon: 'category', documents: itemDocs },
      { name: 'FACTORY_ROUTING', icon: 'category', documents: itemDocs },
      { name: 'SHIPMENT_LABELS', icon: 'category', documents: itemDocs }
    ];

    // Binders come from state — the document_warehouse_binders table is
    // their source of truth. An EMPTY array is a valid, stable state (the
    // cabinet is simply empty) and must never trigger a re-seed: the demo
    // seed below fires ONLY when binders were never initialized at all
    // (null/undefined). (Files Cabinet cleanup, 2026-10-25 — the old
    // "seed whenever the list is empty" branch resurrected all 36 demo
    // binders after every cleanup.)
    const savedBinders = state.documentWarehouseBinders;

    if (savedBinders === null || savedBinders === undefined) {
      const seededBinders = folderTemplates.map((item, idx) => ({
        id: `BND-${idx}-${item.name}`,
        name: item.name,
        icon: item.icon,
        documents: item.documents,
        colorClass: 'binder-blue-spine'
      }));
      setAllCabinetBinders(seededBinders);
      if (state.currentUser?.username) {
        setState(prev => ({
          ...prev,
          documentWarehouseBinders: seededBinders
        }));
      }
      return;
    }

    // A binder always displays its OWN stored documents — including the
    // ones the routing archive step files into it. The generated
    // financeDocs / hrDocs / routingDocs / itemDocs lists above feed ONLY
    // the first-run seed; they never replace a binder's real documents.
    setAllCabinetBinders(savedBinders);
  }, [state]);

  const saveBindersToStorage = (updatedList) => {
    setAllCabinetBinders(updatedList);
    if (state.currentUser?.username) {
      setState(prev => ({
        ...prev,
        documentWarehouseBinders: updatedList
      }));
    }
  };

  const formatBinderName = (raw) => (raw || '').trim().toUpperCase().replace(/\s+/g, '_');

  // Shared BinderFormModal submit contract: return an error string to keep
  // the form open, or null on success (the form closes itself).
  const handleAddBinder = ({ name, colorClass }) => {
    const formattedName = formatBinderName(name);
    if (!formattedName) return 'Please enter a file name.';

    // Check if name already exists
    if (allCabinetBinders.some(b => b.name === formattedName)) {
      return 'A folder with this name already exists!';
    }

    // A new file starts EMPTY — documents arrive only when the routing
    // archive step files real documents into it (the old synthetic
    // "Inaugural Registry Record" placeholder is gone).
    const newBinder = {
      id: `BND-CUSTOM-${Date.now()}`,
      name: formattedName,
      icon: 'receipt_long',
      documents: [],
      colorClass
    };

    saveBindersToStorage([...allCabinetBinders, newBinder]);
    return null;
  };

  const handleEditBinder = ({ name, colorClass }) => {
    if (!editingBinder) return 'No file selected.';
    const formattedName = formatBinderName(name);
    if (!formattedName) return 'Please enter a file name.';

    // Check if name is already taken by another binder
    if (allCabinetBinders.some(b => b.name === formattedName && b.id !== editingBinder.id)) {
      return 'Another folder already has this name!';
    }

    // The NAME is a shared record field and renames for everyone. The
    // COLOUR is per-user: it writes only the current user's override
    // (user_settings `binderColors`) — the binder record itself keeps the
    // creator's colour as the default everyone else sees.
    const updated = allCabinetBinders.map(b => {
      if (b.id === editingBinder.id) {
        return { ...b, name: formattedName };
      }
      return b;
    });

    saveBindersToStorage(updated);
    setState(prev => ({
      ...prev,
      binderColors: { ...(prev.binderColors || {}), [editingBinder.id]: colorClass }
    }));
    setEditingBinder(null);
    return null;
  };

  // Deletion is confirmed IN-APP by the shared BinderFormModal (its
  // confirmation panel calls this handler). The old flow gated the delete
  // behind a native browser confirm dialog here — in the live environment
  // that dialog never resolves true, so the Delete button did nothing at
  // all: no confirmation, no error, the binder survived (parent's live
  // check, 2026-10-25). By the time this handler runs, the user has
  // already confirmed inside the modal.
  const handleDeleteBinder = () => {
    if (!canDeleteBinder) return; // permissions redesign: Delete Binder off for this user
    if (!editingBinder) return;
    const updated = allCabinetBinders.filter(b => b.id !== editingBinder.id);
    saveBindersToStorage(updated);
    setShowEditModal(false);
    setEditingBinder(null);
  };

  // Open the print view for the currently displayed filed document: the
  // studio modal for graphic documents, the slip popup for slip-family
  // documents. FRESHNESS (Omer, 2026-10-25): resolution is LIVE-FIRST —
  // while the source record still exists, its CURRENT (edited) content is
  // what renders; the frozen filing snapshot is only the fallback for a
  // source record that no longer exists. `viewSource` rides along so the
  // viewer can state plainly which version is being shown. The stored
  // snapshot is never mutated by viewing.
  const handleOpenPrintView = () => {
    const doc = activeFolder?.documents?.[currentPage];
    if (!doc || !doc.docType) return;
    const view = resolveFiledDocumentView(state, doc);
    const attachment = { ...doc, studioRecord: view.studioRecord, viewSource: view.source };
    if (isSlipFamilyDocType(doc.docType)) {
      setSlipAttachment(attachment);
    } else if (view.studioRecord) {
      setStudioAttachment(attachment);
    } else {
      // Never let the studio fall back to a sample record for a filed
      // document — with neither a live record nor a snapshot, a graphic
      // document stays details-only.
      alert('This filed document has no printable copy — its source record is gone and no snapshot was stored at filing time, so it can only be viewed as registry details.');
    }
  };

  // Helper to get glowing tooltip color class matching binder spine color
  const getTooltipClass = (colorClass) => {
    if (colorClass === 'binder-green-spine') return 'glowing-tooltip-green';
    if (colorClass === 'binder-red-spine') return 'glowing-tooltip-red';
    if (colorClass === 'binder-purple-spine') return 'glowing-tooltip-purple';
    if (colorClass === 'binder-amber-spine') return 'glowing-tooltip-amber';
    if (colorClass === 'binder-teal-spine') return 'glowing-tooltip-teal';
    return 'glowing-tooltip-blue';
  };

  // Pulling file trigger
  const handleBinderClick = (binder) => {
    if (stage !== 'browsing') return;

    if (isCustomizeMode) {
      if (!canEditBinder) return; // permissions redesign: Edit Binder off for this user
      setEditingBinder(binder);
      setShowEditModal(true);
      return;
    }

    setGrabbingBinderId(binder.id);
    setStage('grabbing');

    // Smooth pull out delay, then 3D Book view mounts. An empty binder
    // opens on its (empty) first page — the book view shows the clean
    // "no documents yet" state.
    const docCount = Array.isArray(binder.documents) ? binder.documents.length : 0;
    setTimeout(() => {
      setActiveFolder(binder);
      setCurrentPage(docCount > 0 ? docCount - 1 : 0); // Latest doc page on top
      setSearchQuery('');
      setSearchFocused(false);
      setHighlightedField('');
      setStage('opened');
      setGrabbingBinderId(null);
    }, 650);
  };

  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage(prev => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < activeFolder.documents.length - 1) setCurrentPage(prev => prev + 1);
  };

  // In-file search (Files viewer polish, 2026-10-25): scoped to the OPEN
  // file only, matching each document's code/reference (docId), title and
  // date (plus its registry details). Results render as a dropdown under
  // the search bar; picking one — or pressing Enter for the first match —
  // jumps straight to that document's page. No match is a clean inline
  // state in the dropdown, never an alert.
  const searchMatches = (searchQuery.trim() && activeFolder)
    ? searchFiledDocuments(activeFolder.documents || [], searchQuery).slice(0, 8)
    : [];
  const searchNoMatch = !!searchQuery.trim() && !!activeFolder && searchMatches.length === 0;

  const jumpToDocument = (idx) => {
    if (!activeFolder) return;
    setCurrentPage(idx);
    setSearchFocused(false);
    const matchedDoc = activeFolder.documents[idx];
    const q = searchQuery.toLowerCase();
    const matchedField = (matchedDoc?.details || []).find(d =>
      d.value.toString().toLowerCase().includes(q) ||
      d.label.toLowerCase().includes(q)
    );
    if (matchedField) {
      setHighlightedField(matchedField.label);
      setTimeout(() => setHighlightedField(''), 2000);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchMatches.length > 0) jumpToDocument(searchMatches[0].index);
  };

  // Filter binders based on header search bar input
  const filteredBinders = allCabinetBinders.filter(binder => 
    binder.name.toLowerCase().includes(shelfSearchQuery.toLowerCase())
  );

  // Group binders into chunks of exactly maximum 15 per shelf row
  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };
  const chunkedShelves = chunkArray(filteredBinders, 15);

  // The document currently on display in the opened book (filed order is
  // the stored array order; paging moves through it one document at a time)
  const activeDoc = activeFolder && Array.isArray(activeFolder.documents)
    ? (activeFolder.documents[currentPage] || null)
    : null;
  const activeDocTypeName = activeDoc?.docType
    ? (SYSTEM_DOCUMENTS.find(d => d.id === activeDoc.docType)?.name || activeDoc.docType)
    : null;

  // Freshness marker for the displayed document: 'live' when its source
  // record still exists (the print view will show the current version),
  // 'snapshot' when only the filed copy remains, null when neither does.
  const activeViewSource = activeDoc?.docType ? getFiledDocumentViewSource(state, activeDoc) : null;

  // Open-file interior colour: the viewing user's resolved colour for
  // this binder (per-user override ?? the binder's own colour) — the same
  // resolution the spine uses, mapped to frame tokens.
  const activeFrameToken = resolveBinderFrameToken(binderColors, activeFolder);

  const content = (
    <div className="w-full h-full flex-grow flex flex-col gap-0 relative overflow-hidden transition-all animate-fadeIn">
        
        <style>{`
          .wood-cabinet-outer {
            background-color: #231c18;
            border: 14px solid #dfb589;
            box-shadow: inset 0 0 50px rgba(0,0,0,0.85), 0 25px 50px rgba(0,0,0,0.4);
          }
          .wood-shelf-plank {
            background: linear-gradient(to bottom, #d29e6f, #9b693c);
            box-shadow: 0 8px 16px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.3);
          }
          .cyan-glowing-tooltip {
            background: rgba(224, 242, 254, 0.9);
            backdrop-filter: blur(25px);
            border: 2.5px solid #22d3ee;
            box-shadow: 0 0 30px rgba(34, 211, 238, 0.65), 0 10px 20px rgba(0,0,0,0.2);
            color: #0f172a;
          }
          .cabinet-backdrop-row {
            background: #15110e;
            box-shadow: inset 0 16px 32px rgba(0,0,0,0.75);
          }
          .ring-cutout {
            border: 1px solid rgba(255,255,255,0.35);
            background-color: #080706;
            box-shadow: inset 0 3px 6px rgba(0,0,0,0.95), 0 1px 1px rgba(255,255,255,0.15);
          }
          .cyan-finger-glow {
            color: rgba(165, 243, 252, 0.95);
            filter: drop-shadow(0 0 12px rgba(34, 211, 238, 0.9)) drop-shadow(0 0 3px rgba(255, 255, 255, 0.6));
          }
          .binders-grid-shelf {
            display: grid !important;
            grid-template-columns: repeat(15, minmax(0, 1fr)) !important;
            width: 100% !important;
            align-items: end !important;
            justify-items: center !important;
            height: 100% !important;
            gap: 0px !important;
          }
          .binder-realistic-spine {
            width: 100% !important;
            height: 205px !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          @media (min-width: 640px) {
            .binder-realistic-spine {
              height: 255px !important;
            }
          }
          .binder-blue-spine {
            background: linear-gradient(180deg, #3b82f6 0%, #2563eb 30%, #1d4ed8 70%, #1e3a8a 100%) !important;
            border-left: 4px solid #60a5fa !important;
            border-top: 2px solid rgba(255, 255, 255, 0.45) !important;
            border-right: 2px solid rgba(0, 0, 0, 0.45) !important;
            border-bottom: 1.5px solid rgba(0, 0, 0, 0.6) !important;
            box-shadow: inset 2.5px 0 3px rgba(255, 255, 255, 0.3), inset -2.5px 0 4px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.45) !important;
            border-radius: 8px !important;
          }
          .binder-green-spine {
            background: linear-gradient(180deg, #10b981 0%, #059669 30%, #047857 70%, #064e3b 100%) !important;
            border-left: 4px solid #34d399 !important;
            border-top: 2px solid rgba(255, 255, 255, 0.45) !important;
            border-right: 2px solid rgba(0, 0, 0, 0.45) !important;
            border-bottom: 1.5px solid rgba(0, 0, 0, 0.6) !important;
            box-shadow: inset 2.5px 0 3px rgba(255, 255, 255, 0.3), inset -2.5px 0 4px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.45) !important;
            border-radius: 8px !important;
          }
          .binder-red-spine {
            background: linear-gradient(180deg, #ef4444 0%, #dc2626 30%, #b91c1c 70%, #7f1d1d 100%) !important;
            border-left: 4px solid #f87171 !important;
            border-top: 2px solid rgba(255, 255, 255, 0.45) !important;
            border-right: 2px solid rgba(0, 0, 0, 0.45) !important;
            border-bottom: 1.5px solid rgba(0, 0, 0, 0.6) !important;
            box-shadow: inset 2.5px 0 3px rgba(255, 255, 255, 0.3), inset -2.5px 0 4px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.45) !important;
            border-radius: 8px !important;
          }
          .binder-purple-spine {
            background: linear-gradient(180deg, #8b5cf6 0%, #7c3aed 30%, #6d28d9 70%, #4c1d95 100%) !important;
            border-left: 4px solid #a78bfa !important;
            border-top: 2px solid rgba(255, 255, 255, 0.45) !important;
            border-right: 2px solid rgba(0, 0, 0, 0.45) !important;
            border-bottom: 1.5px solid rgba(0, 0, 0, 0.6) !important;
            box-shadow: inset 2.5px 0 3px rgba(255, 255, 255, 0.3), inset -2.5px 0 4px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.45) !important;
            border-radius: 8px !important;
          }
          .binder-amber-spine {
            background: linear-gradient(180deg, #f59e0b 0%, #d97706 30%, #b45309 70%, #78350f 100%) !important;
            border-left: 4px solid #fbbf24 !important;
            border-top: 2px solid rgba(255, 255, 255, 0.45) !important;
            border-right: 2px solid rgba(0, 0, 0, 0.45) !important;
            border-bottom: 1.5px solid rgba(0, 0, 0, 0.6) !important;
            box-shadow: inset 2.5px 0 3px rgba(255, 255, 255, 0.3), inset -2.5px 0 4px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.45) !important;
            border-radius: 8px !important;
          }
          .binder-teal-spine {
            background: linear-gradient(180deg, #06b6d4 0%, #0891b2 30%, #0e7490 70%, #155e75 100%) !important;
            border-left: 4px solid #22d3ee !important;
            border-top: 2px solid rgba(255, 255, 255, 0.45) !important;
            border-right: 2px solid rgba(0, 0, 0, 0.45) !important;
            border-bottom: 1.5px solid rgba(0, 0, 0, 0.6) !important;
            box-shadow: inset 2.5px 0 3px rgba(255, 255, 255, 0.3), inset -2.5px 0 4px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.45) !important;
            border-radius: 8px !important;
          }
          .binder-label-tag {
            background-color: #ffffff !important;
            border: 1px solid rgba(0, 0, 0, 0.25) !important;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2) !important;
            border-radius: 4px !important;
            width: 62% !important;
            max-width: 26px !important;
            height: 52% !important;
          }
          @media (min-width: 640px) {
            .binder-label-tag {
              height: 56% !important;
            }
          }
          .label-vertical-text {
            writing-mode: vertical-rl !important;
            text-orientation: mixed !important;
            font-family: 'Manrope', sans-serif !important;
            font-size: 7.5px !important;
            font-weight: 900 !important;
            letter-spacing: 0.06em !important;
            color: #0f172a !important;
            text-align: center !important;
            white-space: nowrap !important;
            display: inline-block !important;
          }
          @media (min-width: 640px) {
            .label-vertical-text {
              font-size: 9px !important;
            }
          }
          /* Custom scrollbar for wood cabinet vertical scrolling */
          .cabinet-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .cabinet-scrollbar::-webkit-scrollbar-track {
            background: #171310;
            border-radius: 8px;
          }
          .cabinet-scrollbar::-webkit-scrollbar-thumb {
            background: #dfb589;
            border-radius: 8px;
            border: 2px solid #171310;
          }
          /* Premium glowing tooltips dynamically colored based on binder spine */
          .glowing-tooltip-blue {
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(16px);
            border: 2px solid #3b82f6;
            box-shadow: 0 0 25px rgba(59, 130, 246, 0.65), 0 8px 16px rgba(0,0,0,0.35);
            color: #f0f9ff;
          }
          .glowing-tooltip-green {
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(16px);
            border: 2px solid #10b981;
            box-shadow: 0 0 25px rgba(16, 185, 129, 0.65), 0 8px 16px rgba(0,0,0,0.35);
            color: #ecfdf5;
          }
          .glowing-tooltip-red {
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(16px);
            border: 2px solid #ef4444;
            box-shadow: 0 0 25px rgba(239, 68, 68, 0.65), 0 8px 16px rgba(0,0,0,0.35);
            color: #fff5f5;
          }
          .glowing-tooltip-purple {
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(16px);
            border: 2px solid #8b5cf6;
            box-shadow: 0 0 25px rgba(139, 92, 246, 0.65), 0 8px 16px rgba(0,0,0,0.35);
            color: #faf5ff;
          }
          .glowing-tooltip-amber {
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(16px);
            border: 2px solid #f59e0b;
            box-shadow: 0 0 25px rgba(245, 158, 11, 0.65), 0 8px 16px rgba(0,0,0,0.35);
            color: #fffbeb;
          }
          .glowing-tooltip-teal {
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(16px);
            border: 2px solid #06b6d4;
            box-shadow: 0 0 25px rgba(6, 182, 212, 0.65), 0 8px 16px rgba(0,0,0,0.35);
            color: #f0fdfa;
          }
        `}</style>

        {/* Compact Page Top Header Row */}
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-container-lowest border-b border-outline-variant/20 py-4 px-8 shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">shelves</span>
            <h1 className="text-lg font-black font-headline text-on-surface leading-none">Document Warehouse</h1>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
            {stage !== 'opened' && (
              <div className="flex items-center gap-2">
                {/* Add new binder file button */}
                <button
                  onClick={() => setShowAddModal(true)}
                  disabled={!canCreateBinder}
                  className={`px-3.5 py-1.5 bg-primary hover:bg-primary/95 text-white font-headline font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${!canCreateBinder ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <span className="material-symbols-outlined text-xs">add_box</span>
                  Add File
                </button>

                {/* Customize folders button */}
                <button 
                  onClick={() => setIsCustomizeMode(!isCustomizeMode)}
                  className={`px-3.5 py-1.5 border font-headline font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                    isCustomizeMode 
                      ? 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-800' 
                      : 'bg-slate-100 hover:bg-slate-200 border-outline-variant/30 text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">tune</span>
                  {isCustomizeMode ? 'Finish' : 'Customize'}
                </button>
              </div>
            )}

            {/* Shelf file search bar input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input 
                type="text" 
                value={shelfSearchQuery}
                onChange={(e) => setShelfSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-outline-variant/20 focus:border-primary focus:bg-white focus:outline-none rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 shadow-inner"
                placeholder="Search binders catalog..."
              />
            </div>

            {stage === 'opened' && (
              <button 
                onClick={() => setStage('browsing')}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 border border-outline-variant/30 text-slate-700 font-headline font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">arrow_back</span>
                Back
              </button>
            )}
          </div>
        </header>

        {/* Active Content Body Canvas - STRETCHES FULL HEIGHT */}
        <div className="flex-grow w-full flex items-center justify-center relative overflow-hidden">

          {stage === 'browsing' || stage === 'grabbing' ? (
            /* ================= VERTICALLY SCROLLABLE 2-SHELVES WOOD CABINET ================= */
            <div
              ref={cabinetRef}
              className="relative w-full h-full min-h-[600px] wood-cabinet-outer rounded-none border-x-0 border-b-0 p-4 flex flex-col gap-6 select-none z-10 overflow-y-auto cabinet-scrollbar"
            >

              {/* Chunked Cabinet Shelves row mapping - EXACTLY 2 SHELVES VISIBLE ON LOAD */}
              {chunkedShelves.length > 0 ? (
                chunkedShelves.map((shelf, shelfIdx) => (
                  <div key={shelfIdx} className="shelf-row-container relative w-full flex flex-col justify-end h-[340px] sm:h-[370px] shrink-0">
                    
                    {/* Shelf background shadow backing */}
                    <div className="absolute inset-x-0 bottom-2 top-0 cabinet-backdrop-row rounded-lg z-0" />
                    
                    {/* Wood Plank shelf backing - BRINGS TO FRONT OF FOLDERS FOR LIP EFFECT */}
                    <div className="absolute bottom-0 left-0 right-0 h-5 wood-shelf-plank rounded-md border-t border-amber-500/20 z-30" />

                    {/* Metallic Bracket Left & Right - BRINGS TO FRONT */}
                    <div className="absolute left-[-2px] bottom-0 w-2.5 h-10 bg-slate-600/40 rounded-t z-30" />
                    <div className="absolute right-[-2px] bottom-0 w-2.5 h-10 bg-slate-600/40 rounded-t z-30" />

                    {/* Horizontal 15-column grid lineup of dynamic folder binders - BLUE BY DEFAULT, LARGE & UNIFORM */}
                    <div className="binders-grid-shelf z-20 pb-1.5 h-full px-4 sm:px-6 binders-container overflow-visible">
                      {shelf.map((binder) => {
                        const isHovered = hoveredBinderId === binder.id;
                        
                        // Spine colour: this user's per-user override wins;
                        // otherwise the binder's own (creator's) colour.
                        const spineStyle = resolveBinderColor(binderColors, binder);

                        // Check if this binder is pulling out (displaced downwards slightly exactly like reference screenshot!)
                        const isPulledOut = grabbingBinderId === binder.id;

                        return (
                          <div 
                            key={binder.id}
                            onClick={() => handleBinderClick(binder)}
                            onMouseEnter={() => setHoveredBinderId(binder.id)}
                            onMouseLeave={() => setHoveredBinderId(null)}
                            className={`binder-realistic-spine ${spineStyle} cursor-pointer relative flex flex-col items-center justify-between py-3 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-6 hover:shadow-[0_15px_30px_rgba(0,0,0,0.55)] hover:z-20 ${
                              isPulledOut 
                                ? 'translate-y-8 z-30 shadow-[0_18px_35px_rgba(0,0,0,0.85)]' 
                                : isHovered
                                ? '-translate-y-6 shadow-[0_15px_30px_rgba(0,0,0,0.55)] z-20'
                                : ''
                            } ${isCustomizeMode ? 'ring-2 ring-dashed ring-amber-400 animate-pulse' : ''}`}
                          >
                            {/* Edit Overlay Badge in Customize mode */}
                            {isCustomizeMode && (
                              <div className="absolute -top-2.5 -left-2.5 bg-amber-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md animate-bounce z-40">
                                <span className="material-symbols-outlined text-[11px] font-bold">edit</span>
                              </div>
                            )}

                            {/* Left spine shadow overlay */}
                            <div className="absolute inset-y-0 left-0 w-0.5 bg-black/35 rounded-l" />

                            {/* White vertical text label metadata tag - 100% VISIBLE SOLID CSS WHITE */}
                            <div className="binder-label-tag flex items-center justify-center overflow-hidden shrink-0 mt-1 shadow-sm">
                              <span className="label-vertical-text">
                                {binder.name}
                              </span>
                            </div>

                            {/* Metallic Circular ring handle bottom third - SCALED UP */}
                            <div className="w-5.5 h-5.5 rounded-full ring-cutout flex items-center justify-center shrink-0 mb-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-slate-950 shadow-inner" />
                            </div>

                            {/* Binders pages count flag */}
                            <div className="absolute -top-1.5 right-1.5 bg-white border border-slate-300 text-slate-900 rounded font-mono text-[8px] font-black px-1 shadow-sm leading-none shrink-0 z-20">
                              {binder.documents.length}
                            </div>

                            {/* Glowing Tooltip POPUP above the hovered file */}
                            {isHovered && (
                              <div className={`absolute -top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl text-center z-50 animate-fadeIn pointer-events-none border ${getTooltipClass(spineStyle)}`}>
                                <div className="text-xs font-headline font-black uppercase tracking-wider whitespace-nowrap flex items-center justify-center gap-1.5">
                                  <span className="material-symbols-outlined text-[13px]">folder</span>
                                  <span>{binder.name}</span>
                                </div>
                                <div className="text-[9px] font-bold opacity-90 mt-1 whitespace-nowrap flex items-center justify-center gap-1">
                                  {isCustomizeMode ? (
                                    <>
                                      <span className="material-symbols-outlined text-[10px] text-amber-400">edit</span>
                                      <span>Click to Customize</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="material-symbols-outlined text-[10px] text-cyan-400">description</span>
                                      <span>{binder.documents.length} Sheets</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                ))
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <span className="material-symbols-outlined text-4xl">folder_off</span>
                  {allCabinetBinders.length === 0 ? (
                    <>
                      <p className="text-sm font-bold">The cabinet is empty — no files yet.</p>
                      <p className="text-xs font-medium">Use the Add File button above to create your first file; documents land here when a routing workflow archives them.</p>
                    </>
                  ) : (
                    <p className="text-sm font-bold">No binders match your search filter.</p>
                  )}
                </div>
              )}

            </div>
          ) : (
            /* ================= FULLSCREEN 3D BOOK reader OPEN VIEW ================= */
            <div className="w-full max-w-4xl animate-slideUp z-10 pt-3">
              {/* OPEN FILE FRAME — the inside of the opened binder: the book
                  sits inside a frame tinted with the viewing user's resolved
                  colour for this file, with the file's name on a tab on the
                  frame's top edge. Screen presentation only — print output
                  is unchanged. */}
              <div
                className="relative rounded-[30px] p-3 sm:p-4 shadow-[0_30px_60px_rgba(0,0,0,0.35)] ring-1 ring-black/25 flex flex-col gap-4 h-[560px]"
                style={{ background: `linear-gradient(155deg, ${activeFrameToken.mid} 0%, ${activeFrameToken.deep} 80%)` }}
              >
                {/* File name tab on the frame's top edge */}
                <div className="absolute -top-3 left-8 flex items-center gap-1.5 bg-white rounded-md pl-2.5 pr-3 py-1 shadow-md border border-black/10 z-30 max-w-[70%]">
                  <span className="material-symbols-outlined text-[13px]" style={{ color: activeFrameToken.deep }}>{activeFolder.icon || 'folder_open'}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider truncate" style={{ color: activeFrameToken.deep }}>{activeFolder.name}</span>
                </div>

              {/* Reader Subbar search & controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-outline-variant/30 rounded-2xl px-6 py-3 shadow-sm shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Folder</span>
                  <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-sm bg-slate-50`}>
                    <span className="material-symbols-outlined text-base text-primary">{activeFolder.icon || 'folder_open'}</span>
                    {activeFolder.name}
                  </div>
                </div>

                {/* In-file search — scoped to THIS file; matches code /
                    title / date, results drop down, a pick jumps straight
                    to that document's page */}
                <div
                  className="relative w-full sm:w-80"
                  onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setSearchFocused(false); }}
                >
                  <form onSubmit={handleSearchSubmit} className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setSearchFocused(true); }}
                      onFocus={() => setSearchFocused(true)}
                      className="w-full bg-slate-50 border border-outline-variant/20 focus:border-primary focus:bg-white focus:outline-none rounded-xl pl-9 pr-14 py-2.5 text-xs text-slate-700 placeholder:text-slate-400 shadow-inner"
                      placeholder="Search this file by code, title or date..."
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-11 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
                        title="Clear search"
                      >
                        <span className="material-symbols-outlined text-[13px]">close</span>
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className="absolute right-2 top-2 px-3 py-1 rounded bg-primary hover:bg-primary/10 text-primary font-bold text-[9px] transition-colors"
                    >
                      Scan
                    </button>
                  </form>

                  {searchFocused && searchQuery.trim() && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 overflow-hidden animate-fadeIn">
                      {searchNoMatch ? (
                        <div className="px-4 py-3.5 flex items-center gap-2.5 text-slate-500">
                          <span className="material-symbols-outlined text-base text-slate-300">search_off</span>
                          <span className="text-xs font-bold">No documents match &ldquo;{searchQuery.trim()}&rdquo; in this file.</span>
                        </div>
                      ) : (
                        searchMatches.map(({ index, doc }) => (
                          <button
                            key={`${doc.docId || doc.id || 'doc'}-${index}`}
                            type="button"
                            onClick={() => jumpToDocument(index)}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-3 border-b border-slate-100 last:border-0 transition-colors cursor-pointer"
                          >
                            <span className="min-w-0">
                              <span className="block text-xs font-bold text-slate-700 truncate">{doc.title}</span>
                              <span className="block text-[10px] font-medium text-slate-400 mt-0.5">
                                {doc.filedAt ? `Filed ${new Date(doc.filedAt).toLocaleDateString('en-GB')}` : (doc.date || '')}
                              </span>
                            </span>
                            <span className="font-mono text-[9px] font-bold text-slate-400 shrink-0">{doc.docId || doc.id}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3D Spread Book Interface */}
              <div className="flex-grow min-h-0 flex gap-2 relative">
                
                {/* Left Page (Folder Indexes catalog) — paper tinted with
                    the file's colour, like the inside cover showing through */}
                <div
                  className="flex-1 text-slate-900 rounded-l-[28px] border-r border-slate-200 shadow-[-15px_15px_30px_rgba(0,0,0,0.15)] flex flex-col p-8 overflow-y-auto"
                  style={{ background: `linear-gradient(to right, ${activeFrameToken.pale} 0%, #ffffff 88%)` }}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-6 shrink-0">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Document Roster Index</span>
                    <span className="text-xs font-bold text-slate-500 uppercase">{activeFolder.documents.length} entries archived</span>
                  </div>

                  {/* Documents Roster list */}
                  <div className="flex-grow space-y-1.5 max-h-[260px] overflow-y-auto pr-1.5 custom-scrollbar">
                    {activeFolder.documents.length === 0 && (
                      <div className="px-4 py-6 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60">
                        <span className="material-symbols-outlined text-2xl text-slate-300">folder_open</span>
                        <p className="text-xs font-bold text-slate-500 mt-1.5">No documents filed in this file yet.</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1 leading-relaxed">Documents appear here when a routing workflow archives them into this file.</p>
                      </div>
                    )}
                    {activeFolder.documents.map((doc, idx) => {
                      const isActive = idx === currentPage;
                      return (
                        <button
                          key={doc.id}
                          onClick={() => setCurrentPage(idx)}
                          style={isActive ? { backgroundColor: activeFrameToken.soft, borderColor: activeFrameToken.mid, color: activeFrameToken.deep } : undefined}
                          className={`w-full text-left px-4 py-3 rounded-xl transition-all border flex items-center justify-between ${
                            isActive
                              ? 'font-black shadow-sm'
                              : 'bg-slate-50/50 hover:bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${isActive ? 'animate-pulse' : 'bg-slate-400'}`}
                              style={isActive ? { backgroundColor: activeFrameToken.mid } : undefined}
                            />
                            <span className="truncate text-xs">{doc.title}</span>
                          </div>
                          <span className="font-mono text-[9px] font-bold text-slate-400 shrink-0">{doc.id}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] font-mono text-slate-400 shrink-0">
                    <span>{activeFolder.documents.length > 0 ? `Document ${currentPage + 1} of ${activeFolder.documents.length}` : 'No documents'}</span>
                    <span className="font-bold uppercase tracking-wider">DocWarehouse v1.2</span>
                  </div>
                </div>

                {/* Opened Spine divider — bound in the file's own colour */}
                <div
                  className="w-2.5 shadow-md z-20 shrink-0 relative"
                  style={{ background: `linear-gradient(to right, ${activeFrameToken.deep}, ${activeFrameToken.mid}, ${activeFrameToken.deep})` }}
                />

                {/* Right Page (Active Document Presentation Sheets with 3D flips) */}
                <div 
                  className="flex-1 bg-gradient-to-l from-slate-50 to-white text-slate-900 rounded-r-[28px] shadow-[15px_15px_30px_rgba(0,0,0,0.15)] flex flex-col p-8 overflow-y-auto relative"
                  style={{
                    willChange: 'transform',
                    animation: 'logbookFlip 0.4s ease-out'
                  }}
                  key={currentPage} // triggers CSS flip animation on change
                >
                  <style>{`
                    @keyframes logbookFlip {
                      0% {
                        transform: perspective(1000px) rotateY(-15deg) skewY(-2.5deg);
                        opacity: 0.82;
                      }
                      100% {
                        transform: perspective(1000px) rotateY(0deg) skewY(0deg);
                        opacity: 1;
                      }
                    }
                  `}</style>

                  {!activeDoc ? (
                    /* Empty binder — clean "no documents yet" page */
                    <div className="flex-grow flex flex-col items-center justify-center text-center gap-2 py-10">
                      <span className="material-symbols-outlined text-5xl text-slate-200">draft</span>
                      <p className="text-sm font-black text-slate-600">No documents yet</p>
                      <p className="text-xs font-medium text-slate-400 max-w-[250px] leading-relaxed">
                        This file is empty. When a routing workflow archives a document into it, the document appears here — printable in its current print design.
                      </p>
                    </div>
                  ) : (
                  <>
                  {/* Header sheet details */}
                  <div className="flex justify-between items-start pb-4 border-b border-slate-200/60 mb-6 shrink-0">
                    <div>
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Sheet Name</h4>
                      <p className="text-sm font-extrabold text-slate-800 mt-0.5">{activeDoc.title}</p>
                      {activeDoc.docType && (
                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                          {activeDocTypeName}
                          {activeDoc.filedAt ? ` · Filed ${new Date(activeDoc.filedAt).toLocaleDateString('en-GB')}` : ''}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono font-black text-slate-500 uppercase bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 shrink-0">
                      {activeDoc.id}
                    </span>
                  </div>

                  {/* Print view — content resolved live-first (the current
                      version of the source document while it exists, else
                      the filed copy), design per current Print Settings.
                      The studio (or slip popup) carries Print / Save PDF /
                      Save Image with it. The marker below states plainly
                      which version will be shown. */}
                  {activeDoc.docType && (
                    <div className="mb-6 shrink-0">
                      <button
                        onClick={handleOpenPrintView}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">print</span>
                        Open Print View
                        <span className="normal-case tracking-normal font-bold text-white/60 text-[10px]">— design as per current Print Settings</span>
                      </button>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold leading-snug">
                        {activeViewSource === 'live' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-emerald-700">Live version — this print reflects the latest edits to the source document.</span>
                          </>
                        ) : activeViewSource === 'snapshot' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span className="text-amber-700">Filed copy — the source document no longer exists; showing the copy as filed{activeDoc.filedAt ? ` on ${new Date(activeDoc.filedAt).toLocaleDateString('en-GB')}` : ''}.</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                            <span className="text-slate-400">No printable copy is available for this document.</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata field maps */}
                  <div className="flex-grow flex flex-col gap-4">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registry Data Parameters</h5>

                    <div className="grid grid-cols-1 gap-2.5">
                      {(activeDoc.details || []).map((field) => {
                        const isQueryHighlighted = highlightedField === field.label;
                        return (
                          <div 
                            key={field.label} 
                            className={`p-3 rounded-xl border transition-all ${
                              isQueryHighlighted 
                                ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-200 animate-pulse' 
                                : 'bg-slate-50/50 border-slate-200/50 hover:bg-slate-100/50'
                            }`}
                          >
                            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</span>
                            <span className="block text-xs font-black text-slate-800 mt-0.5 font-mono">{field.value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sheet Navigation controls */}
                  <div className="absolute right-6 bottom-6 flex items-center gap-2 z-20 shrink-0">
                    <button
                      onClick={handlePrevPage}
                      disabled={currentPage === 0}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center shadow-sm cursor-pointer border border-slate-200"
                      title="Previous Page"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">chevron_left</span>
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === activeFolder.documents.length - 1}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center shadow-sm cursor-pointer border border-slate-200"
                      title="Next Page"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">chevron_right</span>
                    </button>
                  </div>
                  </>
                  )}
                </div>

              </div>
              </div>
            </div>
          )}

        </div>

        {/* ADD / EDIT FILE — the shared BinderFormModal (the Routing
            Center's Create File prompt renders the same form) */}
        <BinderFormModal
          isOpen={showAddModal}
          mode="create"
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddBinder}
        />
        <BinderFormModal
          isOpen={showEditModal && !!editingBinder}
          mode="edit"
          initialName={editingBinder?.name || ''}
          initialColor={editingBinder ? resolveBinderColor(binderColors, editingBinder) : 'binder-blue-spine'}
          onClose={() => { setShowEditModal(false); setEditingBinder(null); }}
          onSubmit={handleEditBinder}
          onDelete={handleDeleteBinder}
        />

        {/* FILED DOCUMENT PRINT VIEWERS — content resolves live-first
            (the source document's current version while it exists, else
            the frozen filing snapshot); the design is the CURRENT Print
            Settings layout */}
        <UniversalPrintStudioModal
          isOpen={!!studioAttachment}
          onClose={() => setStudioAttachment(null)}
          documentType={studioAttachment?.docType || 'sale_order'}
          documentData={studioAttachment?.studioRecord || null}
          documentTitle={studioAttachment?.title || null}
        />
        <SlipDocumentPopup
          isOpen={!!slipAttachment}
          onClose={() => setSlipAttachment(null)}
          attachment={slipAttachment}
        />

      </div>
  );

  if (insideDashboard) {
    return content;
  }

  return (
    <Layout>
      {content}
    </Layout>
  );
}
