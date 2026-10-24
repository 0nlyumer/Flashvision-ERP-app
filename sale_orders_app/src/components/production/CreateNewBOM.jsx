import FGCombinationBuilder from "../ui/FGCombinationBuilder";
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import UniversalPrintStudioModal from '../ui/UniversalPrintStudioModal';
import { buildBomPrintRecord } from '../../utils/printDesign';

export default function CreateNewBOM({ onClose, initialBom, isViewOnly = false }) {
  const { state, setCollection, setDirty, isDirty } = useApp();
  const { appAlert } = useDialog();

  // SearchablePhaseItemSelect removed as it's no longer needed for prepopulated matrices.

  const finishedGoods = state.items.filter(i => i.type === 'Finish Good' || i.category === 'Finished Goods');
  const rawMaterials = state.items.filter(i => i.type === 'Raw Material' || i.category === 'Raw Material');
  const packingMaterials = state.items.filter(i => i.type === 'Raw Material' && (i.rawMaterialType === 'Packing' || i.rawMaterialType === 'Packaging' || i.name.toLowerCase().includes('pack')));

  const [selectedFG, setSelectedFG] = useState('');
  const [fgSearchStr, setFgSearchStr] = useState('');
  const [fgDropdownOpen, setFgDropdownOpen] = useState(false);
  const fgDropdownRef = useRef(null);

  const [batchSize, setBatchSize] = useState('');
  const [clothWeight, setClothWeight] = useState('');
  const [printOpen, setPrintOpen] = useState(false);
  
  const genericMaterials = rawMaterials.filter(rm => {
      const type = rm.rawMaterialType?.toLowerCase() || '';
      return !type.includes('cloth') && !type.includes('packing') && !type.includes('packaging');
  });

  const getInitialPhase = (materialsList, initialPhaseData) => {
      return materialsList.map(rm => {
          const existing = initialPhaseData?.find(p => 
              p.rmId === rm.id || 
              p.rmId === rm.sku || 
              p.itemCode === rm.sku || 
              p.itemCode === rm.id || 
              p.name === rm.name
          );
          return { 
              rmId: rm.id, 
              name: rm.name, 
              value: existing ? (existing.value || existing.quantity || '') : '' 
          };
      });
  };

  const [topPhase, setTopPhase] = useState(getInitialPhase(genericMaterials, initialBom?.phases?.top));
  const [foamPhase, setFoamPhase] = useState(getInitialPhase(genericMaterials, initialBom?.phases?.foam));
  const [adhesivePhase, setAdhesivePhase] = useState(getInitialPhase(genericMaterials, initialBom?.phases?.adhesive));
  const [packingSpecs, setPackingSpecs] = useState(getInitialPhase(packingMaterials, initialBom?.phases?.packing));

  useEffect(() => {
     if (initialBom) {
         setSelectedFG(initialBom.finishedGoodId);
         setBatchSize(initialBom.batchSize || '');
         setClothWeight(initialBom.clothWeight || '');
         
         setTopPhase(getInitialPhase(genericMaterials, initialBom.phases?.top));
         setFoamPhase(getInitialPhase(genericMaterials, initialBom.phases?.foam));
         setAdhesivePhase(getInitialPhase(genericMaterials, initialBom.phases?.adhesive));
         setPackingSpecs(getInitialPhase(packingMaterials, initialBom.phases?.packing));
         
         const fg = state.items.find(i => String(i.id) === String(initialBom.finishedGoodId));
         if (fg) setFgSearchStr(fg.name);
     } else {
         setSelectedFG('');
         setBatchSize('');
         setClothWeight('');
         setFgSearchStr('');
         setTopPhase(getInitialPhase(genericMaterials, []));
         setFoamPhase(getInitialPhase(genericMaterials, []));
         setAdhesivePhase(getInitialPhase(genericMaterials, []));
         setPackingSpecs(getInitialPhase(packingMaterials, []));
     }
  }, [initialBom, state.items]);

  // Handle outside click for searchable dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (fgDropdownRef.current && !fgDropdownRef.current.contains(event.target)) {
        setFgDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedItem = state.items.find(i => String(i.id) === String(selectedFG));
  let clothName = 'Select a Finished Good to fetch Cloth';
  if (selectedItem && selectedItem.backClothId) {
      const fabricItem = state.items.find(i => String(i.id) === String(selectedItem.backClothId) || String(i.name).toLowerCase() === String(selectedItem.backClothId).toLowerCase());
      if (fabricItem) {
          clothName = fabricItem.name;
      } else {
          clothName = "Unregistered Cloth (Item Missing from DB)";
      }
  } else if (selectedItem) {
      clothName = 'No back cloth defined for this item';
  }

  const handleRowChange = (setter, stateArray, index, field, newValue) => {
    const newArr = [...stateArray];
    newArr[index][field] = newValue;
    setter(newArr);
    setDirty(true);
  };

  const handleSave = () => {
    if (!selectedFG) {
        appAlert("Please select a Finished Good for the BOM.");
        return;
    }
    if (!batchSize || isNaN(batchSize) || Number(batchSize) <= 0) {
        appAlert("Please enter a valid numeric Batch Size.");
        return;
    }
    
    // Structure the BOM data
    const newBOM = {
        id: initialBom ? initialBom.id : `BOM-${Date.now()}`,
        finishedGoodId: selectedFG,
        batchSize: Number(batchSize),
        clothName: clothName !== 'Select a Finished Good to fetch Cloth' && !clothName.includes('Unknown') ? clothName : '',
        clothWeight: clothWeight,
        clothQuantity: parseFloat(clothWeight) || 0,
        phases: {
            // Only save raw materials that actually have a quantity assigned
            top: topPhase.filter(p => p.value && parseFloat(p.value) > 0),
            foam: foamPhase.filter(p => p.value && parseFloat(p.value) > 0),
            adhesive: adhesivePhase.filter(p => p.value && parseFloat(p.value) > 0),
            packing: packingSpecs.filter(p => p.value && parseFloat(p.value) > 0)
        },
        createdAt: initialBom ? (initialBom.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    // Save to AppContext 
    let existingBOMs = state.boms ? [...state.boms] : [];
    if (initialBom) {
        const idx = existingBOMs.findIndex(b => b.id === initialBom.id);
        if (idx !== -1) existingBOMs[idx] = newBOM;
        else existingBOMs.push(newBOM);
    } else {
        existingBOMs.push(newBOM);
    }
    setCollection('boms', existingBOMs);
    
    appAlert(initialBom ? "BOM updated successfully!" : "BOM Specifications defined and saved successfully!");
    setDirty(false);
    onClose();
  };

  const handleBack = async () => {
      if (isDirty) {
          const proceed = await appConfirm("Unsaved Changes Detected\n\nYou have unsaved progress in the current module. If you proceed, all unsaved entries will be discarded.\n\nAre you sure you wish to leave this screen without saving?", "Leave Without Saving");
          if (proceed) {
              setDirty(false);
              onClose();
          }
      } else {
          onClose();
      }
  };

  const renderPhaseTable = (title, subtitle, stateArray, setter, valueLabel = "Weight / Ratio") => {
      const displayedRows = isViewOnly 
          ? stateArray.filter(row => row.value && parseFloat(row.value) > 0)
          : stateArray;

      return (
          <div className="bg-surface-container-low p-6 rounded-2xl mb-6 shadow-sm border border-outline-variant/10">
             <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="text-xl font-bold font-manrope text-on-surface">{title}</h3>
                    <p className="text-sm text-on-surface-variant font-medium mt-1">{subtitle}</p>
                 </div>
             </div>
             
             <div className="space-y-3">
                 {displayedRows.map((row, idx) => {
                     const originalIdx = stateArray.findIndex(r => r.rmId === row.rmId);
                     return (
                         <div key={row.rmId || idx} className="flex gap-4 items-center bg-surface p-3 rounded-xl border border-outline-variant/10 shadow-sm transition-all hover:bg-surface-container-lowest">
                             <div className="flex-1">
                                 <div className="font-semibold text-sm text-on-surface">{row.name}</div>
                                 <div className="text-xs text-on-surface-variant font-medium mt-0.5 opacity-80">Pre-assigned Row Material</div>
                             </div>
                             <div className="w-1/3 min-w-[140px] relative">
                                    <input 
                                       type="number" 
                                       placeholder="0.0" 
                                       value={row.value}
                                       disabled={isViewOnly}
                                       onChange={(e) => handleRowChange(setter, stateArray, originalIdx !== -1 ? originalIdx : idx, 'value', e.target.value)}
                                    className={`w-full bg-surface-container-lowest border rounded-xl pl-4 pr-16 py-2.5 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${Number(row.value) > 0 ? 'border-primary ring-1 ring-primary' : 'border-outline-variant/30'}`}
                                 />
                                 <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant pointer-events-none">
                                     {title.toLowerCase().includes('packing') ? 'Boxes' : 'KG/Ltr'}
                                 </div>
                             </div>
                         </div>
                     );
                 })}
                 {displayedRows.length === 0 && (
                     <div className="p-6 text-center text-on-surface-variant font-medium italic border border-dashed border-outline-variant/50 rounded-xl">
                         No configured materials found in this phase.
                     </div>
                 )}
             </div>

             {/* Total Weight Counter */}
             {!title.toLowerCase().includes('packing') && (
                 <div className="mt-4 flex justify-end">
                     <div className="bg-primary/5 border border-primary/20 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
                         <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Total Tank Weight:</span>
                         <span className="text-xl font-black text-primary font-manrope">
                             {stateArray.reduce((sum, row) => sum + (parseFloat(row.value) || 0), 0)}
                             <span className="text-sm text-primary/70 font-bold ml-1">KG/Ltr</span>
                         </span>
                     </div>
                 </div>
             )}
          </div>
      );
  };

  const filteredFGs = finishedGoods.filter(fg => 
    fg.name.toLowerCase().includes(fgSearchStr.toLowerCase()) || 
    (fg.sku && fg.sku.toLowerCase().includes(fgSearchStr.toLowerCase())) ||
    (fg.itemCode && fg.itemCode.toLowerCase().includes(fgSearchStr.toLowerCase()))
  );

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 border-b border-outline-variant/20 pb-6">
          <button onClick={handleBack} className="p-2 bg-surface-container-low hover:bg-surface-container rounded-full text-on-surface transition-colors flex items-center justify-center border border-outline-variant/30 font-bold hover:shadow-md">
              <span className="material-symbols-outlined font-bold text-xl">arrow_back</span>
          </button>
          <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs tracking-widest uppercase mb-1">
                  <span className="material-symbols-outlined text-sm">account_tree</span>
                  BOM Master Settings
              </div>
              <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-manrope">{isViewOnly ? 'View BOM' : (initialBom ? 'Edit BOM' : 'Create New BOM')}</h2>
          </div>
          {!isViewOnly ? (
            <button onClick={handleSave} className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-[0_10px_20px_rgba(0,66,119,0.15)] flex items-center gap-2 ring-1 ring-primary-fixed/30 hover:scale-[1.02] transition-transform">
                <span className="material-symbols-outlined text-[20px]">check</span> Save Configuration
            </button>
          ) : (
            <button onClick={() => setPrintOpen(true)} className="px-6 py-3 rounded-xl font-semibold bg-secondary/10 text-secondary hover:bg-secondary/20 shadow-sm flex items-center gap-2 transition-transform hover:scale-[1.02] print:hidden">
                <span className="material-symbols-outlined text-[20px]">print</span> Print BOM
            </button>
          )}
          {printOpen && initialBom && (
            <UniversalPrintStudioModal
              isOpen={printOpen}
              onClose={() => setPrintOpen(false)}
              documentType="bom_master"
              documentData={buildBomPrintRecord(initialBom, state)}
            />
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Formulation Specs */}
          <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.02)] border border-outline-variant/10 relative z-10">
                 <h3 className="text-xl font-bold font-manrope text-on-surface mb-6">Product Assignment</h3>
                 <div className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         
                         {/* Searchable FG Dropdown */}
                         <div className="relative" ref={fgDropdownRef}>
                             <label className="block text-xs uppercase tracking-wider font-bold text-on-surface-variant mb-2">Select Finished Good</label>
                             <div className="flex items-center gap-2">
<div className="relative">
                                 <input 
                                     type="text"
                                     value={selectedFG ? (finishedGoods.find(i => String(i.id) === String(selectedFG))?.name || '') : fgSearchStr}
                                     disabled={isViewOnly}
                                     onChange={(e) => {
                                         if (selectedFG && e.target.value !== finishedGoods.find(i => String(i.id) === String(selectedFG))?.name) {
                                            setSelectedFG(''); // Clear selection if typing again
                                         }
                                         setFgSearchStr(e.target.value);
                                         setFgDropdownOpen(true);
                                     }}
                                     onFocus={() => setFgDropdownOpen(true)}
                                     placeholder="Search item name or code..."
                                     className="w-full bg-surface-container-low border border-outline-variant/30 p-4 rounded-xl text-on-surface focus:outline-none focus:border-primary transition-colors text-sm pr-10 disabled:opacity-50 disabled:cursor-not-allowed"
                                 />
                                 <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                                     search
                                 </span>
                             </div>
{!isViewOnly && (
<FGCombinationBuilder compact={true} allowCreation={false} onSelectItem={(chosen) => { setSelectedFG(chosen.id); setFgSearchStr(chosen.name); setFgDropdownOpen(false); }} />
)}
</div>

                             {fgDropdownOpen && (
                                 <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-outline-variant/20 rounded-xl shadow-lg max-h-60 overflow-y-auto z-50 py-2">
                                     {filteredFGs.length > 0 ? filteredFGs.map(fg => (
                                         <div 
                                            key={fg.id}
                                            onClick={() => {
                                                setSelectedFG(fg.id);
                                                setFgSearchStr(fg.name);
                                                setFgDropdownOpen(false);
                                            }}
                                            className="px-4 py-3 hover:bg-surface-container-low cursor-pointer transition-colors"
                                         >
                                             <div className="font-semibold text-sm text-on-surface">{fg.name}</div>
                                             <div className="text-xs text-on-surface-variant mt-1 font-medium">{fg.itemCode || fg.sku || fg.id}</div>
                                         </div>
                                     )) : (
                                        <div className="px-4 py-3 text-sm text-on-surface-variant italic">No matching items found.</div>
                                     )}
                                 </div>
                             )}
                         </div>

                         {/* Batch Size */}
                         <div>
                             <label className="block text-xs uppercase tracking-wider font-bold text-on-surface-variant mb-2">Batch Size (Meters)</label>
                             <input 
                                 type="number"
                                 value={batchSize}
                                 disabled={isViewOnly}
                                 onChange={(e) => setBatchSize(e.target.value)}
                                 placeholder="Enter standard batch size..."
                                 className="w-full bg-surface-container-low border border-outline-variant/30 p-4 rounded-xl text-on-surface focus:outline-none focus:border-primary transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                             />
                         </div>

                     </div>
                 </div>
              </div>

              {renderPhaseTable("TOP Phase", "Tank A formulation details", topPhase, setTopPhase)}
              {renderPhaseTable("FOAM Phase", "Tank B formulation details", foamPhase, setFoamPhase)}
              {renderPhaseTable("ADHESIVE Phase", "Tank C formulation details", adhesivePhase, setAdhesivePhase)}
              {renderPhaseTable("PACKING Phase", "Packing material estimation", packingSpecs, setPackingSpecs)}

          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
              {/* Cloth Section */}
              <div className="bg-secondary/5 p-6 rounded-3xl border border-secondary/15">
                 <div className="flex items-center gap-2 mb-4">
                     <span className="material-symbols-outlined text-secondary">layers</span>
                     <h3 className="text-xl font-bold font-manrope text-secondary">Cloth Specification</h3>
                 </div>
                 
                 <div className="bg-surface p-4 rounded-xl shadow-sm mb-4 border border-outline-variant/10">
                     <label className="block text-[10px] uppercase tracking-widest font-bold text-secondary mb-1">CLOTH NAME</label>
                     <p className={`font-semibold ${selectedItem && !clothName.includes('No back cloth') ? 'text-on-surface text-sm' : 'text-on-surface-variant/50 text-sm italic'}`}>
                         {clothName}
                     </p>
                 </div>

                 <div>
                     <label className="block text-xs uppercase tracking-wider font-bold text-secondary mb-2">Cloth Weight Requirement</label>
                     <input 
                         type="text"
                         placeholder="Enter weight (e.g., 120g)..."
                         value={clothWeight}
                         onChange={(e) => setClothWeight(e.target.value)}
                         className="w-full bg-surface p-3 rounded-xl border border-outline-variant/20 focus:outline-none focus:border-secondary transition-colors text-sm"
                     />
                 </div>
              </div>

              {/* Packing Specs */}
              {renderPhaseTable("Packing Specs", "Packaging mapping", packingSpecs, setPackingSpecs, rawMaterials.length > 0 ? rawMaterials : packingMaterials, "Qty / Type / Label")}

          </div>
      </div>
    </div>
  );
}
