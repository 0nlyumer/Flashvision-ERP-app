import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import { stripPhaseFromItems } from '../../utils/phaseStrip';

export default function RawMaterialProduction() {
  const { state, setCollection, setDirty, isDirty } = useApp();
  const { appConfirm, appAlert } = useDialog();

  // Selected item to produce (only raw materials with productionAllowed === true)
  const [selectedRMId, setSelectedRMId] = useState('');
  const [productionQty, setProductionQty] = useState('');
  
  // Department configurations
  const [consumptionDept, setConsumptionDept] = useState('');
  const [productionDept, setProductionDept] = useState('');

  // Local phase and materials configuration for the active item
  const [productionPhases, setProductionPhases] = useState([]);
  const [materialsData, setMaterialsData] = useState({});
  const [manualMode, setManualMode] = useState(false);
  const [draggedRow, setDraggedRow] = useState(null);
  const [draggedPhaseIdx, setDraggedPhaseIdx] = useState(null);
  
  // Selection control for adding rows in phases
  const [addSelections, setAddSelections] = useState({});

  // 1. Filter raw materials that are allowed for production
  const producibleMaterials = useMemo(() => {
    return (state.items || []).filter(
      i => (i.category === 'Raw Material' || i.type === 'Raw Material') && i.productionAllowed === true
    );
  }, [state.items]);

  // 2. All raw materials for consumption selection
  const rawMaterials = useMemo(() => {
    return (state.items || []).filter(i => i.category === 'Raw Material' || i.type === 'Raw Material');
  }, [state.items]);

  const selectedItem = useMemo(() => {
    return producibleMaterials.find(m => String(m.id) === String(selectedRMId) || String(m.sku) === String(selectedRMId));
  }, [producibleMaterials, selectedRMId]);

  // 3. Sync and initialize BOM / Phase details when active material changes
  useEffect(() => {
    if (!selectedItem) {
      setProductionPhases([]);
      setMaterialsData({});
      return;
    }

    // Load active phases list from context (with fallbacks)
    const activePhases = state.rawMaterialPhases || [];
    setProductionPhases(JSON.parse(JSON.stringify(activePhases)));

    // Look for a saved BOM configuration for this raw material
    const savedBOM = (state.boms || []).find(
      b => String(b.finishedGoodId) === String(selectedItem.id) || b.finishedGoodName === selectedItem.name
    );

    const initialMats = {};
    activePhases.forEach(phase => {
      if (savedBOM && savedBOM.phases?.[phase.id] && !manualMode) {
        const bomMats = savedBOM.phases[phase.id] || [];
        const bomBatchSize = Number(savedBOM.batchSize) || 1;
        const targetQty = parseFloat(productionQty) || 0;
        const multiplier = targetQty / bomBatchSize;

        initialMats[phase.id] = bomMats.map(m => {
          const qty = Number(m.value || m.quantity || 0);
          const scaled = (qty * multiplier).toFixed(2);
          return {
            name: m.name,
            itemCode: m.itemCode || m.rmId || '',
            bomValue: scaled,
            value: scaled,
            adjustedValue: ''
          };
        });
      } else {
        // Populate with raw materials configured/ticked for this phase in Raw Material Config
        const filteredSourceList = rawMaterials.filter(m => {
          if (m.consumptionPhases && Array.isArray(m.consumptionPhases)) {
            return m.consumptionPhases.includes(phase.id);
          }
          return false;
        });
        initialMats[phase.id] = filteredSourceList.map(m => ({
          name: m.name,
          itemCode: m.sku || m.id || '',
          value: '',
          adjustedValue: ''
        }));
      }
    });

    setMaterialsData(initialMats);
  }, [selectedRMId, productionQty, state.rawMaterialPhases, state.boms, manualMode, rawMaterials]);

  // Scale BOM values dynamically when production quantity changes
  useEffect(() => {
    if (!selectedItem || manualMode) return;
    const savedBOM = (state.boms || []).find(
      b => String(b.finishedGoodId) === String(selectedItem.id) || b.finishedGoodName === selectedItem.name
    );
    if (!savedBOM) return;

    setMaterialsData(prev => {
      const updated = { ...prev };
      const bomBatchSize = Number(savedBOM.batchSize) || 1;
      const targetQty = parseFloat(productionQty) || 0;
      const multiplier = targetQty / bomBatchSize;

      productionPhases.forEach(phase => {
        const bomMats = savedBOM.phases?.[phase.id] || [];
        updated[phase.id] = bomMats.map(m => {
          const qty = Number(m.value || m.quantity || 0);
          const scaled = (qty * multiplier).toFixed(2);
          return {
            name: m.name,
            itemCode: m.itemCode || m.rmId || '',
            bomValue: scaled,
            value: scaled,
            adjustedValue: ''
          };
        });
      });
      return updated;
    });
  }, [productionQty]);

  // Handle phase title edits
  const handlePhaseUpdate = (phaseId, updatedFields) => {
    const nextPhases = productionPhases.map(p => {
      if (p.id === phaseId) {
        return { ...p, ...updatedFields };
      }
      return p;
    });
    setProductionPhases(nextPhases);
    setCollection('rawMaterialPhases', nextPhases);
    setDirty(true);
  };

  // Add Dynamic Phase (Registers app-wide in rawMaterialPhases)
  const handleAddPhase = async () => {
    const phaseName = prompt("Enter the title of the new phase (e.g. Mixing Phase):");
    if (!phaseName || phaseName.trim() === '') return;

    const newId = 'phase_' + Date.now();
    const newPhase = {
      id: newId,
      title: phaseName,
      label: phaseName,
      tank: 'Custom Phase',
      unit: 'kg',
      width: 420,
      enabled: true,
      type: 'Raw Material'
    };

    const nextPhases = [...productionPhases, newPhase];
    setProductionPhases(nextPhases);
    setCollection('rawMaterialPhases', nextPhases);

    setMaterialsData(prev => ({
      ...prev,
      [newId]: []
    }));
    setDirty(true);
    appAlert(`Phase "${phaseName}" added successfully. It is now listed in Raw Material Configuration.`, 'success');
  };

  // Delete Phase (Registers app-wide)
  const handleDeletePhase = async (phaseId, phaseTitle) => {
    const confirmDelete = await appConfirm(
      `Are you sure you want to delete the phase "${phaseTitle}"?\nThis will remove it globally from all raw material configurations, and its ticks will be removed from every material's phase mapping.`,
      "Delete Phase", "Delete", "Cancel"
    );
    if (!confirmDelete) return;

    const nextPhases = productionPhases.filter(p => p.id !== phaseId);
    setProductionPhases(nextPhases);
    setCollection('rawMaterialPhases', nextPhases);

    // Clean the deleted phase's ticks off every item, so no orphan phase
    // id is left behind in items' consumptionPhases (2026-10-25).
    const cleanedItems = stripPhaseFromItems(state.items || [], phaseId);
    if (cleanedItems !== (state.items || [])) {
      setCollection('items', cleanedItems);
    }

    setMaterialsData(prev => {
      const updated = { ...prev };
      delete updated[phaseId];
      return updated;
    });
    setDirty(true);
    appAlert(`Phase "${phaseTitle}" removed.`, 'info');
  };

  // Drag and Drop Phase Reordering
  const handlePhaseDragStart = (e, index) => {
    setDraggedPhaseIdx(index);
  };

  const handlePhaseDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedPhaseIdx === null || draggedPhaseIdx === targetIndex) return;

    const nextPhases = [...productionPhases];
    const [moved] = nextPhases.splice(draggedPhaseIdx, 1);
    nextPhases.splice(targetIndex, 0, moved);

    setProductionPhases(nextPhases);
    setCollection('rawMaterialPhases', nextPhases);
    setDraggedPhaseIdx(null);
    setDirty(true);
  };

  // Drag and Drop Ingredient Reordering
  const handleRowDragStart = (e, phaseId, index) => {
    setDraggedRow({ phaseId, index });
  };

  const handleRowDrop = (e, targetPhaseId, targetIndex) => {
    e.preventDefault();
    if (!draggedRow || draggedRow.phaseId !== targetPhaseId) return;

    const nextMats = [...(materialsData[targetPhaseId] || [])];
    const [moved] = nextMats.splice(draggedRow.index, 1);
    nextMats.splice(targetIndex, 0, moved);

    setMaterialsData(prev => ({
      ...prev,
      [targetPhaseId]: nextMats
    }));
    setDraggedRow(null);
    setDirty(true);
  };

  // Handle quantity changes in rows
  const handleRowValueChange = (phaseId, index, field, newValue) => {
    setMaterialsData(prev => {
      const updated = { ...prev };
      const phaseArr = [...updated[phaseId]];
      phaseArr[index] = { ...phaseArr[index], [field]: newValue };
      updated[phaseId] = phaseArr;
      return updated;
    });
    setDirty(true);
  };

  const handleDeleteRow = (phaseId, index) => {
    setMaterialsData(prev => {
      const updated = { ...prev };
      const phaseArr = [...updated[phaseId]];
      phaseArr.splice(index, 1);
      updated[phaseId] = phaseArr;
      return updated;
    });
    setDirty(true);
  };

  const handleAddRow = (phaseId) => {
    const selectionKey = `${phaseId}-select`;
    const matId = addSelections[selectionKey];
    if (!matId) return;

    const matItem = rawMaterials.find(m => String(m.id) === String(matId) || String(m.sku) === String(matId));
    if (!matItem) return;

    setMaterialsData(prev => {
      const updated = { ...prev };
      const phaseArr = [...(updated[phaseId] || [])];
      phaseArr.push({
        name: matItem.name,
        itemCode: matItem.sku || matItem.id || 'N/A',
        value: '',
        adjustedValue: ''
      });
      updated[phaseId] = phaseArr;
      return updated;
    });

    setAddSelections(prev => ({ ...prev, [selectionKey]: '' }));
    setDirty(true);
  };

  // Toggle Mode (BOM/Manual)
  const handleToggleMode = () => {
    setManualMode(prev => !prev);
  };

  // Save the current phase recipe layout as the standard BOM for this raw material
  const handleSaveAsBOM = async () => {
    if (!selectedItem) {
      appAlert("Please select a produced Raw Material first.", "error");
      return;
    }
    const targetQty = parseFloat(productionQty) || 1;

    const proceed = await appConfirm(
      `Save this formulation as the standard recipe (BOM) for ${selectedItem.name}?`,
      "Save Formulation", "Save BOM", "Cancel"
    );
    if (!proceed) return;

    const buildPhase = (phaseId) => {
      const arr = [];
      if (materialsData[phaseId]) {
        materialsData[phaseId].forEach(m => {
          const val = (m.adjustedValue !== undefined && m.adjustedValue !== '') ? m.adjustedValue : m.value;
          if (val && Number(val) > 0) {
            arr.push({ name: m.name, rmId: m.itemCode, itemCode: m.itemCode, quantity: Number(val) });
          }
        });
      }
      return arr;
    };

    const dynamicPhases = {};
    productionPhases.forEach(p => {
      dynamicPhases[p.id] = buildPhase(p.id);
    });

    const newBom = {
      id: `BOM-${Date.now()}`,
      finishedGoodName: selectedItem.name,
      finishedGoodId: selectedItem.id,
      clothName: '',
      clothWeight: '',
      batchSize: targetQty,
      status: 'Active',
      phaseConfig: JSON.parse(JSON.stringify(productionPhases)),
      phases: dynamicPhases,
      createdAt: new Date().toISOString()
    };

    const updatedBoms = state.boms ? [...state.boms] : [];
    const existingIdx = updatedBoms.findIndex(b => String(b.finishedGoodId) === String(selectedItem.id));

    if (existingIdx !== -1) {
      newBom.id = updatedBoms[existingIdx].id;
      updatedBoms[existingIdx] = newBom;
    } else {
      updatedBoms.push(newBom);
    }

    setCollection('boms', updatedBoms);
    appAlert(`Standard recipe saved successfully for ${selectedItem.name}.`, 'success');
  };

  // Process / Complete Production
  const handleCompleteProduction = async () => {
    if (!selectedItem) {
      appAlert("Please select a Raw Material to produce.", "error");
      return;
    }
    if (!productionQty || isNaN(productionQty) || Number(productionQty) <= 0) {
      appAlert("Please enter a valid target production quantity.", "error");
      return;
    }
    if (!consumptionDept || !productionDept) {
      appAlert("Please select both Consumption and Production departments.", "error");
      return;
    }

    // 1. Validation check (All quantities entered & stock check)
    let shortageItems = [];
    let validationFailed = false;

    productionPhases.forEach(phase => {
      if (!phase.enabled) return;
      const mats = materialsData[phase.id] || [];
      mats.forEach(mat => {
        const requiredVal = Number(mat.adjustedValue !== undefined && mat.adjustedValue !== '' ? mat.adjustedValue : mat.value || 0);
        if (mat.value === '' && (mat.adjustedValue === undefined || mat.adjustedValue === '')) {
          validationFailed = true;
          return;
        }

        const matItem = state.items.find(i => String(i.sku) === String(mat.itemCode) || String(i.id) === String(mat.itemCode));
        const deptStock = matItem?.stockByDepartment?.[consumptionDept] || 0;
        if (requiredVal > deptStock) {
          shortageItems.push(`${mat.name} (Required: ${requiredVal}kg, Available in ${consumptionDept}: ${deptStock}kg)`);
        }
      });
    });

    if (validationFailed) {
      appAlert("Please ensure all consumption quantities are filled. Enter 0 for unused raw materials.", "error");
      return;
    }

    if (shortageItems.length > 0) {
      appAlert(`Insufficient stock in ${consumptionDept} for following items:\n- ${shortageItems.join('\n- ')}`, "error");
      return;
    }

    // 2. Perform Stock Adjustments
    const updatedItems = (state.items || []).map(item => {
      let nextItem = { ...item };
      let affected = false;

      // Check if this item is consumed in production
      productionPhases.forEach(phase => {
        if (!phase.enabled) return;
        const mats = materialsData[phase.id] || [];
        mats.forEach(mat => {
          if (String(item.sku) === String(mat.itemCode) || String(item.id) === String(mat.itemCode)) {
            const consumedQty = Number(mat.adjustedValue !== undefined && mat.adjustedValue !== '' ? mat.adjustedValue : mat.value || 0);
            
            // Deduct from overall stock and department stock
            nextItem.stock = Math.max(0, Number(nextItem.stock || 0) - consumedQty);
            if (!nextItem.stockByDepartment) nextItem.stockByDepartment = {};
            nextItem.stockByDepartment[consumptionDept] = Math.max(0, (nextItem.stockByDepartment[consumptionDept] || 0) - consumedQty);
            affected = true;
          }
        });
      });

      // Check if this item is the produced item
      if (String(item.id) === String(selectedItem.id)) {
        const producedQty = Number(productionQty);
        nextItem.stock = Number(nextItem.stock || 0) + producedQty;
        if (!nextItem.stockByDepartment) nextItem.stockByDepartment = {};
        nextItem.stockByDepartment[productionDept] = (nextItem.stockByDepartment[productionDept] || 0) + producedQty;
        affected = true;
      }

      return affected ? nextItem : item;
    });

    // 3. Save Ledger Transaction logs
    const transactionId = `TX-${Date.now()}`;
    const ledgerLogs = state.auditLogs || [];
    const newLog = {
      id: transactionId,
      type: 'Raw Material Production',
      operator: state.currentUser?.name || 'Admin',
      date: new Date().toISOString(),
      details: `Produced ${productionQty} ${selectedItem.uom || 'kg'} of ${selectedItem.name}. Ingredients consumed from ${consumptionDept}, stock added to ${productionDept}.`,
      status: 'Approved'
    };

    setCollection('items', updatedItems);
    setCollection('auditLogs', [...ledgerLogs, newLog]);

    setDirty(false);
    appAlert(`Production completed! Produced ${productionQty} ${selectedItem.uom || 'kg'} of ${selectedItem.name}.`, 'success');
    
    // Reset form
    setSelectedRMId('');
    setProductionQty('');
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300 relative h-full flex flex-col bg-background rounded-2xl overflow-hidden shadow-xl border border-outline-variant/20">
      
      {/* Header and Controls */}
      <header className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 flex-shrink-0 bg-surface border-b border-outline-variant/10">
        <div>
          <h1 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight leading-none mb-2">
            Raw Material Production
          </h1>
          <p className="text-on-surface-variant font-body text-sm">
            Manufacture composite raw materials by consuming ingredients and routing output to appropriate departments.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleAddPhase}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/20 hover:border-primary/40 text-primary hover:bg-primary/5 text-sm font-bold transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add_box</span>
            Add Phase
          </button>
          
          {selectedItem && (
            <button 
              onClick={handleSaveAsBOM}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary-container/50 border border-secondary/20 hover:bg-secondary-container text-on-secondary-container text-sm font-bold transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">save_as</span>
              Save BOM
            </button>
          )}

          <button 
            onClick={handleCompleteProduction}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary text-sm font-bold shadow-md transition-all hover:scale-[1.02]"
          >
            <span className="material-symbols-outlined text-[18px]">handyman</span>
            Complete Production
          </button>
        </div>
      </header>

      {/* Main Settings Panel */}
      <section className="px-8 py-6 bg-surface-container-low border-b border-outline-variant/10 grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Selected Raw Material to Produce */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">Select Raw Material to Produce</label>
          <select 
            value={selectedRMId}
            onChange={(e) => {
              setSelectedRMId(e.target.value);
              setManualMode(false);
            }}
            className="bg-surface border border-outline-variant/30 rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">Select producible material...</option>
            {producibleMaterials.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
            ))}
          </select>
        </div>

        {/* Target Production Quantity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">Production Quantity</label>
          <div className="relative">
            <input 
              type="number"
              placeholder="Enter qty..."
              value={productionQty}
              onChange={(e) => setProductionQty(e.target.value)}
              className="w-full bg-surface border border-outline-variant/30 rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors pr-12"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-outline uppercase">
              {selectedItem?.uom ? selectedItem.uom.replace(/.*\(|\)/g, '') : 'kg'}
            </span>
          </div>
        </div>

        {/* Consumption Department Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">Consumption Department (Source Stock)</label>
          <select 
            value={consumptionDept}
            onChange={(e) => setConsumptionDept(e.target.value)}
            className="bg-surface border border-outline-variant/30 rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">Select Source Department...</option>
            {state.departments?.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Production Department Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">Production Department (Destination Stock)</label>
          <select 
            value={productionDept}
            onChange={(e) => setProductionDept(e.target.value)}
            className="bg-surface border border-outline-variant/30 rounded-xl p-3 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">Select Destination Department...</option>
            {state.departments?.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

      </section>

      {/* Dynamic Formulation Columns */}
      <div className="flex-1 px-8 py-8 overflow-y-auto">
        {selectedItem ? (
          <div className="flex flex-col gap-6">
            
            {/* Subsection header */}
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/10">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-headline font-bold text-on-surface">Formulation Recipe Phases</h2>
                {(state.boms || []).some(b => String(b.finishedGoodId) === String(selectedItem.id)) && (
                  <button 
                    onClick={handleToggleMode}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors border ${manualMode ? 'bg-secondary-container text-on-secondary-fixed-variant border-secondary/20' : 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20'}`}
                  >
                    {manualMode ? 'Manual Mode' : 'BOM Mode'}
                  </button>
                )}
              </div>
              <p className="text-xs text-on-surface-variant italic">Drag phase headers to reorder recipe steps. Drag rows to sort ingredients.</p>
            </div>

            {/* Scrollable Columns List */}
            <div className="overflow-x-auto pb-4 custom-scrollbar">
              <div className="flex gap-6 w-max min-w-full">
                {productionPhases.map((phase, pIdx) => {
                  const materials = materialsData[phase.id] || [];
                  const total = materials.reduce((sum, m) => {
                    const val = !manualMode && m.adjustedValue !== undefined && m.adjustedValue !== '' ? m.adjustedValue : m.value;
                    return sum + (Number(val) || 0);
                  }, 0);
                  const selectionKey = `${phase.id}-select`;

                  return (
                    <div 
                      key={phase.id}
                      className={`flex-1 bg-surface/40 rounded-2xl p-4 border flex flex-col transition-all relative ${!phase.enabled ? 'opacity-50 border-outline-variant/10' : 'border-outline-variant/20 shadow-sm'}`}
                      style={{ minWidth: `${phase.width || 420}px`, maxWidth: `${phase.width || 420}px` }}
                    >
                      {/* Drag handles for Phase reordering */}
                      <div 
                        draggable
                        onDragStart={(e) => handlePhaseDragStart(e, pIdx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handlePhaseDrop(e, pIdx)}
                        className="absolute -top-3 left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing p-1 bg-surface hover:bg-surface-container-high rounded-full shadow-sm text-on-surface-variant border border-outline-variant/20 z-10"
                      >
                        <span className="material-symbols-outlined text-[16px]">drag_handle</span>
                      </div>

                      {/* Header details */}
                      <div className="flex justify-between items-start mb-6 mt-3">
                        <div className="flex-1 mr-4">
                          <input 
                            className="text-lg font-bold font-headline text-on-surface bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary focus:outline-none w-full transition-colors"
                            value={phase.title}
                            onChange={(e) => handlePhaseUpdate(phase.id, { title: e.target.value, label: e.target.value })}
                          />
                          <p className="text-[10px] text-on-surface-variant font-semibold mt-1 uppercase tracking-wide">{phase.tank || phase.type}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <button 
                            onClick={() => handlePhaseUpdate(phase.id, { enabled: !phase.enabled })}
                            className={`p-1.5 rounded-lg border shadow-sm ${phase.enabled ? 'bg-surface text-primary border-primary/20' : 'bg-surface-container text-on-surface-variant border-outline-variant/30'}`}
                          >
                            <span className="material-symbols-outlined text-[16px] block">{phase.enabled ? 'visibility' : 'visibility_off'}</span>
                          </button>
                          <button 
                            onClick={() => handleDeletePhase(phase.id, phase.title)}
                            className="p-1.5 rounded-lg border border-error/20 text-error hover:bg-error/5"
                          >
                            <span className="material-symbols-outlined text-[16px] block">delete</span>
                          </button>
                          <div className="bg-primary/10 text-primary px-2.5 py-1.5 rounded-lg flex flex-col items-end">
                            <span className="text-[9px] font-bold uppercase tracking-wider">Total</span>
                            <span className="font-bold text-xs font-manrope">{total} {phase.unit || 'kg'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Materials List */}
                      {phase.enabled && (
                        <div className="flex flex-col gap-2.5 flex-1">
                          {materials.map((mat, idx) => {
                            const matItem = state.items.find(i => String(i.sku) === String(mat.itemCode) || String(i.id) === String(mat.itemCode));
                            const deptStock = matItem?.stockByDepartment?.[consumptionDept] || 0;
                            const requiredVal = Number(mat.adjustedValue !== undefined && mat.adjustedValue !== '' ? mat.adjustedValue : mat.value || 0);
                            const isShortage = consumptionDept && requiredVal > deptStock;

                            return (
                              <div 
                                key={idx}
                                draggable
                                onDragStart={(e) => handleRowDragStart(e, phase.id, idx)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleRowDrop(e, phase.id, idx)}
                                className={`bg-surface-container-lowest rounded-xl p-3 shadow-sm border flex items-center gap-3 cursor-move transition-all ${isShortage ? 'border-error/45 bg-error/5 ring-1 ring-error/20' : 'border-outline-variant/10 hover:border-primary/20'}`}
                              >
                                <span className="material-symbols-outlined text-outline-variant text-[14px]">drag_indicator</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-on-surface truncate">{mat.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[9px] font-mono text-outline">{mat.itemCode}</span>
                                    {consumptionDept && (
                                      <span className={`text-[9px] font-bold px-1 rounded-sm ${isShortage ? 'bg-error/15 text-error' : 'bg-emerald-100 text-emerald-700'}`}>
                                        Stock: {deptStock}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {!manualMode && (state.boms || []).some(b => String(b.finishedGoodId) === String(selectedItem.id)) ? (
                                    <>
                                      <div className="bg-surface-container-low/50 rounded-lg flex items-center px-1.5 py-0.5 w-16 opacity-75">
                                        <input className="w-full bg-transparent border-none text-right font-semibold text-[10px] p-0.5" type="number" value={mat.bomValue || mat.value} readOnly disabled />
                                        <span className="text-[8px] font-bold text-outline-variant ml-0.5">{phase.unit || 'kg'}</span>
                                      </div>
                                      <div className="bg-surface-container-low rounded-lg flex items-center px-1.5 py-0.5 w-16">
                                        <input 
                                          className="w-full bg-transparent border-none text-right font-bold text-xs p-0.5 text-secondary" 
                                          type="number"
                                          placeholder="+/- 0"
                                          value={mat.adjustedValue !== undefined ? mat.adjustedValue : ''}
                                          onChange={(e) => handleRowValueChange(phase.id, idx, 'adjustedValue', e.target.value)}
                                        />
                                        <span className="text-[8px] font-bold ml-0.5 text-secondary">{phase.unit || 'kg'}</span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="bg-surface-container-low rounded-lg flex items-center px-1.5 py-0.5 w-20">
                                      <input 
                                        className="w-full bg-transparent border-none text-right font-semibold text-xs p-0.5" 
                                        type="number"
                                        value={mat.value}
                                        onChange={(e) => handleRowValueChange(phase.id, idx, 'value', e.target.value)}
                                      />
                                      <span className="text-[9px] font-bold text-outline-variant ml-0.5">{phase.unit || 'kg'}</span>
                                    </div>
                                  )}
                                  
                                  <button 
                                    onClick={() => handleDeleteRow(phase.id, idx)}
                                    className="text-error/60 hover:text-error hover:bg-error/10 p-1 rounded-md"
                                  >
                                    <span className="material-symbols-outlined text-[16px] block">delete</span>
                                  </button>
                                </div>

                              </div>
                            );
                          })}
                          
                          {materials.length === 0 && (
                            <div className="text-center py-6 text-on-surface-variant/50 text-xs italic">
                              No items configured. Add below.
                            </div>
                          )}

                          {/* Add Row Button inside phase column */}
                          <div className="mt-4 pt-4 mt-auto">
                            {!addSelections[phase.id + '_mode'] ? (
                              <button 
                                onClick={() => setAddSelections(prev => ({ ...prev, [phase.id + '_mode']: true }))}
                                className="w-full border border-dashed border-outline-variant/40 rounded-lg py-2 flex items-center justify-center gap-1.5 text-primary hover:bg-primary/5 text-xs font-semibold"
                              >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                Add Ingredient
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5 border border-outline-variant/20 rounded-lg p-1.5 bg-surface shadow-sm">
                                <select 
                                  className="flex-1 bg-transparent text-xs text-on-surface outline-none truncate"
                                  value={addSelections[selectionKey] || ''}
                                  onChange={(e) => setAddSelections(prev => ({ ...prev, [selectionKey]: e.target.value }))}
                                >
                                  <option value="">Select Material</option>
                                  {rawMaterials.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                                <button 
                                  onClick={() => {
                                    handleAddRow(phase.id);
                                    setAddSelections(prev => ({ ...prev, [phase.id + '_mode']: false }));
                                  }}
                                  disabled={!addSelections[selectionKey]}
                                  className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-2 py-1 rounded text-xs font-bold transition-colors disabled:opacity-50"
                                >
                                  Add
                                </button>
                                <button
                                  onClick={() => setAddSelections(prev => ({ ...prev, [phase.id + '_mode']: false, [selectionKey]: '' }))}
                                  className="text-on-surface-variant hover:text-error p-1"
                                >
                                  <span className="material-symbols-outlined text-[16px] block">close</span>
                                </button>
                              </div>
                            )}
                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant py-20">
            <span className="material-symbols-outlined text-5xl text-outline mb-4">precision_manufacturing</span>
            <h2 className="text-xl font-bold font-headline mb-1">Recipe Construction Workbench</h2>
            <p className="text-sm max-w-md">Please select a producible raw material and quantities at the top to build or scale the production formulation phases.</p>
          </div>
        )}
      </div>

    </div>
  );
}
