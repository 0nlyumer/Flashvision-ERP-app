import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import CustomMultiSelect from '../ui/CustomMultiSelect';

export default function PlanConsumption({ plan, onClose }) {
  const { state, setCollection, setDirty, isDirty } = useApp();
  const { appConfirm, appAlert } = useDialog();
  const fileInputRef = useRef(null);

  const [consumptionData, setConsumptionData] = useState({});
  const [addSelections, setAddSelections] = useState({});
  const [manualModeItems, setManualModeItems] = useState({});
  const [draggedRow, setDraggedRow] = useState(null);
  const [consumptionDepartments, setConsumptionDepartments] = useState([]);

  const genericMaterials = state.items.filter(i => {
      const isRM = i.category === 'Raw Material' || i.type === 'Raw Material';
      const isCloth = i.category === 'Cloth' || i.type === 'Cloth' || i.rawMaterialType === 'Cloth' || (i.name && i.name.toLowerCase().includes('cloth'));
      const isPacking = i.category === 'Packing Material' || i.type === 'Packing Material' || i.rawMaterialType === 'Packing' || (i.name && i.name.toLowerCase().includes('pack'));
      return isRM && !isCloth && !isPacking;
  });
  const packingMaterials = state.items.filter(i => {
      const isRM = i.category === 'Raw Material' || i.type === 'Raw Material';
      const isPacking = i.category === 'Packing Material' || i.type === 'Packing Material' || i.rawMaterialType === 'Packing' || (i.name && i.name.toLowerCase().includes('pack'));
      return isRM && isPacking;
  });

  useEffect(() => {
     if (Object.keys(consumptionData).length > 0) return; // Prevent wiping active entries when state updates
     
     const initialData = {};
     plan?.items?.forEach(item => {
         const bom = state.boms?.find(b => b.finishedGoodName === item.productName);

         // Auto-fetch clothName based on item (mimic BOMSetup logic)
         let autoClothName = 'No back cloth defined for this item';
         const fgItem = state.items.find(i => String(i.name).toLowerCase() === String(item.productName).toLowerCase() || String(i.sku) === String(item.itemCode));
         if (fgItem && fgItem.backClothId) {
             const fabricItem = state.items.find(i => String(i.id) === String(fgItem.backClothId) || String(i.name).toLowerCase() === String(fgItem.backClothId).toLowerCase());
             if (fabricItem) {
                 autoClothName = fabricItem.name;
             } else {
                 autoClothName = "Unregistered Cloth (Item Missing from DB)";
             }
         }

         const defaultPhaseConfig = state.finishedGoodPhases || [
             { id: 'top', title: 'TOP Phase', tank: 'Tank A', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' },
             { id: 'foam', title: 'FOAM Phase', tank: 'Tank B', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' },
             { id: 'adhesive', title: 'ADHESIVE Phase', tank: 'Tank C', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' },
             { id: 'packing', title: 'Packing Specs', tank: 'Packaging Materials', unit: 'pcs', width: 420, enabled: true, type: 'Packing Material' }
         ];

         if (bom && !manualModeItems[item.itemCode]) {
             if (plan.consumptions && plan.consumptions[item.itemCode] && !isDirty) {
                 const loadedData = JSON.parse(JSON.stringify(plan.consumptions[item.itemCode]));
                 if (!loadedData.phaseConfig) loadedData.phaseConfig = bom.phaseConfig ? JSON.parse(JSON.stringify(bom.phaseConfig)) : JSON.parse(JSON.stringify(defaultPhaseConfig));
                 initialData[item.itemCode] = loadedData;
             } else {
                 const calculateBomValue = (mat) => {
                     const qty = mat.quantity || mat.value;
                     if (!qty) return '';
                     const bomBatchSize = bom.batchSize || 1;
                     return ((parseFloat(qty) / bomBatchSize) * item.outputQty).toFixed(2);
                 };
                 const getBomPhase = (phaseKey) => {
                     if (bom.phases && bom.phases[phaseKey]) return bom.phases[phaseKey];
                     if (bom.materials && bom.materials[phaseKey]) return bom.materials[phaseKey];
                     return [];
                 };
                 
                 const phaseConfigToUse = bom.phaseConfig ? JSON.parse(JSON.stringify(bom.phaseConfig)) : JSON.parse(JSON.stringify(defaultPhaseConfig));
                 const generatedMaterials = {};
                 phaseConfigToUse.forEach(p => {
                     generatedMaterials[p.id] = getBomPhase(p.id).map(m => ({ name: m.name, itemCode: m.itemCode || m.rmId || '', bomValue: calculateBomValue(m), value: calculateBomValue(m), adjustedValue: '' }));
                 });

                 initialData[item.itemCode] = {
                     clothName: bom.clothName && bom.clothName !== 'Select a Finished Good to fetch Cloth' ? bom.clothName : autoClothName,
                     clothQuantity: '',
                     phaseConfig: phaseConfigToUse,
                     materials: generatedMaterials
                 };
             }
         } else {
             if (plan.consumptions && plan.consumptions[item.itemCode]) {
                 const loadedData = JSON.parse(JSON.stringify(plan.consumptions[item.itemCode]));
                 if (!loadedData.phaseConfig) loadedData.phaseConfig = JSON.parse(JSON.stringify(defaultPhaseConfig));
                 initialData[item.itemCode] = loadedData;
             } else {
                 const generatedMaterials = {};
                 defaultPhaseConfig.forEach(p => {
                     const sourceList = p.type === 'Packing Material' ? packingMaterials : genericMaterials;
                     const filteredSourceList = sourceList.filter(m => {
                         if (m.consumptionPhases && Array.isArray(m.consumptionPhases)) {
                             return m.consumptionPhases.includes(p.id);
                         }
                         const isRM = m.category === 'Raw Material' || m.type === 'Raw Material';
                         const isCloth = m.category === 'Cloth' || m.type === 'Cloth' || m.rawMaterialType === 'Cloth' || (m.name && m.name.toLowerCase().includes('cloth'));
                         const isPacking = m.category === 'Packing Material' || m.type === 'Packing Material' || m.rawMaterialType === 'Packing' || (m.name && m.name.toLowerCase().includes('pack'));
                         return p.type === 'Packing Material' ? isPacking : (!isCloth && !isPacking);
                     });
                     generatedMaterials[p.id] = filteredSourceList.map(m => ({ name: m.name, itemCode: m.sku || m.id || '', value: '' }));
                 });
                 initialData[item.itemCode] = {
                     clothName: autoClothName,
                     clothQuantity: '',
                     phaseConfig: JSON.parse(JSON.stringify(defaultPhaseConfig)),
                     materials: generatedMaterials
                 };
             }
         }
     });
      // Initialize departments from existing consumption metadata
      if (plan?.consumptions) {
          const firstItemWithCons = plan.items?.find(item => plan.consumptions[item.itemCode]?.metadata?.departments);
          if (firstItemWithCons) {
              const depts = plan.consumptions[firstItemWithCons.itemCode].metadata.departments || [];
              setConsumptionDepartments(depts);
          }
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConsumptionData(initialData);
   }, [plan, state.boms]);

    const handleRowChange = (itemCode, phase, idx, field, newValue) => {
      setConsumptionData(prev => {
          const updated = { ...prev };
          const targetItem = { ...updated[itemCode] };
          const targetPhase = [...targetItem.materials[phase]];
          targetPhase[idx] = { ...targetPhase[idx], [field]: newValue };
          targetItem.materials[phase] = targetPhase;
          updated[itemCode] = targetItem;
          return updated;
      });
      setDirty(true);
  };

  const handleDeleteRow = (itemCode, phase, idx) => {
      setConsumptionData(prev => {
          const updated = { ...prev };
          const targetItem = { ...updated[itemCode] };
          const targetPhase = [...targetItem.materials[phase]];
          targetPhase.splice(idx, 1);
          targetItem.materials[phase] = targetPhase;
          updated[itemCode] = targetItem;
          return updated;
      });
      setDirty(true);
  };

  const handleAddRow = (itemCode, phase) => {
      const selectionKey = `${itemCode}-${phase}`;
      const matId = addSelections[selectionKey];
      if (!matId) return;

      const matItem = state.items.find(m => String(m.id) === String(matId) || String(m.sku) === String(matId));
      if (!matItem) return;

      setConsumptionData(prev => {
          const updated = { ...prev };
          const targetItem = { ...updated[itemCode] };
          const targetPhase = [...(targetItem.materials[phase] || [])];
          targetPhase.push({ name: matItem.name, itemCode: matItem.sku || matItem.id || 'N/A', value: '' });
          targetItem.materials[phase] = targetPhase;
          updated[itemCode] = targetItem;
          return updated;
      });
      setAddSelections(prev => ({ ...prev, [selectionKey]: '' }));
      setDirty(true);
  };

  const handleDragStart = (e, itemCode, phaseKey, idx) => {
      setDraggedRow({ itemCode, phaseKey, idx });
  };

  const handleDragOver = (e) => {
      e.preventDefault(); 
  };

  const handleDrop = (e, targetItemCode, targetPhaseKey, targetIdx) => {
      e.preventDefault();
      if (!draggedRow) return;
      if (draggedRow.itemCode !== targetItemCode || draggedRow.phaseKey !== targetPhaseKey) return;
      if (draggedRow.idx === targetIdx) {
          setDraggedRow(null);
          return;
      }

      setConsumptionData(prev => {
          const updated = { ...prev };
          const targetItem = { ...updated[targetItemCode] };
          const phaseArr = [...targetItem.materials[targetPhaseKey]];
          
          const [movedItem] = phaseArr.splice(draggedRow.idx, 1);
          phaseArr.splice(targetIdx, 0, movedItem);
          
          targetItem.materials[targetPhaseKey] = phaseArr;
          updated[targetItemCode] = targetItem;
          return updated;
      });
      setDirty(true);
      setDraggedRow(null);
  };

  const handleToggleMode = (itemCode, isCurrentlyManual, item) => {
      const bom = state.boms?.find(b => b.finishedGoodName === item.productName);
      if (!bom) return;

      setDirty(true);
      const willBeManual = !isCurrentlyManual;
      setManualModeItems(p => ({ ...p, [itemCode]: willBeManual }));
      
      setConsumptionData(prev => {
          const updated = { ...prev };
          const itemData = updated[itemCode];
          if (!itemData) return prev;

          if (willBeManual) {
              const mergeManual = (phase, sourceList) => {
                  const existing = itemData.materials[phase] || [];
                  return sourceList.map(m => {
                      const ex = existing.find(e => e.name === m.name);
                      return {
                          name: m.name,
                          itemCode: m.sku || m.id || '',
                          value: ex ? (ex.adjustedValue || ex.value) : '',
                          adjustedValue: ''
                      };
                  });
              };
              itemData.materials = {};
              itemData.phaseConfig.forEach(p => {
                  itemData.materials[p.id] = mergeManual(p.id, p.type === 'Packing Material' ? packingMaterials : genericMaterials);
              });
          } else {
              const getBomPhase = (phaseKey) => {
                  if (bom.phases && bom.phases[phaseKey]) return bom.phases[phaseKey];
                  if (bom.materials && bom.materials[phaseKey]) return bom.materials[phaseKey];
                  return [];
              };
              const calculateBomValue = (mat) => {
                  const qty = mat.quantity || mat.value;
                  if (!qty) return '';
                  const bomBatchSize = bom.batchSize || 1;
                  return ((parseFloat(qty) / bomBatchSize) * item.outputQty).toFixed(2);
              };
              const mergeBOM = (phaseKey) => {
                  const bomMats = getBomPhase(phaseKey);
                  const existing = itemData.materials[phaseKey] || [];
                  return bomMats.map(m => {
                      const ex = existing.find(e => e.name === m.name);
                      return {
                          name: m.name,
                          itemCode: m.itemCode || m.rmId || '',
                          bomValue: calculateBomValue(m),
                          value: calculateBomValue(m),
                          adjustedValue: ex ? (ex.adjustedValue || ex.value) : ''
                      };
                  });
              };
              itemData.materials = {};
              itemData.phaseConfig.forEach(p => {
                  itemData.materials[p.id] = mergeBOM(p.id);
              });
          }
          return updated;
      });
  };

  const handleClothChange = (itemCode, newValue) => {
      setConsumptionData(prev => {
          const updated = { ...prev };
          updated[itemCode] = { ...updated[itemCode], clothQuantity: newValue };
          return updated;
      });
      setDirty(true);
  };

  const validateConsumption = (cData) => {
      if (!cData) return false;
      if (cData.clothQuantity === '') return false;
      
      if (!cData.phaseConfig) return false;
      
      for (const phase of cData.phaseConfig) {
          if (!phase.enabled) continue; // Ignore disabled phases
          const mats = cData.materials[phase.id] || [];
          for (const m of mats) {
              if (m.value === '') return false;
          }
      }
      return true;
  };

    const handleSave = () => {
        if (consumptionDepartments.length === 0) {
            appAlert('Please select at least one consumption department before saving.', 'error');
            return;
        }

        const currentUser = state.currentUser?.name || state.currentUser?.username || 'Admin';
        const currentDate = new Date().toISOString();

        // 1. Validation pass: check for empty values and stock shortages
        let shortageItems = [];
        for (const item of plan.items) {
            const cData = consumptionData[item.itemCode];
            if (cData) {
                if (!validateConsumption(cData)) {
                    appAlert(`Please ensure all quantities are filled for ${item.productName}. Enter 0 for unused items.`, 'error');
                    return;
                }
                
                // Check stock shortages
                if (cData.phaseConfig) {
                    for (const phase of cData.phaseConfig) {
                        if (!phase.enabled) continue;
                        const mats = cData.materials[phase.id] || [];
                        for (const mat of mats) {
                            const matItem = state.items.find(i => String(i.sku) === String(mat.itemCode) || String(i.id) === String(mat.itemCode));
                            
                            // Find the old value to calculate the net difference
                            let oldVal = 0;
                            const oldConsumptions = plan.consumptions || {};
                            const oldCData = oldConsumptions[item.itemCode];
                            if (oldCData && oldCData.materials?.[phase.id]) {
                                const oldMat = oldCData.materials[phase.id].find(m => String(m.itemCode) === String(mat.itemCode));
                                if (oldMat) {
                                    oldVal = Number((oldMat.adjustedValue !== undefined && oldMat.adjustedValue !== '') ? oldMat.adjustedValue : oldMat.value || 0);
                                }
                            }

                            const newVal = Number((mat.adjustedValue !== undefined && mat.adjustedValue !== '') ? mat.adjustedValue : mat.value || 0);
                            const diff = newVal - oldVal;

                            const availableStock = matItem ? Number(matItem.stock || 0) : 0;
                            if (diff > 0 && diff > availableStock) {
                                shortageItems.push(`${mat.name} (Need ${diff} more, current stock is ${availableStock})`);
                            }
                        }
                    }
                }
            }
        }

        if (shortageItems.length > 0) {
            const uniqueShortages = [...new Set(shortageItems)];
            appAlert(`Cannot save consumption. The following items have insufficient stock: \n- ${uniqueShortages.join('\n- ')}`, 'error');
            return;
        }

        if (!consumptionDepartments || consumptionDepartments.length === 0) {
            appAlert('Please select at least one department for consumption.', 'error');
            return;
        }

        // 2. Data modification pass
        for (const item of plan.items) {
            const cData = consumptionData[item.itemCode];
            if (cData) {
                // Attach metadata to the specific item's consumption record
                if (!cData.metadata || !cData.metadata.createdAt) {
                    cData.metadata = { 
                        ...cData.metadata,
                        createdBy: currentUser, 
                        createdAt: currentDate,
                        departments: consumptionDepartments
                    };
                } else {
                    cData.metadata = {
                        ...cData.metadata,
                        lastEditedBy: currentUser,
                        lastEditedAt: currentDate,
                        departments: consumptionDepartments.length > 0 ? consumptionDepartments : cData.metadata.departments
                    };
                }
            }
        }

        // 3. Stock Level Updates
        const stockAdjustments = {}; // matCode -> totalDiff

        // First, add all new consumption values
        for (const item of plan.items) {
            const cData = consumptionData[item.itemCode];
            if (cData && cData.phaseConfig) {
                for (const phase of cData.phaseConfig) {
                    if (!phase.enabled) continue;
                    const mats = cData.materials?.[phase.id] || [];
                    for (const mat of mats) {
                        const matCode = mat.itemCode;
                        const newVal = Number((mat.adjustedValue !== undefined && mat.adjustedValue !== '') ? mat.adjustedValue : mat.value || 0);
                        if (!stockAdjustments[matCode]) stockAdjustments[matCode] = 0;
                        stockAdjustments[matCode] += newVal;
                    }
                }
            }
        }

        // Then, subtract all old consumption values
        const oldConsumptions = plan.consumptions || {};
        for (const item of plan.items) {
            const oldCData = oldConsumptions[item.itemCode];
            if (oldCData && oldCData.phaseConfig) {
                for (const phase of oldCData.phaseConfig) {
                    if (!phase.enabled) continue;
                    const mats = oldCData.materials?.[phase.id] || [];
                    for (const mat of mats) {
                        const matCode = mat.itemCode;
                        const oldVal = Number((mat.adjustedValue !== undefined && mat.adjustedValue !== '') ? mat.adjustedValue : mat.value || 0);
                        if (!stockAdjustments[matCode]) stockAdjustments[matCode] = 0;
                        stockAdjustments[matCode] -= oldVal;
                    }
                }
            }
        }

        const updatedItems = (state.items || []).map(item => {
            const matCode = item.sku || item.id;
            const diff = stockAdjustments[matCode] !== undefined ? stockAdjustments[matCode] : stockAdjustments[item.id];
            if (diff !== undefined && diff !== 0) {
                const nextItem = { ...item };
                if (!nextItem.stockByDepartment) nextItem.stockByDepartment = {};
                nextItem.stockByDepartment = { ...nextItem.stockByDepartment };
                
                const dept = consumptionDepartments[0] || 'Production Department';
                nextItem.stockByDepartment[dept] = Math.max(0, (nextItem.stockByDepartment[dept] || 0) - diff);
                nextItem.stock = Object.values(nextItem.stockByDepartment).reduce((sum, v) => sum + Number(v || 0), 0);
                return nextItem;
            }
            return item;
        });

        const allPlans = [...state.productionPlans];
        const planIndex = allPlans.findIndex(p => p.id === plan.id);
        
        if (planIndex !== -1) {
            allPlans[planIndex].consumptions = consumptionData;
            setCollection('items', updatedItems);
            setCollection('productionPlans', allPlans);
            setDirty(false);
            appAlert('Consumption data saved successfully!', 'success');
            onClose();
        }
    };

  const handleSaveAsBOM = async (itemCode, productName) => {
      if (await appConfirm(`Are you sure you want to save the current configuration as the standard BOM for ${productName}?`, 'Save Configuration', 'Save as BOM', 'Cancel')) {
          const itemCons = consumptionData[itemCode];
          if (!itemCons) {
              appAlert('No configuration found for this item.', 'error');
              return;
          }

          const planItem = plan.items.find(i => i.itemCode === itemCode);
          const outputQty = planItem ? (planItem.outputQty || planItem.quantity || 1) : 1;

          const buildPhase = (phaseKey) => {
              const phaseArr = [];
              if (itemCons.materials[phaseKey]) {
                  itemCons.materials[phaseKey].forEach(m => {
                      const val = (m.adjustedValue !== undefined && m.adjustedValue !== '') ? m.adjustedValue : m.value;
                      if (val && Number(val) > 0) {
                         phaseArr.push({ name: m.name, rmId: m.itemCode, itemCode: m.itemCode, quantity: Number(val) });
                      }
                  });
              }
              return phaseArr;
          };

          const dynamicPhases = {};
          if (itemCons.phaseConfig) {
              itemCons.phaseConfig.forEach(p => {
                  dynamicPhases[p.id] = buildPhase(p.id);
              });
          } else {
              dynamicPhases.top = buildPhase('top');
              dynamicPhases.foam = buildPhase('foam');
              dynamicPhases.adhesive = buildPhase('adhesive');
              dynamicPhases.packing = buildPhase('packing');
          }

          const fgItem = state.items.find(i => String(i.name) === String(productName) || String(i.sku) === String(itemCode));

          const newBom = {
              id: `BOM-${Date.now()}`,
              finishedGoodName: productName,
              finishedGoodId: fgItem ? fgItem.id : '',
              clothName: itemCons.clothName,
              clothWeight: itemCons.clothQuantity,
              batchSize: outputQty,
              status: 'Active',
              phaseConfig: itemCons.phaseConfig ? JSON.parse(JSON.stringify(itemCons.phaseConfig)) : undefined,
              phases: dynamicPhases,
              createdAt: new Date().toISOString()
          };

          const updatedBoms = state.boms ? [...state.boms] : [];
          const existingIdx = updatedBoms.findIndex(b => b.finishedGoodName === productName);
          
          if (existingIdx !== -1) {
              newBom.id = updatedBoms[existingIdx].id;
              updatedBoms[existingIdx] = newBom;
          } else {
              updatedBoms.push(newBom);
          }

          setCollection('boms', updatedBoms);
          appAlert(`BOM for ${productName} saved successfully.`, 'success');
      }
  };

  const downloadTemplate = () => {
      let rows = [];
      
      plan.items.forEach(item => {
          const bom = state.boms?.find(b => b.finishedGoodName === item.productName);
          
          rows.push([
              'Item Code', item.itemCode, 
              'Finished Good Name', item.productName, 
              'Production Target', item.outputQty || item.quantity, 
              'Cloth Name', bom ? (bom.clothName || 'None') : 'No Cloth Configured', 
              'Cloth Quantity', ''
          ]);
          
          let activePhases = [];
          if (bom && bom.phaseConfig) {
              activePhases = bom.phaseConfig.filter(p => p.enabled);
          } else {
              activePhases = [
                  { id: 'top', title: 'TOP Phase', type: 'Raw Material' },
                  { id: 'foam', title: 'FOAM Phase', type: 'Raw Material' },
                  { id: 'adhesive', title: 'ADHESIVE Phase', type: 'Raw Material' },
                  { id: 'packing', title: 'Packing Specs', type: 'Packing Material' }
              ];
          }

          let headers = [];
          activePhases.forEach(p => { headers.push(p.title.toUpperCase(), 'Quantity'); });
          rows.push(headers);
          
          let columns = [];
          activePhases.forEach(p => {
              if (bom && bom.phases && bom.phases[p.id]) {
                  columns.push(bom.phases[p.id]);
              } else if (bom && bom.materials && bom.materials[p.id]) {
                  columns.push(bom.materials[p.id]);
              } else {
                  const source = p.type === 'Packing Material' ? packingMaterials : genericMaterials;
                  const filteredSource = source.filter(m => {
                      if (m.consumptionPhases && Array.isArray(m.consumptionPhases)) {
                          return m.consumptionPhases.includes(p.id);
                      }
                      const isPacking = m.category === 'Packing Material' || m.type === 'Packing Material' || m.rawMaterialType === 'Packing' || (m.name && m.name.toLowerCase().includes('pack'));
                      const isCloth = m.category === 'Cloth' || m.type === 'Cloth' || m.rawMaterialType === 'Cloth' || (m.name && m.name.toLowerCase().includes('cloth'));
                      return p.type === 'Packing Material' ? isPacking : (!isCloth && !isPacking);
                  });
                  columns.push(filteredSource.map(m => ({ name: m.name })));
              }
          });

          const maxLen = columns.reduce((max, col) => Math.max(max, col.length), 1);
          
          for (let i = 0; i < maxLen; i++) {
              let row = [];
              columns.forEach(col => {
                  row.push(col[i] ? col[i].name : '', '');
              });
              rows.push(row);
          }
          rows.push(['END!', '', '', '', '', '', '', '', '', '']);
          rows.push(['', '', '', '', '', '', '', '', '', '']);
      });

      if (rows.length === 0) {
          appAlert("No items available to generate template.");
          return;
      }

      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Consumption_Template_${plan.id}.csv`);
      document.body.appendChild(link);
      link.click();
  };

  const handlePhaseUpdate = (itemCode, phaseId, updates) => {
      setConsumptionData(prev => {
          const updated = { ...prev };
          const targetItem = { ...updated[itemCode] };
          if (targetItem.phaseConfig) {
              targetItem.phaseConfig = targetItem.phaseConfig.map(p => p.id === phaseId ? { ...p, ...updates } : p);
          }
          updated[itemCode] = targetItem;
          return updated;
      });
      setDirty(true);
  };

  const handlePhaseDragStart = (e, itemCode, phaseIndex) => {
      e.dataTransfer.setData('phaseIndex', phaseIndex);
      e.dataTransfer.setData('itemCode', itemCode);
  };

  const handlePhaseDrop = (e, targetItemCode, dropIndex) => {
      const dragItemCode = e.dataTransfer.getData('itemCode');
      if (dragItemCode !== targetItemCode) return;
      const dragIndex = parseInt(e.dataTransfer.getData('phaseIndex'), 10);
      if (dragIndex === dropIndex) return;

      setConsumptionData(prev => {
          const updated = { ...prev };
          const targetItem = { ...updated[targetItemCode] };
          if (targetItem.phaseConfig) {
              const newPhases = [...targetItem.phaseConfig];
              const [moved] = newPhases.splice(dragIndex, 1);
              newPhases.splice(dropIndex, 0, moved);
              targetItem.phaseConfig = newPhases;
          }
          updated[targetItemCode] = targetItem;
          return updated;
      });
      setDirty(true);
  };

  const [newPhaseModal, setNewPhaseModal] = useState({ show: false, itemCode: '', name: '', type: '' });
  const rawMaterialTypes = Array.from(new Set(state.items.filter(i => i.category === 'Raw Material' || i.type === 'Raw Material').map(i => i.rawMaterialType || i.type || i.category))).filter(Boolean);
  if (!rawMaterialTypes.includes('Raw Material')) rawMaterialTypes.push('Raw Material');
  if (!rawMaterialTypes.includes('Packing Material')) rawMaterialTypes.push('Packing Material');

  const handleAddNewPhase = () => {
      if (!newPhaseModal.name || !newPhaseModal.type) {
          appAlert('Please provide both phase name and type.', 'error');
          return;
      }
      const itemCode = newPhaseModal.itemCode;
      const newId = `custom-${Date.now()}`;
      setConsumptionData(prev => {
          const updated = { ...prev };
          const targetItem = { ...updated[itemCode] };
          if (targetItem.phaseConfig) {
              targetItem.phaseConfig.push({
                  id: newId,
                  title: newPhaseModal.name,
                  tank: 'Custom',
                  unit: 'kg',
                  width: 420,
                  enabled: true,
                  type: newPhaseModal.type
              });
              // Init empty materials array
              targetItem.materials[newId] = [];
          }
          updated[itemCode] = targetItem;
          return updated;
      });
      setDirty(true);
      setNewPhaseModal({ show: false, itemCode: '', name: '', type: '' });
  };
  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const text = event.target.result;
          const rows = text.split('\n').map(r => r.split(','));
          
          const newConsumptionData = { ...consumptionData };
          
          let currentItemCode = null;
          let parsingBlocks = false;

          for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;
              
              if (row[0] && row[0].trim() === 'Item Code') {
                  currentItemCode = row[1] ? row[1].trim() : null;
                  const clothQty = row[9] ? row[9].trim() : '';
                  
                  if (currentItemCode && newConsumptionData[currentItemCode]) {
                      newConsumptionData[currentItemCode].clothQuantity = clothQty;
                      parsingBlocks = false;
                  }
              }
              else if (row[0] && row[0].trim() === 'TOP' && currentItemCode) {
                  parsingBlocks = true;
              }
              else if (row[0] && row[0].trim() === 'END!') {
                  currentItemCode = null;
                  parsingBlocks = false;
              }
              else if (parsingBlocks && currentItemCode) {
                  const mapVal = (phase, nameIdx, valIdx) => {
                      const name = row[nameIdx] ? row[nameIdx].trim() : '';
                      const val = row[valIdx] ? row[valIdx].trim() : '';
                      if (name && val && Number(val) > 0) {
                          const existingPhaseArray = newConsumptionData[currentItemCode].materials[phase];
                          const targetIdx = existingPhaseArray.findIndex(m => m.name === name);
                          if (targetIdx !== -1) {
                              existingPhaseArray[targetIdx].value = val;
                          }
                      }
                  };

                  mapVal('top', 0, 1);
                  mapVal('foam', 2, 3);
                  mapVal('adhesive', 4, 5);
                  mapVal('packing', 6, 7);
              }
          }
          
          setConsumptionData(newConsumptionData);
          setDirty(true);
          appAlert('CSV consumption data successfully populated into the form.', 'success');
          if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
  };

  const handleBack = async () => {
      if (isDirty) {
          const proceed = await appConfirm("Unsaved Changes Detected\n\nYou have unsaved progress in the current module. If you proceed, all unsaved entries will be discarded.\n\nAre you sure you wish to leave this screen without saving?", "Unsaved Progress", "Leave Without Saving", "Cancel & Stay");
          if (proceed) {
              setDirty(false);
              onClose();
          }
      } else {
          onClose();
      }
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300 relative h-full flex flex-col bg-background rounded-2xl overflow-hidden shadow-xl border border-outline-variant/20">
      <input 
          type="file" 
          accept=".csv" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileUpload}
      />

      <header className="px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 flex-shrink-0 z-10 relative bg-surface border-b border-outline-variant/10">
          <div className="flex items-center gap-4">
              <button onClick={handleBack} className="p-2 bg-surface-container-low hover:bg-surface-container rounded-full text-on-surface transition-colors flex items-center justify-center border border-outline-variant/30 font-bold hover:shadow-md">
                  <span className="material-symbols-outlined font-bold text-xl">arrow_back</span>
              </button>
              <div>
                  <h1 className="text-[2.75rem] font-headline font-extrabold text-on-surface tracking-tight leading-none mb-2">
                      {plan.consumptions && Object.keys(plan.consumptions).length > 0 ? 'Edit Consumption' : 'Production Consumption'}
                  </h1>
                  <p className="text-on-surface-variant font-body text-sm max-w-2xl">Record actual material quantities consumed against active production plans.</p>
              </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Department:</span>
                  <div className="w-[200px]">
                      <CustomMultiSelect
                          options={state.departments?.map(dept => ({ label: dept.label, value: dept.value })) || []}
                          selectedValues={consumptionDepartments}
                          onChange={setConsumptionDepartments}
                          placeholder="Select Depts"
                      />
                  </div>
              </div>
              <button onClick={downloadTemplate} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-surface-container-highest text-on-surface font-label font-semibold hover:bg-surface-dim transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-sm">download</span>
                  Download Template
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-surface-container-highest text-on-surface font-label font-semibold hover:bg-surface-dim transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-sm">upload</span>
                  Upload CSV
              </button>
              <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-br from-primary to-primary-container text-on-primary font-label font-semibold hover:opacity-90 transition-opacity shadow-[0_8px_16px_rgba(0,66,119,0.2)]">
                  <span className="material-symbols-outlined text-sm">save</span>
                  Record Consumption
              </button>
          </div>
      </header>

      <div className="flex-1 px-8 py-8 overflow-y-auto">
          <div className="flex flex-col gap-6">
              {plan.items.map(item => {
                  if (!consumptionData[item.itemCode]) return null;
                  const targetItem = consumptionData[item.itemCode];

                  return (
                      <article key={item.itemCode} className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_20px_40px_rgba(0,28,56,0.04)] outline outline-1 outline-outline-variant/15 flex flex-col gap-6 transition-all hover:shadow-[0_20px_40px_rgba(0,28,56,0.08)]">
                          <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-outline-variant/10">
                              <div className="flex items-center gap-6">
                                  <div className="flex flex-col items-start gap-1">
                                      <div className="flex items-center gap-2">
                                          <span className="block text-xs font-label text-on-surface-variant uppercase tracking-wider">Item Code</span>
                                          {state.boms?.some(b => b.finishedGoodName === item.productName) && (
                                              <button 
                                                  onClick={() => handleToggleMode(item.itemCode, manualModeItems[item.itemCode] || false, item)}
                                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors border ${manualModeItems[item.itemCode] ? 'bg-secondary-container text-on-secondary-fixed-variant border-secondary/20' : 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20'}`}
                                                  title="Toggle between BOM and Manual Entry mode"
                                              >
                                                  {manualModeItems[item.itemCode] ? 'Manual Mode' : 'BOM Mode'}
                                              </button>
                                          )}
                                      </div>
                                      <span className="font-headline font-bold text-on-surface text-lg">{item.itemCode}</span>
                                  </div>
                                  <div className="h-8 w-px bg-outline-variant/20"></div>
                                  <div>
                                      <span className="block text-xs font-label text-on-surface-variant mb-1 uppercase tracking-wider">Plan ID</span>
                                      <span className="font-body text-on-surface font-medium">{plan.id}</span>
                                  </div>
                              </div>
                              <div className="flex-1 min-w-[200px]">
                                  <span className="block text-xs font-label text-on-surface-variant mb-1 uppercase tracking-wider">Item Name</span>
                                  <span className="font-headline font-semibold text-primary">{item.productName}</span>
                              </div>
                              <div className="text-right flex flex-col items-end gap-2">
                                  <div>
                                      <span className="block text-xs font-label text-on-surface-variant mb-1 uppercase tracking-wider">Target Output</span>
                                      <span className="font-headline font-bold text-on-surface text-xl">{item.outputQty || item.quantity} <span className="text-sm font-body text-on-surface-variant font-normal">meters</span></span>
                                  </div>
                                  <button 
                                      onClick={() => handleSaveAsBOM(item.itemCode, item.productName)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary-container/50 text-on-secondary-container text-[11px] font-bold rounded-lg hover:bg-secondary-container transition-colors border border-secondary/20 shadow-sm"
                                  >
                                      <span className="material-symbols-outlined text-[14px]">save_as</span>
                                      Save as BOM
                                  </button>
                              </div>
                          </div>

                          <div className="overflow-x-auto pb-4 custom-scrollbar">
                              <div className="flex gap-6 w-max min-w-full">
                                  {(targetItem.phaseConfig || []).map((phase, pIdx) => {
                                      const materials = targetItem.materials[phase.id] || [];
                                      const total = materials.reduce((sum, m) => {
                                          const val = !manualModeItems[item.itemCode] && state.boms?.find(b => b.finishedGoodName === item.productName) && m.adjustedValue !== undefined && m.adjustedValue !== '' ? m.adjustedValue : m.value;
                                          return sum + (Number(val) || 0);
                                      }, 0);
                                      const selectionKey = `${item.itemCode}-${phase.id}`;
                                      
                                      return (
                                          <div 
                                              key={phase.id} 
                                              className={`flex-1 bg-surface/30 rounded-2xl p-4 border flex flex-col transition-all duration-300 relative ${!phase.enabled ? 'opacity-50 border-outline-variant/10' : 'border-outline-variant/20 shadow-sm'}`}
                                              style={{ minWidth: `${phase.width || 400}px`, maxWidth: `${phase.width || 420}px` }}
                                          >
                                              {/* Reorder handle */}
                                              <div 
                                                  draggable
                                                  onDragStart={(e) => handlePhaseDragStart(e, item.itemCode, pIdx)}
                                                  onDragOver={handleDragOver}
                                                  onDrop={(e) => handlePhaseDrop(e, item.itemCode, pIdx)}
                                                  className="absolute -top-3 left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing p-1 bg-surface hover:bg-surface-container-high rounded-full shadow-sm text-on-surface-variant border border-outline-variant/20 z-10"
                                                  title="Drag to reorder phase"
                                              >
                                                  <span className="material-symbols-outlined text-[16px]">drag_handle</span>
                                              </div>

                                              {/* Resize handle */}
                                              <div 
                                                  className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/10 z-10 transition-colors rounded-r-2xl"
                                                  onMouseDown={(e) => {
                                                      e.preventDefault();
                                                      const startX = e.clientX;
                                                      const startWidth = phase.width || 420;
                                                      const onMouseMove = (moveEvent) => {
                                                          const newWidth = Math.max(300, startWidth + (moveEvent.clientX - startX));
                                                          handlePhaseUpdate(item.itemCode, phase.id, { width: newWidth });
                                                      };
                                                      const onMouseUp = () => {
                                                          document.removeEventListener('mousemove', onMouseMove);
                                                          document.removeEventListener('mouseup', onMouseUp);
                                                      };
                                                      document.addEventListener('mousemove', onMouseMove);
                                                      document.addEventListener('mouseup', onMouseUp);
                                                  }}
                                                  title="Drag to resize table"
                                              />

                                              <div className="flex justify-between items-start mb-6 mt-3">
                                                  <div className="flex-1 mr-4">
                                                      <input 
                                                          className="text-xl font-bold font-headline text-on-surface bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary focus:outline-none w-full mb-1 transition-colors px-1 -ml-1 rounded-t"
                                                          value={phase.title}
                                                          onChange={(e) => handlePhaseUpdate(item.itemCode, phase.id, { title: e.target.value })}
                                                          title="Click to edit phase name"
                                                      />
                                                      <p className="text-xs text-on-surface-variant mt-1 px-1">{phase.tank || phase.type}</p>
                                                  </div>
                                                  <div className="flex items-start gap-2">
                                                      <button 
                                                          onClick={() => handlePhaseUpdate(item.itemCode, phase.id, { enabled: !phase.enabled })}
                                                          className={`p-1.5 rounded-lg transition-colors border shadow-sm ${phase.enabled ? 'bg-surface text-primary border-primary/20 hover:bg-primary/5' : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high'}`}
                                                          title={phase.enabled ? "Disable Phase" : "Enable Phase"}
                                                      >
                                                          <span className="material-symbols-outlined text-[18px] block">{phase.enabled ? 'visibility' : 'visibility_off'}</span>
                                                      </button>
                                                      <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg flex flex-col items-end">
                                                          <span className="text-[10px] font-bold uppercase tracking-wider">Total</span>
                                                          <span className="font-bold font-manrope">{total} {phase.unit || 'kg'}</span>
                                                      </div>
                                                  </div>
                                              </div>
                                              
                                              {phase.enabled && (
                                                <div className="flex flex-col gap-3 flex-1 relative z-0">
                                                    {materials.map((mat, idx) => {
                                                        const matItem = state.items.find(i => String(i.sku) === String(mat.itemCode) || String(i.id) === String(mat.itemCode));
                                                        const availableStock = matItem ? Number(matItem.stock || 0) : 0;
                                                        const requiredValue = Number(mat.adjustedValue !== undefined && mat.adjustedValue !== '' ? mat.adjustedValue : mat.value || 0);
                                                        const isShortage = consumptionDepartments.length > 0 && requiredValue > availableStock;
                                                        
                                                        return (
                                                        <div 
                                                            key={idx} 
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, item.itemCode, phase.id, idx)}
                                                            onDragOver={handleDragOver}
                                                            onDrop={(e) => handleDrop(e, item.itemCode, phase.id, idx)}
                                                            className={`bg-surface-container-lowest rounded-xl p-3 shadow-sm border flex items-center gap-3 cursor-move transition-all ${isShortage ? 'border-error/50 bg-error/5 ring-1 ring-error/30' : 'border-outline-variant/10 hover:border-primary/30'} ${draggedRow && draggedRow.itemCode === item.itemCode && draggedRow.phaseKey === phase.id && draggedRow.idx === idx ? 'opacity-50 ring-2 ring-primary' : ''}`}
                                                        >
                                                            <span className="material-symbols-outlined text-outline-variant text-[16px] cursor-grab active:cursor-grabbing">drag_indicator</span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm font-bold truncate ${isShortage ? 'text-error' : 'text-on-surface'}`} title={mat.name}>{mat.name}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <p className="text-[10px] text-on-surface-variant font-mono">{mat.itemCode || 'RM-N/A'}</p>
                                                                    {consumptionDepartments.length > 0 && (
                                                                        <span className={`text-[9px] font-bold px-1.5 rounded-sm ${isShortage ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                                                                            Stock: {availableStock}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {!manualModeItems[item.itemCode] && state.boms?.find(b => b.finishedGoodName === item.productName) ? (
                                                                    <>
                                                                        <div className="bg-surface-container-low/50 rounded-lg flex items-center px-2 py-1 w-20 opacity-70">
                                                                            <input className="w-full bg-transparent border-none text-right font-semibold text-xs p-1" type="number" value={mat.bomValue || mat.value} readOnly disabled title="Configured BOM Quantity" />
                                                                            <span className="text-[9px] font-bold text-on-surface-variant ml-1">{phase.unit || 'kg'}</span>
                                                                        </div>
                                                                        <div className={`bg-surface-container-low rounded-lg flex items-center px-2 py-1 focus-within:ring-1 focus-within:ring-secondary w-20 ${isShortage ? 'border border-error/50 bg-error/10' : ''}`} title="Adjust Final Quantity">
                                                                            <input 
                                                                                className={`w-full bg-transparent border-none text-right font-bold text-sm focus:ring-0 p-1 ${isShortage ? 'text-error placeholder-error/50' : 'text-secondary'}`} 
                                                                                type="number"
                                                                                placeholder="+/- 0"
                                                                                value={mat.adjustedValue !== undefined ? mat.adjustedValue : ''}
                                                                                onChange={(e) => handleRowChange(item.itemCode, phase.id, idx, 'adjustedValue', e.target.value)}
                                                                            />
                                                                            <span className={`text-[9px] font-bold ml-1 ${isShortage ? 'text-error' : 'text-secondary'}`}>{phase.unit || 'kg'}</span>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className={`bg-surface-container-low rounded-lg flex items-center px-2 py-1 focus-within:ring-1 focus-within:ring-primary w-24 ${isShortage ? 'border border-error/50 bg-error/10' : ''}`}>
                                                                        <input 
                                                                            className={`w-full bg-transparent border-none text-right font-semibold text-sm focus:ring-0 p-1 min-w-[40px] ${isShortage ? 'text-error' : ''}`} 
                                                                            type="number"
                                                                            value={mat.value}
                                                                            onChange={(e) => handleRowChange(item.itemCode, phase.id, idx, 'value', e.target.value)}
                                                                        />
                                                                        <span className="text-[10px] font-bold text-on-surface-variant ml-1">{phase.unit || 'kg'}</span>
                                                                    </div>
                                                                )}
                                                                <button 
                                                                    onClick={() => handleDeleteRow(item.itemCode, phase.id, idx)}
                                                                    className="text-error/60 hover:text-error hover:bg-error/10 p-1.5 rounded-md transition-colors flex-shrink-0 relative z-10"
                                                                    title="Remove Material"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px] block">delete</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )})}
                                                    {materials.length === 0 && (
                                                        <div className="text-center py-6 text-on-surface-variant/50 text-sm italic">
                                                            No items configured. Add manually below.
                                                        </div>
                                                    )}
                                                </div>
                                              )}
                                              
                                              {phase.enabled && (
                                                <div className="mt-4 pt-4 mt-auto relative z-0">
                                                    {!addSelections[selectionKey + '_mode'] ? (
                                                        <button 
                                                            onClick={() => setAddSelections(prev => ({ ...prev, [selectionKey + '_mode']: true }))}
                                                            className="w-full border border-dashed border-outline-variant/40 rounded-lg py-3 flex items-center justify-center gap-2 text-primary hover:bg-primary/5 transition-colors text-sm font-semibold relative z-10"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                                                            Add Row
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center gap-2 border border-outline-variant/20 rounded-lg p-2 bg-surface shadow-sm relative z-10">
                                                            <select 
                                                                className="flex-1 bg-transparent text-sm text-on-surface outline-none truncate"
                                                                value={addSelections[selectionKey] || ''}
                                                                onChange={(e) => setAddSelections(prev => ({ ...prev, [selectionKey]: e.target.value }))}
                                                                autoFocus
                                                            >
                                                                <option value="">+ Select Material</option>
                                                                {state.items.filter(i => String(i.category) === phase.type || String(i.type) === phase.type || String(i.rawMaterialType) === phase.type || (phase.type === 'Raw Material' && i.category === 'Raw Material')).map(m => (
                                                                    <option key={m.id || m.sku} value={m.sku || m.id}>{m.name}</option>
                                                                ))}
                                                            </select>
                                                            <button 
                                                                onClick={() => {
                                                                    handleAddRow(item.itemCode, phase.id);
                                                                    setAddSelections(prev => ({ ...prev, [selectionKey + '_mode']: false }));
                                                                }}
                                                                disabled={!addSelections[selectionKey]}
                                                                className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-md text-sm font-bold transition-colors disabled:opacity-50"
                                                            >
                                                                Add
                                                            </button>
                                                            <button
                                                                onClick={() => setAddSelections(prev => ({ ...prev, [selectionKey + '_mode']: false, [selectionKey]: '' }))}
                                                                className="text-on-surface-variant hover:text-error p-2"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">close</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                              )}
                                          </div>
                                      );
                                  })}

                                  <div className="flex-1 bg-surface/30 rounded-2xl p-4 border border-outline-variant/20 flex flex-col min-w-[400px] max-w-[420px]">
                                      <div className="flex justify-between items-start mb-6">
                                          <div>
                                              <h3 className="text-xl font-bold font-headline text-on-surface">Fabric</h3>
                                              <p className="text-xs text-on-surface-variant mt-1">Textile Layer</p>
                                          </div>
                                          <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg flex flex-col items-end">
                                              <span className="text-[10px] font-bold uppercase tracking-wider">Total</span>
                                              <span className="font-bold font-manrope">{targetItem.clothQuantity || 0} kg</span>
                                          </div>
                                      </div>
                                      <div className="flex flex-col gap-3">
                                          <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm border border-outline-variant/10 flex items-center gap-3">
                                              <span className="material-symbols-outlined text-outline-variant text-[16px]">drag_indicator</span>
                                              <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-bold text-on-surface truncate" title={targetItem.clothName}>{targetItem.clothName}</p>
                                                  <p className="text-[10px] text-on-surface-variant font-mono">CLOTH-RM</p>
                                              </div>
                                              <div className="flex items-center gap-2">
                                              {(() => {
                                                  const fabricItem = state.items?.find(i => String(i.name).toLowerCase() === String(targetItem.clothName).toLowerCase());
                                                  const quality = fabricItem?.clothQuality || 0;
                                                  
                                                  return (
                                                      <div className="flex items-center gap-2">
                                                          {/* KG Input */}
                                                          <div className="bg-surface-container-low rounded-lg flex items-center px-2 py-1 focus-within:ring-1 focus-within:ring-primary w-24">
                                                              <input 
                                                                  className="w-full bg-transparent border-none text-right font-semibold text-sm focus:ring-0 p-1 min-w-[40px]" 
                                                                  type="number"
                                                                  value={targetItem.clothQuantity}
                                                                  onChange={(e) => handleClothChange(item.itemCode, e.target.value)}
                                                                  disabled={targetItem.clothName === 'No back cloth defined for this item'}
                                                                  placeholder="0.0"
                                                              />
                                                              <span className="text-[10px] font-bold text-on-surface-variant ml-1">kg</span>
                                                          </div>

                                                          {/* Meters Input (Only if Quality factor is set > 0) */}
                                                          {quality > 0 && (
                                                              <>
                                                                  <span className="text-xs text-on-surface-variant select-none">/</span>
                                                                  <div className="bg-surface-container-low rounded-lg flex items-center px-2 py-1 focus-within:ring-1 focus-within:ring-primary w-24" title={`Cloth Yield: 1 KG = ${quality} Meters`}>
                                                                      <input 
                                                                          className="w-full bg-transparent border-none text-right font-semibold text-sm focus:ring-0 p-1 min-w-[40px]" 
                                                                          type="number"
                                                                          value={targetItem.clothQuantity ? (parseFloat(targetItem.clothQuantity) * quality).toFixed(2) : ''}
                                                                          onChange={(e) => {
                                                                              const val = parseFloat(e.target.value);
                                                                              if (isNaN(val) || val <= 0) {
                                                                                  handleClothChange(item.itemCode, '');
                                                                              } else {
                                                                                  handleClothChange(item.itemCode, (val / quality).toFixed(3));
                                                                              }
                                                                          }}
                                                                          disabled={targetItem.clothName === 'No back cloth defined for this item'}
                                                                          placeholder="0.0"
                                                                      />
                                                                      <span className="text-[10px] font-bold text-on-surface-variant ml-1">mtr</span>
                                                                  </div>
                                                              </>
                                                          )}
                                                          <div className="w-[10px]"></div>
                                                      </div>
                                                  );
                                              })()}</div>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="flex-1 bg-transparent flex items-center justify-center min-w-[200px] border border-dashed border-outline-variant/40 rounded-2xl hover:bg-surface/50 hover:border-primary/30 transition-all cursor-pointer group" onClick={() => setNewPhaseModal({ show: true, itemCode: item.itemCode, name: '', type: '' })}>
                                      <div className="text-center p-8">
                                          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                              <span className="material-symbols-outlined">add</span>
                                          </div>
                                          <h4 className="font-headline font-bold text-on-surface">Add New Phase</h4>
                                          <p className="text-xs text-on-surface-variant mt-1 max-w-[150px] mx-auto">Create a custom production step</p>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </article>
                  );
              })}
          </div>
      </div>

      {newPhaseModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-outline-variant/20">
                  <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-lowest">
                      <h3 className="font-headline font-bold text-xl text-on-surface">Add Custom Phase</h3>
                      <button onClick={() => setNewPhaseModal({ show: false, itemCode: '', name: '', type: '' })} className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-full hover:bg-error/10">
                          <span className="material-symbols-outlined text-xl block">close</span>
                      </button>
                  </div>
                  <div className="p-6 flex flex-col gap-5">
                      <div>
                          <label className="block text-sm font-label text-on-surface font-semibold mb-2">Phase Name</label>
                          <input 
                              type="text" 
                              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                              placeholder="e.g. Prep, Quality Control"
                              value={newPhaseModal.name}
                              onChange={(e) => setNewPhaseModal(prev => ({ ...prev, name: e.target.value }))}
                              autoFocus
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-label text-on-surface font-semibold mb-2">Raw Material Type</label>
                          <select 
                              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
                              value={newPhaseModal.type}
                              onChange={(e) => setNewPhaseModal(prev => ({ ...prev, type: e.target.value }))}
                          >
                              <option value="" disabled>Select material category</option>
                              {rawMaterialTypes.map(type => (
                                  <option key={type} value={type}>{type}</option>
                              ))}
                          </select>
                          <p className="text-xs text-on-surface-variant mt-2">The items list will be filtered by this type.</p>
                      </div>
                  </div>
                  <div className="px-6 py-4 bg-surface-container-lowest border-t border-outline-variant/10 flex items-center justify-end gap-3">
                      <button 
                          onClick={() => setNewPhaseModal({ show: false, itemCode: '', name: '', type: '' })}
                          className="px-5 py-2.5 rounded-xl text-on-surface-variant font-label font-bold hover:bg-surface-container transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={handleAddNewPhase}
                          disabled={!newPhaseModal.name || !newPhaseModal.type}
                          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                          Create Phase
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
