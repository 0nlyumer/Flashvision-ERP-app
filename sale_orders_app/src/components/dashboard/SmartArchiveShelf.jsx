import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrencyPKR } from '../../utils/currencyUtils';

export default function SmartArchiveShelf({ isOpen, onClose }) {
  const { state } = useApp();

  // stage states: 'browsing' | 'grabbing' | 'opened'
  const [stage, setStage] = useState('browsing');
  const [activeFolder, setActiveFolder] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedField, setHighlightedField] = useState('');
  const [shelvesData, setShelvesData] = useState([]);
  
  // Hand follower state
  const [mousePos, setMousePos] = useState({ x: -100, y: -100, isHoveringShelf: false });
  const [grabbingFolderId, setGrabbingFolderId] = useState(null);
  const [waveAngle, setWaveAngle] = useState(0);
  const shelfRef = useRef(null);

  // Load and adapt dynamic folder data
  useEffect(() => {
    if (!isOpen) return;

    const folders = [];

    // 1. Sales Invoices Folder
    const salesList = state?.saleOrders || [];
    folders.push({
      id: 'sales_orders',
      name: 'Sales Invoices',
      icon: 'receipt_long',
      spineColor: 'bg-gradient-to-b from-indigo-600 via-indigo-700 to-indigo-900 border-indigo-500',
      tagColor: 'bg-indigo-500 text-white',
      documents: salesList.length > 0 ? salesList.map(so => ({
        id: so.id || `SO-${so.orderId}`,
        title: so.customerName || 'Walk-in Customer',
        date: so.date || 'Today',
        details: [
          { label: 'Document Number', value: so.id || `SO-${so.orderId}` },
          { label: 'Customer Account', value: so.customerName || 'N/A' },
          { label: 'Total Invoice Value', value: formatCurrencyPKR(so.total) },
          { label: 'Associated Items', value: `${so.items?.length || 0} items` },
          { label: 'Warehouse Status', value: so.status || 'Pending' }
        ]
      })) : [
        {
          id: 'SO-MOCK-001',
          title: 'Ahmad & Sons Logistics',
          date: 'May 28, 2026',
          details: [
            { label: 'Document Number', value: 'SO-MOCK-001' },
            { label: 'Customer Account', value: 'Ahmad & Sons Logistics' },
            { label: 'Total Invoice Value', value: 'Rs. 12,450.00' },
            { label: 'Associated Items', value: '12 raw items' },
            { label: 'Warehouse Status', value: 'Approved' }
          ]
        }
      ]
    });

    // 2. HR Profiles Folder
    const onboardingRaw = localStorage.getItem('hr_onboarding_history');
    let onboardingList = [];
    if (onboardingRaw) {
      try { onboardingList = JSON.parse(onboardingRaw); } catch(e){}
    }
    folders.push({
      id: 'hr_profiles',
      name: 'HR Profiles',
      icon: 'assignment_ind',
      spineColor: 'bg-gradient-to-b from-teal-600 via-teal-700 to-teal-900 border-teal-500',
      tagColor: 'bg-teal-500 text-white',
      documents: onboardingList.length > 0 ? onboardingList.map(emp => ({
        id: emp.id || `EMP-${emp.employeeCode || '101'}`,
        title: emp.employeeName || 'Roster Employee',
        date: emp.joiningDate || 'Active',
        details: [
          { label: 'Employee ID', value: emp.id || `EMP-${emp.employeeCode || '101'}` },
          { label: 'Full Name', value: emp.employeeName || 'N/A' },
          { label: 'Job Designation', value: emp.designation || 'Specialist' },
          { label: 'Date of Joining', value: emp.joiningDate || '2026-05-15' },
          { label: 'National ID (CNIC)', value: emp.cnic || 'N/A' },
          { label: 'Roster Status', value: emp.status || 'Submitted' }
        ]
      })) : [
        {
          id: 'EMP-991',
          title: 'Fatima Malik',
          date: '2026-05-01',
          details: [
            { label: 'Employee ID', value: 'EMP-991' },
            { label: 'Full Name', value: 'Fatima Malik' },
            { label: 'Job Designation', value: 'Senior Auditor' },
            { label: 'Date of Joining', value: '2026-05-01' },
            { label: 'National ID (CNIC)', value: '35201-9988111-2' },
            { label: 'Roster Status', value: 'Active' }
          ]
        }
      ]
    });

    // 3. Document Routing Configs
    const routingRaw = localStorage.getItem('hr_routing_rules_config');
    let routingList = [];
    if (routingRaw) {
      try { routingList = JSON.parse(routingRaw); } catch(e){}
    }
    folders.push({
      id: 'routing_rules',
      name: 'Routing Rules',
      icon: 'account_tree',
      spineColor: 'bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 border-amber-500',
      tagColor: 'bg-amber-500 text-white',
      documents: routingList.length > 0 ? routingList.map(rule => ({
        id: rule.id,
        title: rule.name,
        date: rule.lastExecuted || 'Never',
        details: [
          { label: 'Rule Identifier', value: rule.id },
          { label: 'Workflow Name', value: rule.name },
          { label: 'Trigger Document', value: rule.trigger },
          { label: 'Target Cabin Nodes', value: rule.folders?.join(', ') || 'N/A' },
          { label: 'Engine Status', value: rule.status || 'Active' }
        ]
      })) : [
        {
          id: 'RUL-MOCK-04',
          title: 'Default Folder Route',
          date: 'Configured Yesterday',
          details: [
            { label: 'Rule Identifier', value: 'RUL-MOCK-04' },
            { label: 'Workflow Name', value: 'Default Folder Route' },
            { label: 'Trigger Document', value: 'Salary Sheet' },
            { label: 'Target Cabin Nodes', value: 'Finance Cabin' },
            { label: 'Engine Status', value: 'Active' }
          ]
        }
      ]
    });

    // 4. Item Master Folder
    const itemsList = state?.items || [];
    folders.push({
      id: 'item_master',
      name: 'Item Master',
      icon: 'category',
      spineColor: 'bg-gradient-to-b from-purple-600 via-purple-700 to-purple-900 border-purple-500',
      tagColor: 'bg-purple-500 text-white',
      documents: itemsList.length > 0 ? itemsList.map(item => ({
        id: item.sku || item.id,
        title: item.name,
        date: item.status || 'Active',
        details: [
          { label: 'Item Serial / SKU', value: item.sku || item.id },
          { label: 'Inventory Name', value: item.name },
          { label: 'Material Classification', value: item.category || 'Goods' },
          { label: 'Stock Capacity', value: `${item.stock || 0} ${item.unit || 'Units'}` },
          { label: 'List Price Value', value: formatCurrencyPKR(item.price) }
        ]
      })) : [
        {
          id: 'RM-MOCK-09',
          title: 'Synthetic Silk Roll',
          date: 'Active',
          details: [
            { label: 'Item Serial / SKU', value: 'RM-MOCK-09' },
            { label: 'Inventory Name', value: 'Synthetic Silk Roll' },
            { label: 'Material Classification', value: 'Raw Materials' },
            { label: 'Stock Capacity', value: '2,500 Meters' },
            { label: 'List Price Value', value: 'Rs. 8.50' }
          ]
        }
      ]
    });

    setShelvesData(folders);
  }, [isOpen, state]);

  // Track virtual hand positioning
  const handleMouseMove = (e) => {
    if (stage !== 'browsing') return;
    const shelf = shelfRef.current;
    if (!shelf) return;

    const rect = shelf.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y, isHoveringShelf: true });
    
    // Procedural wave angle calculation based on mouse speed/position changes
    setWaveAngle(Math.sin(x * 0.05) * 18);
  };

  const handleMouseLeave = () => {
    setMousePos(prev => ({ ...prev, isHoveringShelf: false }));
  };

  // Folder pull mechanics
  const handleFolderClick = (folder) => {
    if (stage !== 'browsing') return;
    
    setGrabbingFolderId(folder.id);
    setStage('grabbing');

    // Simulate "Grabbing & Pulling" delay, then open book
    setTimeout(() => {
      setActiveFolder(folder);
      setCurrentPage(folder.documents.length - 1); // latest appended mounted on top
      setSearchQuery('');
      setHighlightedField('');
      setStage('opened');
      setGrabbingFolderId(null);
    }, 850);
  };

  // 3D Skew Flipping Logic
  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < activeFolder.documents.length - 1) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Dynamic document scanning querying
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !activeFolder) return;

    // Scan documents for match
    const q = searchQuery.toLowerCase();
    const matchedIndex = activeFolder.documents.findIndex(doc => 
      doc.id.toLowerCase().includes(q) ||
      doc.title.toLowerCase().includes(q) ||
      doc.details.some(d => d.value.toString().toLowerCase().includes(q))
    );

    if (matchedIndex !== -1) {
      setCurrentPage(matchedIndex);
      
      // Flash / Highlight the queried match text dynamically
      const matchedDoc = activeFolder.documents[matchedIndex];
      const matchedField = matchedDoc.details.find(d => 
        d.value.toString().toLowerCase().includes(q) || 
        d.label.toLowerCase().includes(q)
      );

      if (matchedField) {
        setHighlightedField(matchedField.label);
        setTimeout(() => setHighlightedField(''), 2000); // clear after 2 seconds
      }
    } else {
      alert("No matching document found in this cabinet folder.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md select-none animate-fadeIn">
      <div className="relative w-[95%] max-w-6xl h-[85vh] bg-slate-900 rounded-[40px] border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Decorative Grid overlays */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(30,58,138,0.2),transparent)] pointer-events-none" />
        
        {/* Canvas Toolbar Top */}
        <header className="p-6 border-b border-white/5 flex justify-between items-center z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>shelves</span>
            </div>
            <div>
              <h2 className="text-lg font-black font-headline text-white tracking-tight leading-none">Smart Archive Shelf</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mt-1 leading-none">Modern Document Warehouse</p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
            title="Exit Shelf View"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        {/* Dynamic Display Canvas */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center px-8 pb-10">
          
          {stage === 'browsing' || stage === 'grabbing' ? (
            /* ================= visual wooden grid shelf view ================= */
            <div 
              ref={shelfRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="relative w-full max-w-4xl h-[450px] bg-slate-950/40 rounded-3xl border border-white/5 p-8 flex flex-col justify-end gap-16 cursor-none z-10"
            >
              {/* Virtual Hand Follow Overlay */}
              {mousePos.isHoveringShelf && (
                <div 
                  className="absolute pointer-events-none z-30 transition-transform duration-75 ease-out select-none text-white/50"
                  style={{
                    left: `${mousePos.x}px`,
                    top: `${mousePos.y}px`,
                    transform: `translate3d(-50%, -50%, 0) rotate(${waveAngle}deg) ${stage === 'grabbing' ? 'scale(0.85)' : 'scale(1)'}`,
                    willChange: 'transform'
                  }}
                >
                  <svg width="70" height="70" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path 
                      d="M22 36V16.5C22 14.57 23.57 13 25.5 13C27.43 13 29 14.57 29 16.5V28H31V12.5C31 10.57 32.57 9 34.5 9C36.43 9 38 10.57 38 12.5V28H40V14.5C40 12.57 41.57 11 43.5 11C45.43 11 47 12.57 47 14.5V28H49V18.5C49 16.57 50.57 15 52.5 15C54.43 15 56 16.57 56 18.5V40C56 48.28 49.28 55 41 55H31C24.37 55 19 49.63 19 43V36H22Z" 
                      fill="currentColor" 
                      fillOpacity={stage === 'grabbing' ? '0.7' : '0.25'} 
                      stroke="currentColor" 
                      strokeWidth="2.5"
                    />
                  </svg>
                </div>
              )}

              {/* Minimalist physical wooden metallic shelf grid */}
              <div className="relative w-full h-[180px] flex items-end justify-center px-4">
                
                {/* Metallic Bracket Left & Right */}
                <div className="absolute left-0 bottom-0 w-3 h-10 bg-slate-700/60 rounded-t-sm" />
                <div className="absolute right-0 bottom-0 w-3 h-10 bg-slate-700/60 rounded-t-sm" />

                {/* Wood Plank Shelf */}
                <div className="absolute bottom-0 left-0 right-0 h-4 rounded-full bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 border-t border-amber-700 shadow-md z-10" />
                
                {/* Horizontal lineup of dynamic files */}
                <div className="flex items-end gap-5 z-20 pb-4 h-full">
                  {shelvesData.map((folder, index) => {
                    const isGrabbing = grabbingFolderId === folder.id;
                    return (
                      <div 
                        key={folder.id}
                        onClick={() => handleFolderClick(folder)}
                        className={`w-14 h-[120px] rounded-md ${folder.spineColor} border-l-[3px] shadow-[5px_5px_15px_rgba(0,0,0,0.6)] cursor-none relative flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
                          isGrabbing 
                            ? '-translate-y-16 scale-95 shadow-[0_30px_50px_rgba(0,0,0,0.8)] z-30 border-r border-t border-white/20' 
                            : 'hover:-translate-y-4 hover:shadow-[0_15px_25px_rgba(0,0,0,0.5)] active:scale-95 active:translate-y-0'
                        }`}
                      >
                        {/* Shadow mask */}
                        <div className="absolute inset-y-0 left-0 w-2 bg-black/20" />
                        
                        {/* Folder Spine Title (crisp vertical typography rotated -90deg) */}
                        <div 
                          className="text-[10px] font-black uppercase text-white/95 tracking-widest whitespace-nowrap origin-center"
                          style={{ transform: 'rotate(-90deg)' }}
                        >
                          {folder.name}
                        </div>

                        {/* Visual Spine Tag Icon Bottom */}
                        <div className="absolute bottom-2.5 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/70">
                          <span className="material-symbols-outlined text-xs">{folder.icon}</span>
                        </div>

                        {/* Page count pill */}
                        <div className="absolute -top-2.5 right-1 px-1.5 py-0.5 rounded bg-white text-slate-900 font-mono text-[8px] font-extrabold shadow-sm">
                          {folder.documents.length}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ================= Full Screen 3D Book Overlay stage ================= */
            <div className="w-full max-w-4xl h-[520px] flex flex-col gap-6 animate-slideUp z-10">
              
              {/* Document Header Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/50 backdrop-blur border border-white/5 rounded-2xl px-6 py-3">
                <button 
                  onClick={() => setStage('browsing')}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Back to Shelf List
                </button>

                {/* Auto-flipping Document Query Bar */}
                <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 focus:bg-slate-950 focus:outline-none rounded-xl pl-9 pr-14 py-2 text-xs text-white placeholder:text-slate-400"
                    placeholder="Scan file doc ID / Name..."
                  />
                  <button 
                    type="submit" 
                    className="absolute right-2 top-1.5 px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] transition-colors"
                  >
                    Scan
                  </button>
                </form>
              </div>

              {/* Opened 3D Book Layout */}
              <div className="flex-1 flex gap-2 relative">
                
                {/* Left Page (Details Index & metadata log) */}
                <div className="flex-1 bg-gradient-to-r from-slate-100 to-white text-slate-900 rounded-l-[28px] border-r border-slate-200/50 shadow-[-15px_15px_30px_rgba(0,0,0,0.4)] flex flex-col p-8 overflow-y-auto">
                  <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cabinet Index</span>
                    <span className="inline-flex items-center gap-1 text-slate-700 font-bold text-xs uppercase tracking-wide">
                      <span className="material-symbols-outlined text-base">{activeFolder.icon}</span>
                      {activeFolder.name}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Folder Documents Roster</h3>
                    
                    {/* Index List of Documents */}
                    <div className="space-y-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
                      {activeFolder.documents.map((doc, idx) => {
                        const isActive = idx === currentPage;
                        return (
                          <button
                            key={doc.id}
                            onClick={() => setCurrentPage(idx)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between border ${
                              isActive 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-extrabold shadow-sm' 
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-indigo-600' : 'bg-slate-400'}`} />
                              <span className="truncate text-xs">{doc.title}</span>
                            </div>
                            <span className="font-mono text-[9px] font-bold text-slate-400 shrink-0">{doc.id}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dynamic Page indicator footer */}
                  <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] font-mono text-slate-400 shrink-0">
                    <span>Page {currentPage + 1} of {activeFolder.documents.length}</span>
                    <span className="uppercase font-bold tracking-widest text-slate-400">Section I-X</span>
                  </div>
                </div>

                {/* Opened Spine Divider */}
                <div className="w-1.5 bg-gradient-to-r from-slate-200 via-slate-400 to-slate-200 shadow-md z-20 shrink-0 relative" />

                {/* Right Page (Active Document presentation with paper skew flip effects) */}
                <div 
                  className="flex-1 bg-gradient-to-l from-slate-50 to-white text-slate-900 rounded-r-[28px] shadow-[15px_15px_30px_rgba(0,0,0,0.4)] flex flex-col p-8 overflow-y-auto relative"
                  style={{
                    willChange: 'transform',
                    animation: 'pageFlipSkew 0.4s ease-out'
                  }}
                  key={currentPage} // triggers re-render page animation on change
                >
                  <style>{`
                    @keyframes pageFlipSkew {
                      0% {
                        transform: perspective(1000px) rotateY(-12deg) skewY(-2deg);
                        opacity: 0.85;
                      }
                      100% {
                        transform: perspective(1000px) rotateY(0deg) skewY(0deg);
                        opacity: 1;
                      }
                    }
                  `}</style>

                  {/* Page Top Details */}
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200/60 mb-6 shrink-0">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Sheet File</h4>
                      <p className="text-sm font-extrabold text-slate-800 mt-0.5">{activeFolder.documents[currentPage].title}</p>
                    </div>
                    <span className="text-[10px] font-mono font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                      {activeFolder.documents[currentPage].id}
                    </span>
                  </div>

                  {/* Document Attributes Layout */}
                  <div className="flex-1 flex flex-col gap-4">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metadata Field Registry</h5>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {activeFolder.documents[currentPage].details.map((field) => {
                        const isQueryHighlighted = highlightedField === field.label;
                        return (
                          <div 
                            key={field.label} 
                            className={`p-3 rounded-xl border transition-all ${
                              isQueryHighlighted 
                                ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-200 animate-pulse' 
                                : 'bg-slate-50 border-slate-200/50 hover:bg-slate-100/50'
                            }`}
                          >
                            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</span>
                            <span className="block text-xs font-black text-slate-800 mt-0.5 font-mono">{field.value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Absolute navigation paging arrows */}
                  <div className="absolute right-6 bottom-6 flex items-center gap-1.5 z-20">
                    <button
                      onClick={handlePrevPage}
                      disabled={currentPage === 0}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center shadow-sm cursor-pointer"
                      title="Previous Page"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">chevron_left</span>
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === activeFolder.documents.length - 1}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center shadow-sm cursor-pointer"
                      title="Next Page"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">chevron_right</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Info footer label */}
        <footer className="px-8 py-4 border-t border-white/5 bg-slate-950/20 text-center shrink-0 z-20">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
            {stage === 'browsing' 
              ? 'Slide cursor over vertical spines to read file names. Click any file to pull & inspect.'
              : stage === 'grabbing'
              ? 'Locking virtual vector anchors... Pulling folder out of slot.'
              : 'Use bottom right navigational arrows or search query to flip book sheets.'}
          </p>
        </footer>

      </div>
    </div>
  );
}
