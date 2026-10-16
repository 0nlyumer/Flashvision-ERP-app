import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import ResizableHeader from '../ui/ResizableHeader';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../../utils/financeEngine';
import { useLocation } from 'react-router-dom';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function Vouchers() {
  const { state, setCollection } = useApp();
  const { appConfirm, appAlert } = useDialog();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';
  const currencySymbol = state.adminSetup?.baseCurrency ? (state.adminSetup.baseCurrency.match(/\(([^)]+)\)/)?.[1] || '$') : '$';

  // Active view: 'create' or 'history'
  const [viewMode, setViewMode] = useState('create');

  // Dynamic accounts list combining Chart of Accounts, Customers, and Suppliers from real ERP state
  const coaAccounts = (state.chartOfAccounts && state.chartOfAccounts.length > 0)
    ? state.chartOfAccounts
    : DEFAULT_CHART_OF_ACCOUNTS;

  const customerAccounts = (state.customers || []).map(c => ({
    id: `CUST-${c.id || c.customerId || c.name}`,
    name: `${c.name || c.customerName} (Customer / Debtor)`,
    category: 'Debtors'
  }));

  const supplierAccounts = (state.suppliers || []).map(s => ({
    id: `SUPP-${s.id || s.supplierId || s.name}`,
    name: `${s.name || s.supplierName} (Supplier / Creditor)`,
    category: 'Creditors'
  }));

  const activeAccountsList = [...coaAccounts, ...customerAccounts, ...supplierAccounts];

  // Pure real vouchers from ERP state with ZERO dummy fallback entries
  const vouchers = state.vouchers || [];

  // ==================== VOUCHER CREATION STATE ====================
  const [voucherType, setVoucherType] = useState(''); // '' | 'JV' | 'CPV' | 'CRV'
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().substring(0, 10));
  const [reference, setReference] = useState('');
  const [overallNarration, setOverallNarration] = useState('');

  // Initial line template
  const initialLine = { accountId: '', narration: '', debit: 0, credit: 0 };
  const [lines, setLines] = useState([{ ...initialLine }, { ...initialLine }]);
  const [voucherPhotos, setVoucherPhotos] = useState([]);
  const [voucherVideos, setVoucherVideos] = useState([]);
  const [voucherDocs, setVoucherDocs] = useState([]);
  const [sourcePasses, setSourcePasses] = useState([]);
  const [activePreview, setActivePreview] = useState(null); // { type: 'photo' | 'video' | 'doc', url: string }

  // Suggest Voucher ID dynamically
  const suggestVoucherId = (type) => {
    if (!type) return '';
    const year = new Date().getFullYear();
    const typeVouchers = vouchers.filter(v => v.type === type);
    const count = typeVouchers.length + 1;
    const formattedCount = String(count).padStart(4, '0');
    return `${type}-${year}-${formattedCount}`;
  };

  const [voucherId, setVoucherId] = useState('');
  const [defaultCashAccount, setDefaultCashAccount] = useState('');

  const location = useLocation();

  useEffect(() => {
    if (location.state && location.state.sourceGatePasses) {
      const passes = location.state.sourceGatePasses;
      setViewMode('create');
      
      const prepopulatedLines = passes.map(gp => ({
        accountId: '',
        narration: `${gp.id}: ${gp.description}`,
        debit: 0,
        credit: 0,
        amount: 0
      }));
      
      setLines(prepopulatedLines);
      setReference(passes.map(gp => gp.id).join(', '));
      setOverallNarration(`Generated from Gate Passes: ${passes.map(gp => gp.id).join(', ')}`);
      
      const photos = [];
      const videos = [];
      const docs = [];
      passes.forEach(gp => {
        if (gp.photos) photos.push(...gp.photos);
        if (gp.videos) videos.push(...gp.videos);
        if (gp.documents) docs.push(...gp.documents);
      });
      setVoucherPhotos(photos);
      setVoucherVideos(videos);
      setVoucherDocs(docs);
      setSourcePasses(passes);
      
      // Clear navigation state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Update voucher ID when type or vouchers list changes
  useEffect(() => {
    setVoucherId(suggestVoucherId(voucherType));
  }, [voucherType, vouchers]);

  // Clear defaultCashAccount ONLY when voucherType changes
  useEffect(() => {
    setDefaultCashAccount('');
  }, [voucherType]);

  // Handle Input Changes on lines
  const handleLineChange = (index, field, value) => {
    const updated = [...lines];
    if (field === 'debit' || field === 'credit') {
      const numVal = parseFloat(value) || 0;
      updated[index][field] = numVal;
      // Mutually exclusive: if debit is positive, credit is 0, and vice versa
      if (field === 'debit' && numVal > 0) updated[index].credit = 0;
      if (field === 'credit' && numVal > 0) updated[index].debit = 0;
    } else if (field === 'amount') {
      const numVal = parseFloat(value) || 0;
      updated[index].amount = numVal;
      if (voucherType === 'CPV') {
        updated[index].debit = numVal;
        updated[index].credit = 0;
      } else if (voucherType === 'CRV') {
        updated[index].credit = numVal;
        updated[index].debit = 0;
      }
    } else {
      updated[index][field] = value;
    }
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { ...initialLine }]);
  };

  const deleteLine = (index) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== index));
  };

  // Calculations
  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);

  // Reset form
  const resetForm = () => {
    setVoucherDate(new Date().toISOString().substring(0, 10));
    setReference('');
    setOverallNarration('');
    setLines([{ ...initialLine }, { ...initialLine }]);
    setVoucherId(suggestVoucherId(voucherType));
    setVoucherPhotos([]);
    setVoucherVideos([]);
    setVoucherDocs([]);
  };

  // Save / Post Handler
  const handleSaveVoucher = async (isPost = false) => {
    // Basic Validations
    if (lines.some(l => !l.accountId)) {
      appAlert("Please select an Account for all voucher lines.");
      return;
    }

    if ((voucherType === 'CPV' || voucherType === 'CRV') && !defaultCashAccount) {
      appAlert("Please select a Default Cash Account for this cash voucher.");
      return;
    }

    const sumDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const sumCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    if (sumDebit === 0 && sumCredit === 0) {
      appAlert("Voucher must have at least one debit or credit amount entry.");
      return;
    }

    // Journal Voucher Debit/Credit Matching check
    if (voucherType === 'JV' && isPost && sumDebit !== sumCredit) {
      appAlert("For Journal Vouchers (JV), Total Debit must equal Total Credit.");
      return;
    }

    const title = isPost ? "Post Voucher" : "Save Draft";
    const status = isPost ? "Posted" : "Draft";
    const confirmMsg = `Are you sure you want to ${isPost ? 'post and authorize' : 'save as draft'} Voucher ${voucherId}?`;

    const proceed = await appConfirm(
      confirmMsg,
      title,
      isPost ? "Confirm Post" : "Save",
      "Cancel"
    );

    if (!proceed) return;

    let finalLines = lines.map(l => {
      const matched = activeAccountsList.find(a => a.id === l.accountId);
      return {
        ...l,
        accountName: matched ? matched.name : 'Unknown Account'
      };
    });

    let finalTotalDebit = sumDebit;
    let finalTotalCredit = sumCredit;

    if (voucherType === 'CPV' || voucherType === 'CRV') {
      const cashAcc = activeAccountsList.find(a => a.id === defaultCashAccount);
      const cashAccName = cashAcc ? cashAcc.name : 'Cash Account';
      
      if (voucherType === 'CPV') {
        const offsetLine = {
          accountId: defaultCashAccount,
          accountName: cashAccName,
          narration: `Offset cash credit for voucher ${voucherId}`,
          debit: 0,
          credit: sumDebit
        };
        finalLines = [...finalLines, offsetLine];
        finalTotalCredit = sumDebit;
      } else {
        const offsetLine = {
          accountId: defaultCashAccount,
          accountName: cashAccName,
          narration: `Offset cash debit for voucher ${voucherId}`,
          debit: sumCredit,
          credit: 0
        };
        finalLines = [...finalLines, offsetLine];
        finalTotalDebit = sumCredit;
      }
    }

    const newVoucher = {
      id: voucherId,
      date: voucherDate,
      type: voucherType,
      reference,
      narration: overallNarration,
      status,
      totalDebit: finalTotalDebit,
      totalCredit: finalTotalCredit,
      lines: finalLines,
      photos: voucherPhotos,
      videos: voucherVideos,
      documents: voucherDocs
    };

    const updatedVouchers = [newVoucher, ...vouchers.filter(v => v.id !== voucherId)];
    setCollection('vouchers', updatedVouchers);

    // Tag linked gate passes in activities feed
    if (sourcePasses && sourcePasses.length > 0) {
      const gpIds = sourcePasses.map(gp => gp.id);
      const currentGPs = state.gatePassActivities || [];
      const updatedGPs = currentGPs.map(gp => {
        if (gpIds.includes(gp.id)) {
          return {
            ...gp,
            linkedVoucherId: voucherId
          };
        }
        return gp;
      });
      setCollection('gatePassActivities', updatedGPs);
    }

    appAlert(`Voucher ${voucherId} has been successfully ${isPost ? 'posted' : 'saved as draft'}.`);
    
    if (isPost) {
      handlePrint(newVoucher);
    }

    resetForm();
    setViewMode('history');
  };

  // ==================== VOUCHER HISTORY STATE ====================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Resizable headers and column visibility settings
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    voucherId: true,
    type: true,
    reference: true,
    amount: true,
    status: true,
    actions: true
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Selected voucher details modal state
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Filters application
  const filteredVouchers = vouchers.filter(v => {
    const matchesSearch = v.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (v.narration && v.narration.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (v.reference && v.reference.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'all' ? true : v.type === filterType;
    const matchesStatus = filterStatus === 'all' ? true : v.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Delete Voucher handler
  const handleDeleteVoucher = async (voucher) => {
    const proceed = await appConfirm(
      `Are you sure you want to delete Voucher: ${voucher.id}? This will reverse any related ledger entries.`,
      "Delete Voucher Confirmation",
      "Delete",
      "Cancel"
    );

    if (proceed) {
      const updated = vouchers.filter(v => v.id !== voucher.id);
      setCollection('vouchers', updated);
      appAlert("Voucher deleted successfully!");
    }
  };

  // Edit Draft Voucher handler
  const handleEditDraft = (voucher) => {
    setVoucherType(voucher.type);
    setVoucherId(voucher.id);
    setVoucherDate(voucher.date);
    setReference(voucher.reference || '');
    setOverallNarration(voucher.narration || '');
    setLines(voucher.lines.map(l => ({
      accountId: l.accountId,
      narration: l.narration || '',
      debit: l.debit || 0,
      credit: l.credit || 0
    })));
    setViewMode('create');
  };

  // Printing studio state & mapping
  const [studioVoucher, setStudioVoucher] = useState(null);

  const voucherPrintData = useMemo(() => {
    if (!studioVoucher) return null;
    return {
      header: {
        voucher_no: studioVoucher.id,
        date: studioVoucher.date,
        voucher_type: studioVoucher.type === 'JV' ? 'Journal Voucher' : studioVoucher.type === 'CPV' ? 'Cash Payment Voucher' : studioVoucher.type === 'CRV' ? 'Cash Receipt Voucher' : (studioVoucher.type || 'Voucher'),
        reference: studioVoucher.reference || 'N/A',
        account_name: studioVoucher.lines?.[0]?.accountName || 'Consolidated Accounts',
        amount: studioVoucher.totalDebit || 0,
        description: studioVoucher.narration || 'General Voucher Entry'
      },
      items: (studioVoucher.lines || []).map((l, index) => ({
        seq: index + 1,
        account_code: l.accountId || '-',
        account_name: l.accountName || l.accountId || 'General Ledger',
        narration: l.narration || '',
        debit: l.debit || 0,
        credit: l.credit || 0
      }))
    };
  }, [studioVoucher]);

  const studioDocType = useMemo(() => {
    if (!studioVoucher) return 'voucher_payment';
    const t = studioVoucher.type;
    if (t === 'CPV' || t === 'BPV' || t === 'payment') return 'voucher_payment';
    if (t === 'CRV' || t === 'BRV' || t === 'receipt') return 'voucher_receipt';
    if (t === 'CV' || t === 'contra') return 'voucher_contra';
    return 'voucher_journal';
  }, [studioVoucher]);

  const handlePrint = (voucher) => {
    setStudioVoucher(voucher);
  };

  return (
    <div className="p-8 max-w-full w-full mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">Voucher System</h2>
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'create' ? 'history' : 'create')}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-[#004277] text-white hover:bg-[#00345e] rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[16px]">
            {viewMode === 'create' ? 'history' : 'add_circle'}
          </span>
          {viewMode === 'create' ? 'View History Log' : 'Create New Voucher'}
        </button>
      </div>

      {viewMode === 'create' ? (
        // ==================== VOUCHER CREATION FORM ====================
        <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl flex flex-col shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Voucher Type Selector Dropdown */}
          <div className="p-6 border-b border-outline-variant/15 bg-surface-container-low/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[20px]">assignment</span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Voucher Type:</span>
              <div className="relative min-w-[280px]">
                <select
                  value={voucherType}
                  onChange={(e) => setVoucherType(e.target.value)}
                  className="w-full appearance-none bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 pr-10 text-xs font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer shadow-sm hover:border-primary/50 transition-colors"
                >
                  <option value="">Select Voucher Type...</option>
                  <option value="JV">General Journal Voucher (JV)</option>
                  <option value="CPV">Cash Payment Voucher (CPV)</option>
                  <option value="CRV">Cash Receive Voucher (CRV)</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none text-[20px]">
                  expand_more
                </span>
              </div>
            </div>
            
            <div className="text-[11px] font-semibold text-primary italic bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10">
              {!voucherType && 'Please select a voucher type to start recording.'}
              {voucherType === 'JV' && 'Adjust transactions between general accounts.'}
              {voucherType === 'CPV' && 'Record and post cash payments.'}
              {voucherType === 'CRV' && 'Record and post cash receipts.'}
            </div>
          </div>

          {!voucherType ? (
            <div className="p-12 text-center flex flex-col items-center justify-center text-on-surface-variant/50 select-none">
              <span className="material-symbols-outlined text-5xl text-primary/30 mb-3">account_balance_wallet</span>
              <p className="font-semibold text-xs text-on-surface-variant">Please select a Voucher Type from the dropdown above to begin.</p>
            </div>
          ) : (
            <>

          {/* Form Fields Header info */}
          <div className="p-6 border-b border-outline-variant/15 grid grid-cols-1 md:grid-cols-4 gap-6 bg-surface-container-low/10">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Voucher Number</label>
              <input
                type="text"
                readOnly
                value={voucherId}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 rounded-xl text-on-surface font-mono font-bold text-sm focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Posting Date</label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-outline-variant/30 rounded-xl text-on-surface text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            
            {(voucherType === 'CPV' || voucherType === 'CRV') ? (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    {voucherType === 'CPV' ? 'Default Cash Credit Account' : 'Default Cash Debit Account'}
                  </label>
                  <div className="relative">
                    <select
                      value={defaultCashAccount}
                      onChange={(e) => setDefaultCashAccount(e.target.value)}
                      className="w-full appearance-none bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                    >
                      <option value="">Select Cash Account...</option>
                      {activeAccountsList.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.id} - {acc.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none text-[20px]">
                      expand_more
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Reference / Memo</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. Memo number..."
                    className="w-full px-4 py-3 bg-surface border border-outline-variant/30 rounded-xl text-on-surface text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Reference / Memo</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Supplier Invoice / Memo number..."
                  className="w-full px-4 py-3 bg-surface border border-outline-variant/30 rounded-xl text-on-surface text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            )}
          </div>

          {/* Grouped Gate Pass Entries cards or standard lines table */}
          {sourcePasses.length > 0 ? (
            /* Render Grouped Gate Pass Entry Cards */
            <div className="p-6 bg-surface-container-low/10 space-y-6 border-b border-outline-variant/15">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 select-none">
                Grouped Gate Pass Ledger Entries ({sourcePasses.length})
              </h3>
              
              {sourcePasses.map((gp, i) => {
                const line = lines[i] || { accountId: '', narration: '', debit: 0, credit: 0, amount: 0 };
                return (
                  <div key={gp.id} className="bg-surface border border-outline-variant/20 rounded-2xl p-5 shadow-sm space-y-4 hover:border-primary/30 transition-all animate-in fade-in">
                    {/* Entry Header */}
                    <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3 select-none">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-base ${gp.type === 'Inward' ? 'text-emerald-600' : 'text-blue-600'}`}>
                          {gp.type === 'Inward' ? 'login' : 'logout'}
                        </span>
                        <span className={`text-xs font-black uppercase tracking-wider ${gp.type === 'Inward' ? 'text-emerald-700' : 'text-blue-700'}`}>
                          {gp.type} Gate Pass: {gp.id}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entry #{i + 1}</span>
                    </div>

                    {/* Specific Proofs (Media) for this specific entry! */}
                    {(gp.photos?.length > 0 || gp.videos?.length > 0 || gp.documents?.length > 0) && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant block">Entry Attachments</label>
                        <div className="flex flex-wrap gap-2.5">
                          {gp.photos?.map((p, pIdx) => (
                            <div 
                              key={pIdx} 
                              onClick={() => setActivePreview({ type: 'photo', url: p })}
                              className="block w-16 h-16 bg-slate-100 rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                            >
                              <img src={p} className="w-full h-full object-cover" alt="Captured Document" />
                            </div>
                          ))}
                          {gp.videos?.map((v, vIdx) => (
                            <div 
                              key={vIdx} 
                              onClick={() => setActivePreview({ type: 'video', url: v })}
                              className="block w-16 h-16 bg-black rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-white text-[20px]">play_circle</span>
                            </div>
                          ))}
                          {gp.documents?.map((d, dIdx) => (
                            <div 
                              key={dIdx} 
                              onClick={() => setActivePreview({ type: 'doc', url: d })}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-outline-variant/15 rounded-xl text-[10px] font-semibold text-slate-655 cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                              <span className="material-symbols-outlined text-primary text-[14px]">description</span>
                              <span className="truncate max-w-[120px]" title={d}>{d}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inputs Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      {/* Description */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase text-on-surface-variant tracking-wider select-none">Narration / Particulars</label>
                        <textarea 
                          value={line.narration} 
                          onChange={(e) => handleLineChange(i, 'narration', e.target.value)}
                          placeholder="Enter narration remarks for this pass..."
                          rows="2"
                          className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none resize-none h-12"
                        />
                      </div>

                      {/* Account selection */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase text-on-surface-variant tracking-wider select-none">
                          {voucherType === 'CPV' ? 'Debit Account' : voucherType === 'CRV' ? 'Credit Account' : 'Account selection'}
                        </label>
                        <div className="relative">
                          <select
                            value={line.accountId}
                            onChange={(e) => handleLineChange(i, 'accountId', e.target.value)}
                            className="w-full appearance-none bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer h-12"
                          >
                            <option value="">Select Account...</option>
                            {activeAccountsList.map(acc => (
                              <option key={acc.id} value={acc.id}>{acc.id} - {acc.name}</option>
                            ))}
                          </select>
                          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">
                            expand_more
                          </span>
                        </div>
                      </div>

                      {/* Amount box */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase text-on-surface-variant tracking-wider select-none">
                          {voucherType === 'JV' ? 'Debit / Credit Amount' : `Amount (${currencyCode})`}
                        </label>
                        {voucherType === 'JV' ? (
                          <div className="flex gap-2">
                            <input 
                              type="number" 
                              value={line.debit === 0 ? '' : line.debit} 
                              onChange={(e) => handleLineChange(i, 'debit', e.target.value)}
                              placeholder="Debit"
                              className="w-1/2 px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none h-12 text-right"
                            />
                            <input 
                              type="number" 
                              value={line.credit === 0 ? '' : line.credit} 
                              onChange={(e) => handleLineChange(i, 'credit', e.target.value)}
                              placeholder="Credit"
                              className="w-1/2 px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none h-12 text-right"
                            />
                          </div>
                        ) : (
                          <input 
                            type="number" 
                            value={line.amount === 0 ? '' : line.amount} 
                            onChange={(e) => handleLineChange(i, 'amount', e.target.value)}
                            placeholder="Enter Amount..."
                            className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none h-12 text-right"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Render Standard Table Layout */
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface/50 border-b border-outline-variant/10 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                      <th className="p-4 w-12 text-center">#</th>
                      <th className="p-4 w-1/3">
                        {voucherType === 'CPV' ? 'Debit Account' : voucherType === 'CRV' ? 'Credit Account' : 'Account Code & Name'}
                      </th>
                      <th className="p-4 w-1/3">Particulars / Narration</th>
                      {(voucherType === 'CPV' || voucherType === 'CRV') ? (
                        <th className="p-4 w-48 text-right">Amount ({currencyCode})</th>
                      ) : (
                        <>
                          <th className="p-4 w-36 text-right">Debit ({currencyCode})</th>
                          <th className="p-4 w-36 text-right">Credit ({currencyCode})</th>
                        </>
                      )}
                      <th className="p-4 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-sm">
                    {lines.map((line, index) => (
                      <tr key={index} className="hover:bg-surface-container-low/30 transition-colors group">
                        <td className="p-4 text-center font-bold text-on-surface-variant/40">{index + 1}</td>
                        <td className="p-2">
                          <select
                            value={line.accountId}
                            onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                            className="w-full px-3 py-2 bg-transparent border border-transparent group-hover:border-outline-variant/30 hover:bg-surface-container-low rounded-xl text-on-surface font-semibold focus:border-primary focus:bg-surface-container-lowest outline-none cursor-pointer"
                          >
                            <option value="">Select Account...</option>
                            {activeAccountsList.map(acc => (
                              <option key={acc.id} value={acc.id}>{acc.id} - {acc.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={line.narration}
                            onChange={(e) => handleLineChange(index, 'narration', e.target.value)}
                            placeholder="Line item narration..."
                            className="w-full px-3 py-2 bg-transparent border border-transparent group-hover:border-outline-variant/30 rounded-xl text-on-surface focus:border-primary focus:bg-surface-container-lowest outline-none"
                          />
                        </td>
                        
                        {(voucherType === 'CPV' || voucherType === 'CRV') ? (
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              value={line.amount === 0 ? '' : line.amount}
                              onChange={(e) => handleLineChange(index, 'amount', e.target.value)}
                              placeholder="0"
                              className="w-full text-right px-3 py-2 bg-transparent border border-transparent group-hover:border-outline-variant/30 rounded-xl text-on-surface font-bold focus:border-primary focus:bg-surface-container-lowest outline-none"
                            />
                          </td>
                        ) : (
                          <>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                value={line.debit === 0 ? '' : line.debit}
                                onChange={(e) => handleLineChange(index, 'debit', e.target.value)}
                                placeholder="0"
                                className="w-full text-right px-3 py-2 bg-transparent border border-transparent group-hover:border-outline-variant/30 rounded-xl text-on-surface font-bold focus:border-primary focus:bg-surface-container-lowest outline-none"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                value={line.credit === 0 ? '' : line.credit}
                                onChange={(e) => handleLineChange(index, 'credit', e.target.value)}
                                placeholder="0"
                                className="w-full text-right px-3 py-2 bg-transparent border border-transparent group-hover:border-outline-variant/30 rounded-xl text-on-surface font-bold focus:border-primary focus:bg-surface-container-lowest outline-none"
                              />
                            </td>
                          </>
                        )}
                        
                        <td className="p-4 text-center">
                          {lines.length > 1 && (
                            <button
                              onClick={() => deleteLine(index)}
                              className="text-on-surface-variant/40 hover:text-error hover:bg-error-container/30 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Delete line"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-b border-outline-variant/15 bg-surface/30">
                <button
                  onClick={addLine}
                  className="flex items-center gap-1.5 text-primary text-xs font-bold hover:bg-primary-container/20 px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Add Ledger Row Line
                </button>
              </div>

              {/* Attached Proofs Overview Section */}
              {(voucherPhotos.length > 0 || voucherVideos.length > 0 || voucherDocs.length > 0) && (
                <div className="p-6 bg-surface-container-low/20 border-b border-outline-variant/15 space-y-4 animate-in fade-in">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#456080] flex items-center gap-1.5 select-none">
                    <span className="material-symbols-outlined text-[18px]">attachment</span>
                    Attached Proofs &amp; Gate Pass Documents ({voucherPhotos.length + voucherVideos.length + voucherDocs.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Media (Photos & Videos) */}
                    {(voucherPhotos.length > 0 || voucherVideos.length > 0) && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Media Files</label>
                        <div className="flex flex-wrap gap-2">
                          {voucherPhotos.map((img, iIndex) => (
                            <div key={`p-${iIndex}`} className="relative group w-20 h-20 bg-slate-100 rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm">
                              <img src={img} className="w-full h-full object-cover" alt="Attached Proof" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                <button 
                                  onClick={() => setActivePreview({ type: 'photo', url: img })}
                                  className="text-white bg-white/20 p-1 rounded-full hover:bg-white/40 cursor-pointer flex items-center justify-center w-8 h-8"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                                </button>
                              </div>
                            </div>
                          ))}
                          {voucherVideos.map((vid, vIndex) => (
                            <div 
                              key={`v-${vIndex}`} 
                              onClick={() => setActivePreview({ type: 'video', url: vid })}
                              className="relative group w-20 h-20 bg-black rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                            >
                              <video src={vid} className="w-full h-full object-contain" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-[24px]">play_circle</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Documents */}
                    {voucherDocs.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Documents</label>
                        <div className="flex flex-col gap-1.5">
                          {voucherDocs.map((doc, dIndex) => (
                            <div 
                              key={`d-${dIndex}`} 
                              onClick={() => setActivePreview({ type: 'doc', url: doc })}
                              className="flex items-center justify-between p-2.5 bg-surface border border-outline-variant/30 rounded-xl text-xs cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center gap-2 text-slate-700 min-w-0">
                                <span className="material-symbols-outlined text-primary text-[18px]">description</span>
                                <span className="font-bold truncate">{doc}</span>
                              </div>
                              <span className="text-[8px] font-bold uppercase px-2 py-0.5 bg-primary/10 text-primary rounded">View</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Overall Details and Reconcile Footer */}
          <div className="p-6 bg-surface-container-lowest grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Overall Description / Remarks</label>
              <textarea
                value={overallNarration}
                onChange={(e) => setOverallNarration(e.target.value)}
                placeholder="Enter comprehensive narration detail notes about this posting..."
                rows="4"
                className="w-full px-4 py-3 bg-surface border border-outline-variant/30 rounded-xl text-on-surface text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
              />
            </div>
            
            <div className="flex flex-col justify-between gap-4">
              {(voucherType === 'CPV' || voucherType === 'CRV') ? (
                <div className="bg-surface-container-low/40 p-5 rounded-2xl border border-outline-variant/15 space-y-3.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-on-surface-variant">
                    <span>Total Voucher Amount:</span>
                    <span className="font-bold text-on-surface text-sm">
                      {currencyCode} {(voucherType === 'CPV' ? totalDebit : totalCredit).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-semibold text-on-surface-variant border-b border-outline-variant/10 pb-3">
                    <span>Offset Cash Account:</span>
                    <span className="font-bold text-primary text-xs">
                      {defaultCashAccount ? `${defaultCashAccount} (Will be automatically ${voucherType === 'CPV' ? 'credited' : 'debited'})` : 'None Selected'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-xs uppercase tracking-wider text-on-surface">Double Entry Status:</span>
                    <span className={`px-3 py-1 text-xs rounded-full ${defaultCashAccount ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {defaultCashAccount ? 'Auto-Balanced on Posting' : 'Requires Cash Account Selection'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-container-low/40 p-5 rounded-2xl border border-outline-variant/15 space-y-3.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-on-surface-variant">
                    <span>Total Ledger Debit:</span>
                    <span className="font-bold text-on-surface text-sm">{currencyCode} {totalDebit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-semibold text-on-surface-variant border-b border-outline-variant/10 pb-3">
                    <span>Total Ledger Credit:</span>
                    <span className="font-bold text-on-surface text-sm">{currencyCode} {totalCredit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-xs uppercase tracking-wider text-on-surface">Unbalanced Difference:</span>
                    <span className={`px-3 py-1 text-xs rounded-full ${difference === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {currencyCode} {difference.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => handleSaveVoucher(false)}
                  className="px-5 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => handleSaveVoucher(true)}
                  className="px-6 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">done_all</span>
                  Post &amp; Print Slip
                </button>
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      ) : (
        // ==================== VOUCHERS HISTORY VIEW ====================
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* History Search & Filter Panel */}
          <section className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[250px] space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Search History</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Search by Voucher number, memo or narration..."
                />
              </div>
            </div>
            
            <div className="w-48 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Voucher Type</label>
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full appearance-none bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer font-semibold text-on-surface-variant"
                >
                  <option value="all">All Types</option>
                  <option value="JV">Journal (JV)</option>
                  <option value="CPV">Payment (CPV)</option>
                  <option value="CRV">Receive (CRV)</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[20px]">
                  expand_more
                </span>
              </div>
            </div>

            <div className="w-48 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</label>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full appearance-none bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer font-semibold text-on-surface-variant"
                >
                  <option value="all">All Statuses</option>
                  <option value="Posted">Posted</option>
                  <option value="Draft">Draft</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[20px]">
                  expand_more
                </span>
              </div>
            </div>

            <button
              onClick={() => { setSearchTerm(''); setFilterType('all'); setFilterStatus('all'); }}
              className="px-5 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-bold text-xs transition-colors h-[42px] cursor-pointer"
            >
              Reset Filters
            </button>
          </section>

          {/* Vouchers Table */}
          <section className="bg-surface-container-lowest rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.04)] overflow-hidden border border-outline-variant/15">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-surface-container">
                    {visibleColumns.date && <ResizableHeader className="px-6 py-4">Date</ResizableHeader>}
                    {visibleColumns.voucherId && <ResizableHeader className="px-6 py-4 font-mono">Voucher ID</ResizableHeader>}
                    {visibleColumns.type && <ResizableHeader className="px-6 py-4">Type</ResizableHeader>}
                    {visibleColumns.reference && <ResizableHeader className="px-6 py-4">Reference</ResizableHeader>}
                    {visibleColumns.amount && <ResizableHeader className="px-6 py-4 text-right">Debit/Credit Total</ResizableHeader>}
                    {visibleColumns.status && <ResizableHeader className="px-6 py-4 text-center">Status</ResizableHeader>}
                    {visibleColumns.actions && <ResizableHeader className="px-6 py-4 text-center">Actions</ResizableHeader>}

                    {/* Column Picker Three-Dot Menu */}
                    <th className="px-4 py-4 w-10 text-center relative">
                      <button
                        onClick={() => setShowColPicker(!showColPicker)}
                        className="p-1.5 hover:bg-surface-container rounded-lg transition-colors cursor-pointer flex items-center justify-center mx-auto"
                        title="Toggle Columns"
                      >
                        <span className="material-symbols-outlined text-[20px] text-on-surface-variant hover:text-primary">more_vert</span>
                      </button>
                      {showColPicker && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowColPicker(false)}></div>
                          <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-lg p-3.5 space-y-2.5 z-20 text-sm text-on-surface text-left normal-case tracking-normal">
                            <p className="font-bold text-[10px] text-on-surface-variant uppercase tracking-widest px-1 mb-1">Toggle Columns</p>
                            <div className="h-px bg-outline-variant/20 my-1"></div>
                            {Object.entries({
                              date: 'Date',
                              voucherId: 'Voucher ID',
                              type: 'Type',
                              reference: 'Reference',
                              amount: 'Debit/Credit Total',
                              status: 'Status',
                              actions: 'Actions'
                            }).map(([key, label]) => (
                              <label key={key} className="flex items-center gap-2 px-1 py-0.5 hover:bg-surface rounded cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={visibleColumns[key]}
                                  onChange={() => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))}
                                  className="rounded border-outline-variant text-primary focus:ring-primary/20 w-4 h-4"
                                />
                                <span className="font-medium text-xs text-on-surface-variant">{label}</span>
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {filteredVouchers.length > 0 ? (
                    filteredVouchers.map((voucher) => (
                      <tr key={voucher.id} className="hover:bg-surface/50 transition-colors group">
                        {visibleColumns.date && (
                          <td className="px-6 py-4 text-sm text-on-surface-variant font-medium whitespace-nowrap">
                            {voucher.date}
                          </td>
                        )}
                        {visibleColumns.voucherId && (
                          <td className="px-6 py-4 text-sm font-mono font-bold text-primary whitespace-nowrap">
                            {voucher.id}
                          </td>
                        )}
                        {visibleColumns.type && (
                          <td className="px-6 py-4 text-sm font-semibold text-on-surface">
                            {voucher.type === 'JV' ? 'Journal (JV)' : voucher.type === 'CPV' ? 'Payment (CPV)' : 'Receive (CRV)'}
                          </td>
                        )}
                        {visibleColumns.reference && (
                          <td className="px-6 py-4 text-sm text-on-surface-variant">
                            {voucher.reference || '-'}
                          </td>
                        )}
                        {visibleColumns.amount && (
                          <td className="px-6 py-4 text-sm font-extrabold text-right text-on-surface">
                            {voucher.totalDebit.toLocaleString()}
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="px-6 py-4 text-sm text-center whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              voucher.status === 'Posted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {voucher.status}
                            </span>
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="px-6 py-4 text-sm text-center">
                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {voucher.status === 'Draft' && (
                                <button
                                  onClick={() => handleEditDraft(voucher)}
                                  className="p-1 hover:bg-surface-container rounded transition-colors text-on-surface-variant hover:text-amber-700 cursor-pointer"
                                  title="Edit Draft"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                              )}
                              <button
                                onClick={() => handlePrint(voucher)}
                                className="p-1 hover:bg-surface-container rounded transition-colors text-on-surface-variant hover:text-primary cursor-pointer"
                                title="Print Voucher"
                              >
                                <span className="material-symbols-outlined text-[18px]">print</span>
                              </button>
                              <button
                                onClick={() => { setSelectedVoucher(voucher); setShowDetailsModal(true); }}
                                className="p-1 hover:bg-surface-container rounded transition-colors text-on-surface-variant hover:text-primary cursor-pointer"
                                title="View Details"
                              >
                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                              </button>
                              <button
                                onClick={() => handleDeleteVoucher(voucher)}
                                className="p-1 hover:bg-surface-container rounded transition-colors text-on-surface-variant hover:text-red-700 cursor-pointer"
                                title="Delete Voucher"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          </td>
                        )}
                        {/* Empty cell matching headers row */}
                        <td className="px-4 py-4 w-10"></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center p-12 text-on-surface-variant font-semibold">
                        No vouchers match the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ======================= VIEW DETAILS MODAL ======================= */}
      {showDetailsModal && selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-on-background/25 backdrop-blur-[3px]" onClick={() => setShowDetailsModal(false)}></div>
          <div className="relative z-10 w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/15 flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-headline font-extrabold text-xl text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
              Voucher Ledger Details
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4 text-xs font-semibold text-on-surface-variant bg-surface-container-low/30 p-4 rounded-xl border border-outline-variant/10">
              <div>Voucher ID: <span className="font-mono text-primary font-bold">{selectedVoucher.id}</span></div>
              <div>Posting Date: <span className="text-on-surface font-bold">{selectedVoucher.date}</span></div>
              <div>Type: <span className="text-on-surface font-bold">{selectedVoucher.type}</span></div>
              <div>Reference Memo: <span className="text-on-surface font-bold">{selectedVoucher.reference || 'N/A'}</span></div>
              <div className="col-span-2 mt-1">Narration: <span className="text-on-surface font-bold italic">{selectedVoucher.narration || 'N/A'}</span></div>
            </div>

            <div className="border border-outline-variant/10 rounded-xl overflow-hidden mb-6 text-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low text-[10px] uppercase font-bold text-on-surface-variant">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Account</th>
                    <th className="p-3">Line Narration</th>
                    <th className="p-3 text-right">Debit</th>
                    <th className="p-3 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-xs">
                  {selectedVoucher.lines.map((l, index) => (
                    <tr key={index}>
                      <td className="p-3 text-center">{index + 1}</td>
                      <td className="p-3 font-semibold">{l.accountId} - {l.accountName}</td>
                      <td className="p-3 text-on-surface-variant">{l.narration || '-'}</td>
                      <td className="p-3 text-right font-bold text-success">{l.debit > 0 ? l.debit.toLocaleString() : '-'}</td>
                      <td className="p-3 text-right font-bold">{l.credit > 0 ? l.credit.toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-container-low/40 font-bold">
                    <td colspan="3" className="p-3 text-right uppercase text-[10px] text-on-surface-variant">Total:</td>
                    <td className="p-3 text-right text-primary">{currencyCode} {selectedVoucher.totalDebit.toLocaleString()}</td>
                    <td className="p-3 text-right text-primary">{currencyCode} {selectedVoucher.totalCredit.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Attached Proofs section in Details Modal */}
            {(selectedVoucher.photos?.length > 0 || selectedVoucher.videos?.length > 0 || selectedVoucher.documents?.length > 0) && (
              <div className="mb-6 p-4 bg-surface-container-low/40 rounded-xl border border-outline-variant/10">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[#456080] mb-2.5 flex items-center gap-1.5 select-none">
                  <span className="material-symbols-outlined text-[14px]">attachment</span>
                  Attached Proofs / Documents
                </h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedVoucher.photos?.map((p, pIdx) => (
                    <a key={pIdx} href={p} target="_blank" rel="noopener noreferrer" className="block w-14 h-14 bg-slate-100 rounded-lg overflow-hidden border border-outline-variant/20 shadow-sm hover:opacity-85">
                      <img src={p} className="w-full h-full object-cover" alt="Attached Proof" />
                    </a>
                  ))}
                  {selectedVoucher.videos?.map((v, vIdx) => (
                    <a key={vIdx} href={v} target="_blank" rel="noopener noreferrer" className="block w-14 h-14 bg-black rounded-lg overflow-hidden border border-outline-variant/20 shadow-sm flex items-center justify-center hover:opacity-85">
                      <span className="material-symbols-outlined text-white text-[18px]">play_circle</span>
                    </a>
                  ))}
                </div>
                {selectedVoucher.documents?.map((d, dIdx) => (
                  <div key={dIdx} className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-1.5 font-semibold">
                    <span className="material-symbols-outlined text-primary text-[14px]">description</span>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => handlePrint(selectedVoucher)}
                className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print Voucher
              </button>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-5 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media & Document Preview Modal */}
      {activePreview && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[10001] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActivePreview(null)}
        >
          {/* Close button top right */}
          <button 
            onClick={(e) => { e.stopPropagation(); setActivePreview(null); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer z-50 shadow-lg"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
          
          <div 
            className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {activePreview.type === 'photo' && (
              <img 
                src={activePreview.url} 
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" 
                alt="Preview Document"
              />
            )}
            {activePreview.type === 'video' && (
              <video 
                src={activePreview.url} 
                controls 
                autoPlay 
                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
              />
            )}
            {activePreview.type === 'doc' && (
              <div className="bg-white text-on-surface p-8 rounded-3xl max-w-md w-full shadow-2xl border border-outline-variant/15 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200">
                <span className="material-symbols-outlined text-primary text-6xl">description</span>
                <div>
                  <h3 className="font-extrabold text-lg text-on-surface">Document Reference</h3>
                  <p className="text-xs text-on-surface-variant mt-1 font-mono break-all">{activePreview.url}</p>
                </div>
                <div className="flex gap-3 w-full mt-4">
                  <a 
                    href={activePreview.url} 
                    download
                    className="flex-1 px-4 py-2.5 bg-[#004277] text-white hover:bg-[#00345e] rounded-xl text-xs font-bold transition-all shadow-md text-center"
                  >
                    Download File
                  </a>
                  <button 
                    onClick={() => setActivePreview(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {studioVoucher && voucherPrintData && (
        <UniversalPrintPreviewModal
          isOpen={Boolean(studioVoucher)}
          onClose={() => setStudioVoucher(null)}
          documentType={studioDocType}
          documentData={voucherPrintData}
          documentTitle={`Voucher ${studioVoucher.id}`}
        />
      )}
    </div>
  );
}
