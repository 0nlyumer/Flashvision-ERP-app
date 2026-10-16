import React, { useState, useMemo, useEffect } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import CreateNewBOM from '../components/production/CreateNewBOM';
import BOMCalculator from '../components/production/BOMCalculator';
import PlanConsumption from '../components/production/PlanConsumption';
import BatchClosing from '../components/production/BatchClosing';
import BulkUploadModal from '../components/settings/BulkUploadModal';
import ResizableHeader from '../components/ui/ResizableHeader';
import ProductionHistoryModal from '../components/dashboard/ProductionHistoryModal';
import ItemLibrary from '../components/production/ItemLibrary';
import StockDemand from '../components/production/StockDemand';
import StockDemandHistory from '../components/production/StockDemandHistory';
import StockReceivingNote from '../components/production/StockReceivingNote';
import StockReceivingHistory from '../components/production/StockReceivingHistory';
import MasterBatchRecord from '../components/production/MasterBatchRecord';
import ConsumptionHistory from '../components/production/ConsumptionHistory';
import InvLedger from '../components/inventory/InvLedger';
import InvAdjustment from '../components/inventory/InvAdjustment';
import RawMaterialConfig from '../components/production/RawMaterialConfig';
import RawMaterialProduction from '../components/production/RawMaterialProduction';
import { useSearchParams } from 'react-router-dom';
import OtherConsumption from '../components/production/OtherConsumption';
import UniversalPrintStudioModal from '../components/ui/UniversalPrintStudioModal';

export default function ProductionModule() {
  const { state, setCollection, updateSaleOrderItemStatus, isDirty, setDirty, toggleGlobalPagination, updateProductionTarget } = useApp();
  const { appConfirm, appAlert } = useDialog();
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('tab') || 'master-batch-record';
  const [viewMode, setViewMode] = useState(initialView);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
       setViewMode(tabParam);
    }
  }, [searchParams]);

  const [uploadBOMOpen, setUploadBOMOpen] = useState(false);
  const [activePlanIdx, setActivePlanIdx] = useState(null);
  const [filterTab, setFilterTab] = useState('Active');
  const [addingManualRow, setAddingManualRow] = useState(false);
  const [manualProduct, setManualProduct] = useState('');
  const [manualQty, setManualQty] = useState(0);
  const [manualCode, setManualCode] = useState('');
  const [bomSearchStr, setBomSearchStr] = useState('');
  const [editBomData, setEditBomData] = useState(null);
  const [isViewOnlyBom, setIsViewOnlyBom] = useState(false);
  const [bomListView, setBomListView] = useState('list'); // 'list' | 'grid'
  
  const [editDemandData, setEditDemandData] = useState(null);
  const [isViewOnlyDemand, setIsViewOnlyDemand] = useState(false);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyType, setHistoryType] = useState('target');
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(state.productionTarget || 0);

  const [studioManifestPlan, setStudioManifestPlan] = useState(null);
  const [studioBomItem, setStudioBomItem] = useState(null);

  const manifestPrintData = useMemo(() => {
    if (!studioManifestPlan) return null;
    return {
      header: {
        manifest_no: studioManifestPlan.id || 'PM-001',
        plan_no: studioManifestPlan.id || 'PLAN-001',
        product_name: studioManifestPlan.items?.[0]?.productName || 'Multiple Products',
        batch_size: `${studioManifestPlan.items?.reduce((s, it) => s + (Number(it.outputQty || it.quantity) || 0), 0) || 0} M`,
        date: new Date().toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric'}),
        department: 'Production / Weaving',
        status: studioManifestPlan.status || 'In Process'
      },
      items: (studioManifestPlan.items || []).map((item, idx) => ({
        seq: idx + 1,
        item_code: item.itemCode || `ITM-${idx + 1}`,
        item_name: item.productName || item.name || '',
        roll_no: item.orderId || '-',
        target_qty: item.quantity || item.outputQty || 0,
        dispatched_qty: item.outputQty || item.quantity || 0,
        uom: 'M',
        remarks: item.customerName || 'Standard Production'
      }))
    };
  }, [studioManifestPlan]);

  const bomPrintData = useMemo(() => {
    if (!studioBomItem) return null;
    const bom = studioBomItem;
    const extractMaterials = () => {
      if (Array.isArray(bom.rawMaterials) && bom.rawMaterials.length > 0) return bom.rawMaterials;
      if (Array.isArray(bom.materials) && bom.materials.length > 0) return bom.materials;
      if (Array.isArray(bom.components) && bom.components.length > 0) return bom.components;
      if (bom.phases) {
        const out = [];
        ['top', 'foam', 'adhesive', 'packing'].forEach(phaseKey => {
          const list = bom.phases[phaseKey];
          if (Array.isArray(list)) {
            list.filter(p => p.value || p.quantity || p.qty).forEach(p => {
              out.push({
                code: p.rmId || p.itemCode || p.sku || '-',
                name: p.name || p.materialName || 'Material',
                qty: p.value || p.quantity || p.qty,
                uom: p.uom || p.unit || 'Kg',
                stage: phaseKey.charAt(0).toUpperCase() + phaseKey.slice(1)
              });
            });
          }
        });
        if (out.length > 0) return out;
      }
      return [];
    };

    const mats = extractMaterials();
    return {
      header: {
        bom_no: bom.id || `BOM-${bom.finishedGoodSku || '001'}`,
        product_name: bom.finishedGoodName || bom.name || 'Finished Good',
        product_code: bom.finishedGoodSku || '-',
        batch_size: `${bom.batchSize || 1000} ${bom.uom || 'M'}`,
        version: bom.version || 'v1.0',
        date: new Date().toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric'}),
        created_by: bom.createdBy || 'Production Supervisor'
      },
      items: mats.map((mat, idx) => ({
        step_no: idx + 1,
        item_code: mat.code || mat.sku || mat.itemCode || `RM-${idx + 1}`,
        material_name: mat.name || mat.materialName || 'Raw Material',
        qty_required: mat.qty || mat.target || mat.quantity || 0,
        uom: mat.uom || mat.unit || 'Kg',
        stage: mat.stage || 'Processing',
        cost: mat.cost || (mat.rate && mat.qty ? mat.rate * mat.qty : '-')
      }))
    };
  }, [studioBomItem]);

  const allPlans = state.productionPlans || [];

  const [returnViewMode, setReturnViewMode] = useState('orders');

  const handleViewChange = async (newView) => {
      if (isDirty) {
          const proceed = await appConfirm("Unsaved Changes Detected\n\nYou have unsaved progress in the current module. If you proceed, all unsaved entries will be discarded.\n\nAre you sure you wish to leave this screen without saving?", "Unsaved Progress", "Leave Without Saving", "Cancel & Stay");
          if (!proceed) return;
          setDirty(false);
      }
      if (newView === 'plan-consumption' || newView === 'create-bom') {
          setReturnViewMode(viewMode);
      }
      setViewMode(newView);
      if (newView !== 'plan-consumption') {
          setActivePlanIdx(null);
      }
      if (newView !== 'create-bom') {
          setEditBomData(null);
      }
      if (newView !== 'stock-demand') {
          setEditDemandData(null);
          setIsViewOnlyDemand(false);
      }
      setSearchParams({ tab: newView });
  };

  const tabs = [
      { id: 'master-batch-record', label: 'Master Batch Record', icon: 'assignment' },
      { id: 'orders', label: 'Production Orders', icon: 'precision_manufacturing' },
      { id: 'bom-master', label: 'BOM Master', icon: 'schema' },
      { id: 'bom-calculator', label: 'BOM Calculator', icon: 'calculate' },
      { id: 'batch-closing', label: 'Batch Closing', icon: 'done_all' },
      { id: 'item-library', label: 'Item Library', icon: 'category' },
      { id: 'stock-demand', label: 'Stock Demand', icon: 'assignment_add' },
      { id: 'stock-receiving-note', label: 'Stock Receiving Note', icon: 'inventory_2' },
      { id: 'consumption-history', label: 'Consumption History', icon: 'history' },
      { id: 'other-consumption', label: 'Other Consumption', icon: 'oil_barrel' },
      { id: 'ledger', label: 'Inventory Ledger', icon: 'receipt_long' },
      { id: 'adjustment', label: 'Inventory Adjustment', icon: 'tune' },
      { id: 'raw-material-config', label: 'Raw Material Config', icon: 'settings_suggest' },
      { id: 'raw-material-production', label: 'Raw Material Production', icon: 'manufacturing' },
  ];

  const subNavConfig = {
      title: 'Production',
      moduleName: 'productionPlanning',
      items: tabs,
      activeId: viewMode === 'stock-demand-history' ? 'stock-demand' : 
                viewMode === 'stock-receiving-history' ? 'stock-receiving-note' : 
                viewMode === 'create-bom' ? 'bom-master' : viewMode,
      onSelect: handleViewChange
  };

  const handleActivePlanBack = async () => {
      if (isDirty) {
          const proceed = await appConfirm("Unsaved Changes Detected\n\nYou have unsaved progress in the current module. If you proceed, all unsaved entries will be discarded.\n\nAre you sure you wish to leave this screen without saving?", "Unsaved Progress", "Leave Without Saving", "Cancel & Stay");
          if (!proceed) return;
          setDirty(false);
      }
      
      if (addingManualRow) {
          setAddingManualRow(false);
          setManualProduct('');
          setManualQty(0);
          setManualCode('');
          setActivePlanIdx(null);
      } else {
          setActivePlanIdx(null);
      }
  };

  const handleBOMUpload = (csvText) => {
      const rows = csvText.split('\n').filter(r => r.trim().length > 0).map(row => row.split(','));
      
      const newBoms = [];
      let currentBom = null;
      
      for(let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          if (row[0] && row[0].trim() === 'Finished Good Name') {
              if (currentBom) newBoms.push(currentBom);
              
              const fgName = row[1] ? row[1].trim() : '';
              const batchSize = row[3] ? row[3].trim() : '';
              const clothName = row[5] ? row[5].trim() : '';
              const clothWeight = row[7] ? row[7].trim() : '';
              
              if (!fgName) {
                  currentBom = null;
                  continue;
              }
              
              const fg = state.items.find(item => item.name.toLowerCase() === fgName.toLowerCase());
              if (fg) {
                  currentBom = {
                      id: `BOM-${Date.now()}-${fg.id}`,
                      finishedGoodId: fg.id,
                      batchSize: Number(batchSize),
                      clothName: clothName,
                      clothWeight: clothWeight, 
                      phases: { top: [], foam: [], adhesive: [], packing: [] },
                      createdAt: new Date().toISOString()
                  };
              } else {
                  currentBom = null; // Skip this block if FG not found
              }
              continue;
          }
          
          if (row[0] === 'TOP' && row[2] === 'FOAM') {
              continue; // Skip the phase headers
          }
          
          if (row[0] === 'END!') {
              if (currentBom) {
                  newBoms.push(currentBom);
                  currentBom = null;
              }
              continue;
          }
          
          if (currentBom) {
              const checkPhase = (itemName, itemQtyString, phaseArr) => {
                  if (itemName && itemQtyString) {
                      const qty = parseFloat(itemQtyString);
                      if (qty > 0) {
                          const rm = state.items.find(item => item.name.toLowerCase() === itemName.toLowerCase());
                          if (rm) phaseArr.push({ rmId: rm.id, value: itemQtyString });
                      }
                  }
              };
              
              checkPhase(row[0] ? row[0].trim() : '', row[1] ? row[1].trim() : '', currentBom.phases.top);
              checkPhase(row[2] ? row[2].trim() : '', row[3] ? row[3].trim() : '', currentBom.phases.foam);
              checkPhase(row[4] ? row[4].trim() : '', row[5] ? row[5].trim() : '', currentBom.phases.adhesive);
              checkPhase(row[6] ? row[6].trim() : '', row[7] ? row[7].trim() : '', currentBom.phases.packing);
          }
      }
      
      // Cleanup tail ends
      if (currentBom) newBoms.push(currentBom);

      if (newBoms.length > 0) {
         setCollection('boms', [...(state.boms || []), ...newBoms]);
         appAlert(`Successfully uploaded and created ${newBoms.length} BOM configurations!`);
      } else {
         appAlert(`No valid BOM entries were found. Please ensure Finished Good Names match exactly.`);
      }
  };
  const getGlobalMaxItemIndex = () => {
    let maxIdx = 0;
    const checkCode = (code) => {
        if (!code) return;
        const match = code.match(/ITM-(\d+)$/);
        if (match) {
            const idx = parseInt(match[1], 10);
            if (idx > maxIdx) maxIdx = idx;
        }
    };
    state.saleOrders?.forEach(o => o.items?.forEach(i => checkCode(i.itemCode)));
    state.productionPlans?.forEach(p => p.items?.forEach(i => checkCode(i.itemCode)));
    return maxIdx;
  };

  
  const filteredPlans = allPlans.filter(plan => {
      if (filterTab === 'All Orders') return true;
      if (filterTab === 'Active') return plan.status === 'In Process' || !plan.status;
      if (filterTab === 'Completed') return plan.status === 'Completed';
      return true;
  }).sort((a, b) => {
      const aHasCons = a.consumptions && Object.keys(a.consumptions).length > 0;
      const bHasCons = b.consumptions && Object.keys(b.consumptions).length > 0;
      if (aHasCons === bHasCons) {
          // Both have or both don't have, sort by date descending
          return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);
      }
      return aHasCons ? 1 : -1; // No consumption comes first
  });

  const isPaginated = state?.isGlobalPaginated;
  const totalPages = Math.ceil(filteredPlans.length / itemsPerPage) || 1;
  const displayedPlans = isPaginated 
      ? filteredPlans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      : filteredPlans;

  const handleRemoveItem = (planId, itemCode, orderId) => {
    if (window.confirm('Are you sure you want to remove this item from the production plan?')) {
      const planIndex = allPlans.findIndex(p => p.id === planId);
      if (planIndex !== -1) {
        const plan = { ...allPlans[planIndex] };
        
        // Find the item to revert its stock and status
        const itemToRemove = plan.items.find(i => i.itemCode === itemCode);
        if (itemToRemove) {
            // Update order status back to Pending
            updateSaleOrderItemStatus(itemToRemove.orderId, itemToRemove.itemCode, 'Pending');
            
            // Refund Fabric Stock
            if (itemToRemove.requiredFabricName && itemToRemove.requiredFabricName !== 'None') {
                let updatedItems = [...state.items];
                const productDef = updatedItems.find(i => i.name === itemToRemove.productName);
                if (productDef && productDef.requiredFabricId) {
                    const fabricDef = updatedItems.find(i => i.id === productDef.requiredFabricId);
                    if (fabricDef) {
                        const requiredQty = itemToRemove.quantity * (productDef.fabricRatio || 0);
                        const fabricIndex = updatedItems.findIndex(i => i.id === fabricDef.id);
                        if (fabricIndex !== -1) {
                            updatedItems[fabricIndex].stock += requiredQty;
                            setCollection('items', updatedItems);
                        }
                    }
                }
            }
        }
        
        // Remove item from plan
        plan.items = plan.items.filter(i => i.itemCode !== itemCode);
        
        const newPlans = [...allPlans];
        newPlans[planIndex] = plan;
        
        // Complete cleanup logic if plan goes empty
        if (plan.items.length === 0) {
           newPlans.splice(planIndex, 1);
           setActivePlanIdx(null);
        }

        setCollection('productionPlans', newPlans);
      }
    }
  };

  const getPendingProductionItems = () => {
    return (state.saleOrders || []).flatMap(order => 
        (order.items || [])
          .filter(item => item.status === 'Pending')
          .map(item => {
            const product = (state.items || []).find(i => i.id === item.itemId);
            return {
              ...item,
              orderId: order.id,
              date: order.date,
              customerId: order.customerId,
              customerName: (state.customers || []).find(c => c.id === order.customerId)?.name || order.customer || 'Unknown',
              productName: product?.name || 'Unknown',
              requiredFabricName: product?.requiredFabricId ? (state.items || []).find(i => i.id === product.requiredFabricId)?.name : 'None',
              fabricRatio: product?.fabricRatio || 0
            };
          })
      );
  };

  const handleAddItemToPlan = (planId, pendingItem) => {
     const planIndex = allPlans.findIndex(p => p.id === planId);
     if (planIndex !== -1) {
         
         // Setup Fabric Tracking/Deduction
         let updatedItems = [...state.items];
         if (pendingItem.requiredFabricName !== 'None') {
            const fabricRequiredQty = pendingItem.quantity * pendingItem.fabricRatio;
            const fabricIndex = updatedItems.findIndex(it => it.name === pendingItem.requiredFabricName);
            if (fabricIndex !== -1) {
                if (updatedItems[fabricIndex].stock < fabricRequiredQty) {
                    appAlert(`Not enough ${pendingItem.requiredFabricName} stock. Required: ${fabricRequiredQty}m, Available: ${updatedItems[fabricIndex].stock}m`);
                    return;
                }
                updatedItems[fabricIndex].stock -= fabricRequiredQty;
                setCollection('items', updatedItems);
            }
         }

         const plan = { ...allPlans[planIndex] };
         plan.items.push({
            orderId: pendingItem.orderId,
            customerName: pendingItem.customerName,
            orderDate: pendingItem.date,
            itemCode: pendingItem.itemCode,
            productName: pendingItem.productName,
            quantity: pendingItem.quantity,
            outputQty: pendingItem.quantity, // By default we assume full target if appended later
            remaining: 0,
            requiredFabricName: pendingItem.requiredFabricName
         });

         const newPlans = [...allPlans];
         newPlans[planIndex] = plan;
         setCollection('productionPlans', newPlans);
         
         updateSaleOrderItemStatus(pendingItem.orderId, pendingItem.itemCode, 'In Process');
         setShowAddModal(false); // Close Modal when added
     }
  };

  const handleUpdateItemOutput = (planId, itemCode, newOutputQty) => {
      const planIndex = allPlans.findIndex(p => p.id === planId);
      if (planIndex !== -1) {
          const plan = { ...allPlans[planIndex] };
          const itemIndex = plan.items.findIndex(i => i.itemCode === itemCode);
          if (itemIndex !== -1) {
             plan.items[itemIndex].outputQty = newOutputQty;
             const newPlans = [...allPlans];
             newPlans[planIndex] = plan;
             setCollection('productionPlans', newPlans);
          }
      }
  };

  const finishGoods = useMemo(() => state.items.filter(i => i.type === 'Finish Good' || i.category === 'Finished Goods' || i.type === 'Finished Goods' || i.productionAllowed === true), [state.items]);

  const handleCommitManualRow = async (planId) => {
      if (!manualProduct || manualQty <= 0) {
          appAlert('Please select a product and enter a valid quantity greater than 0.');
          return;
      }
      const confirmed = await appConfirm('Are you sure you want to save this item to the production plan?');
      if (!confirmed) {
          return;
      }

      const planIndex = allPlans.findIndex(p => p.id === planId);
      if (planIndex !== -1) {
          const productDef = finishGoods.find(i => i.name === manualProduct);
          const requiredFabricName = productDef?.requiredFabricId ? state.items.find(i => i.id === productDef.requiredFabricId)?.name : 'None';
          
          let updatedItems = [...state.items];
          if (requiredFabricName !== 'None') {
             const fabricRequiredQty = manualQty * (productDef.fabricRatio || 0);
             const fabricIndex = updatedItems.findIndex(it => it.name === requiredFabricName);
             if (fabricIndex !== -1) {
                 if (updatedItems[fabricIndex].stock < fabricRequiredQty) {
                     appAlert(`Not enough ${requiredFabricName} stock. Required: ${fabricRequiredQty}m, Available: ${updatedItems[fabricIndex].stock}m`);
                     return;
                 }
                 updatedItems[fabricIndex].stock -= fabricRequiredQty;
                 setCollection('items', updatedItems);
             }
          }

          const plan = { ...allPlans[planIndex] };
          const newItemCode = manualCode || `ITM-${String(getGlobalMaxItemIndex() + 1).padStart(3, '0')}`;
          plan.items.push({
             orderId: '-',
             customerName: 'Godown',
             orderDate: new Date().toISOString(),
             itemCode: newItemCode,
             productName: manualProduct,
             quantity: manualQty,
             outputQty: manualQty,
             remaining: 0,
             requiredFabricName: requiredFabricName
          });

          const newPlans = [...allPlans];
          newPlans[planIndex] = plan;
          setCollection('productionPlans', newPlans);
          
          setAddingManualRow(false);
          setManualProduct('');
          setManualQty(0);
          setManualCode('');
      }
  };


  const pendingItems = useMemo(() => getPendingProductionItems(), [state.saleOrders, state.items]);
  const activePlan = activePlanIdx !== null ? allPlans[activePlanIdx] : null;

  // Calculate current month specific stats
  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${now.getMonth()}`;

  const currentMonthPlans = filteredPlans.filter(plan => {
      const planDate = new Date(plan.date || plan.createdAt || new Date());
      return `${planDate.getFullYear()}-${planDate.getMonth()}` === currentMonthYear;
  });

  const currentMonthlyProduction = currentMonthPlans.reduce((sum, plan) => {
      const batchTypes = state.batchOutputTypes || [
          { id: 1, name: 'Finished Good', uom: 'Meters', category: 'Finish Good' },
          { id: 2, name: 'Wastage', uom: 'Kgs', category: 'Wastage' },
          { id: 3, name: 'B-Grade', uom: 'Meters', category: 'Finish Good' }
      ];
      return sum + (plan.items || []).reduce((s, item) => {
          const actualOut = (item.outputs || []).reduce((outSum, o) => {
              const typeObj = batchTypes.find(t => String(t.id) === String(o.typeId) || t.name === o.typeName);
              const isWastage = (typeObj && typeObj.category) 
                  ? typeObj.category === 'Wastage' 
                  : o.typeName?.toLowerCase().includes('wastage');
              return isWastage ? outSum : outSum + parseFloat(o.quantity || 0);
          }, 0);
          return s + actualOut;
      }, 0);
  }, 0);

  const totalCompletedItems = currentMonthPlans.reduce((sum, plan) => {
      return sum + (plan.items || []).filter(it => it.status === 'Completed' || plan.status === 'Completed').length;
  }, 0);

  const uniqueWorkingDays = new Set();
  currentMonthPlans.forEach(plan => {
      const planDate = new Date(plan.date || plan.createdAt || new Date());
      uniqueWorkingDays.add(planDate.toLocaleDateString());
  });
  const workingDaysInMonth = uniqueWorkingDays.size;

  const finishedGoodsList = state.items.filter(i => i.type === 'Finish Good' || i.category === 'Finished Goods');
  const filteredBOMGoods = finishedGoodsList.filter(fg => 
      fg.name.toLowerCase().includes(bomSearchStr.toLowerCase()) || 
      (fg.sku && fg.sku.toLowerCase().includes(bomSearchStr.toLowerCase()))
  );

  const getBOMStatus = (fgId) => {
      const boms = state.boms || [];
      return boms.find(b => b.finishedGoodId === fgId) ? true : false;
  };

  const handleDeleteBom = async (bomId, fgName) => {
      if (await appConfirm(`Are you sure you want to delete the BOM for ${fgName}? This action cannot be undone.`)) {
          const newBoms = (state.boms || []).filter(b => b.id !== bomId);
          setCollection('boms', newBoms);
          appAlert(`BOM for ${fgName} has been deleted.`, 'success');
      }
  };

  const getTotalProduction = (fgSku, fgName) => {
      let sum = 0;
      allPlans.forEach(plan => {
          (plan.items || []).forEach(item => {
              if (item.itemCode === fgSku || item.productName === fgName) {
                  sum += parseInt(item.outputQty || item.quantity || 0);
              }
          });
      });
      return sum;
  };

  const getLastProducedDate = (fgSku, fgName) => {
      let lastDate = null;
      allPlans.forEach(plan => {
          (plan.items || []).forEach(item => {
              if (item.itemCode === fgSku || item.productName === fgName) {
                  const d = new Date(item.orderDate || plan.date || plan.createdAt || new Date());
                  if (!lastDate || d > lastDate) {
                      lastDate = d;
                  }
              }
          });
      });
      return lastDate ? lastDate.toLocaleDateString('en-GB') : 'Never';
  };

  if (viewMode === 'create-bom') {
      return (
          <Layout subNavConfig={subNavConfig}>
              <CreateNewBOM 
                  initialBom={editBomData} 
                  isViewOnly={isViewOnlyBom}
                  onClose={() => { 
                      handleViewChange('bom-master'); 
                      setEditBomData(null); 
                      setIsViewOnlyBom(false);
                  }} 
              />
          </Layout>
      );
  }

  return (
    <Layout subNavConfig={subNavConfig}>
      <div className={`flex flex-col h-full animate-in fade-in duration-500 ${viewMode === 'plan-consumption' ? 'hidden' : ''}`}>
        
        {viewMode === 'batch-closing' && (
            <div className="space-y-8 w-full pb-10">
                <BatchClosing />
            </div>
        )}

        {viewMode === 'item-library' && (
            <div className="w-full flex-1 flex flex-col min-h-0">
                <ItemLibrary />
            </div>
        )}

        {viewMode === 'stock-demand' && (
            <div className="w-full pb-10 h-full min-h-[80vh] p-8">
                <StockDemand 
                    onHistoryClick={() => handleViewChange('stock-demand-history')} 
                    initialDemand={editDemandData}
                    isViewOnly={isViewOnlyDemand}
                />
            </div>
        )}

        {viewMode === 'stock-demand-history' && (
            <div className="w-full pb-10 h-full min-h-[80vh] p-8">
                <StockDemandHistory 
                    onNewRequestClick={() => {
                        setEditDemandData(null);
                        setIsViewOnlyDemand(false);
                        handleViewChange('stock-demand');
                    }}
                    onEditClick={(demand) => {
                        setEditDemandData(demand);
                        setIsViewOnlyDemand(false);
                        handleViewChange('stock-demand');
                    }}
                    onViewClick={(demand) => {
                        setEditDemandData(demand);
                        setIsViewOnlyDemand(true);
                        handleViewChange('stock-demand');
                    }}
                />
            </div>
        )}

        {viewMode === 'stock-receiving-note' && (
            <div className="w-full pb-10 h-full min-h-[80vh]">
                <StockReceivingNote onHistoryClick={() => handleViewChange('stock-receiving-history')} />
            </div>
        )}

        {viewMode === 'stock-receiving-history' && (
            <div className="w-full pb-10 h-full min-h-[80vh]">
                <StockReceivingHistory onNewReceiptClick={() => handleViewChange('stock-receiving-note')} />
            </div>
        )}

        {viewMode === 'consumption-history' && (
            <div className="w-full pb-10 h-full min-h-[80vh]">
                <ConsumptionHistory onEdit={(plan) => { 
                    const idx = state.productionPlans.findIndex(p => p.id === plan.id);
                    if (idx !== -1) {
                        setActivePlanIdx(idx); 
                        handleViewChange('plan-consumption'); 
                    }
                }} />
            </div>
        )}

        {viewMode === 'ledger' && (
            <div className="w-full pb-10 h-full min-h-[80vh]">
                <InvLedger onBack={() => handleViewChange('master-batch-record')} />
            </div>
        )}

        {viewMode === 'adjustment' && (
            <div className="w-full pb-10 h-full min-h-[80vh]">
                <InvAdjustment onBack={() => handleViewChange('master-batch-record')} />
            </div>
        )}

        {viewMode === 'raw-material-config' && (
            <div className="w-full pb-10 h-full min-h-[80vh]">
                <RawMaterialConfig />
            </div>
        )}

        {viewMode === 'raw-material-production' && (
            <div className="w-full pb-10 h-full min-h-[80vh]">
                <RawMaterialProduction />
            </div>
        )}

        {viewMode === 'other-consumption' && (
            <div className="w-full pb-10 h-full min-h-[80vh]">
                <OtherConsumption />
            </div>
        )}

        {!activePlan && viewMode !== 'batch-closing' && viewMode !== 'item-library' && viewMode !== 'stock-demand' && viewMode !== 'stock-demand-history' && viewMode !== 'stock-receiving-note' && viewMode !== 'stock-receiving-history' && viewMode !== 'consumption-history' && viewMode !== 'other-consumption' && viewMode !== 'ledger' && viewMode !== 'adjustment' && viewMode !== 'raw-material-config' && viewMode !== 'raw-material-production' && (
            <div className="space-y-8 w-full pb-10">
                {/* Top Tabs Moved to Left Sidebar */}

                {viewMode === 'bom-master' && (
                    <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-manrope">BOM Master Setup</h2>
                                <p className="text-on-surface-variant mt-1 text-sm">Manage Bill of Materials formulations for all registered Finished Goods</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setUploadBOMOpen(true)} className="flex items-center gap-2 px-6 py-2.5 border border-primary/20 hover:border-primary/40 text-primary hover:bg-primary/5 rounded-xl shadow-sm text-sm font-bold transition-all hover:scale-[1.02]">
                                    <span className="material-symbols-outlined text-[20px]">upload_file</span>
                                    BOM Upload
                                </button>
                                <button onClick={() => handleViewChange('bom-calculator')} className="flex items-center gap-2 px-6 py-2.5 bg-secondary-container/50 border border-secondary/20 hover:bg-secondary-container hover:border-secondary/40 text-on-secondary-container rounded-xl shadow-sm text-sm font-bold transition-all hover:scale-[1.02]">
                                    <span className="material-symbols-outlined text-[20px]">calculate</span>
                                    Calculator
                                </button>
                                <button onClick={() => { setEditBomData(null); handleViewChange('create-bom'); }} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-xl shadow-sm text-sm font-bold hover:shadow-[0_4px_12px_rgba(0,66,119,0.2)] transition-all ring-1 ring-primary-fixed/30 hover:scale-[1.02]">
                                    <span className="material-symbols-outlined text-[20px]">add</span>
                                    Create BOM
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex gap-4 items-center w-full max-w-xl">
                            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-sm p-4 flex justify-between items-center flex-1">
                                <span className="material-symbols-outlined text-on-surface-variant px-3 py-1">search</span>
                                <input 
                                    type="text"
                                    placeholder="Search finished goods by name or SKU..."
                                    value={bomSearchStr}
                                    onChange={(e) => setBomSearchStr(e.target.value)}
                                    className="w-full bg-transparent border-none outline-none text-sm font-medium text-on-surface"
                                />
                            </div>
                            <div className="flex bg-surface-container-low rounded-xl p-1 border border-outline-variant/30 shrink-0">
                                <button onClick={() => setBomListView('list')} className={`p-2 rounded-lg flex items-center justify-center transition-colors ${bomListView === 'list' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`} title="List View">
                                    <span className="material-symbols-outlined text-[20px]">view_list</span>
                                </button>
                                <button onClick={() => setBomListView('grid')} className={`p-2 rounded-lg flex items-center justify-center transition-colors ${bomListView === 'grid' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`} title="Grid View">
                                    <span className="material-symbols-outlined text-[20px]">grid_view</span>
                                </button>
                            </div>
                        </div>

                        {bomListView === 'list' ? (
                            <div className="overflow-hidden border border-outline-variant/30 rounded-3xl bg-surface-container-lowest flex flex-col shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-surface-container-low border-b border-outline-variant/30 text-on-surface-variant">
                                            <tr>
                                                <ResizableHeader className="font-semibold px-6 py-4">Item Code</ResizableHeader>
                                                <ResizableHeader className="font-semibold px-6 py-4">Finished Good Name</ResizableHeader>
                                                <ResizableHeader className="font-semibold px-6 py-4">Last Produced Date</ResizableHeader>
                                                <ResizableHeader className="font-semibold px-6 py-4">Total Production (Meters)</ResizableHeader>
                                                <ResizableHeader className="font-semibold px-6 py-4">BOM Status</ResizableHeader>
                                                <ResizableHeader className="font-semibold px-6 py-4 text-right">Actions</ResizableHeader>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-outline-variant/20">
                                            {filteredBOMGoods.map((fg, index) => {
                                                const bomRef = state.boms?.find(b => b.finishedGoodId === fg.id);
                                                const hasBOM = !!bomRef;
                                                return (
                                                    <tr key={index} className="hover:bg-surface-container/30 transition-colors group">
                                                        <td className="px-6 py-4 text-on-surface font-medium">{fg.sku || '-'}</td>
                                                        <td className="px-6 py-4 text-on-surface font-semibold">{fg.name}</td>
                                                        <td className="px-6 py-4 text-on-surface-variant font-medium">
                                                            <div className="flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[16px] opacity-70">calendar_today</span>
                                                                {getLastProducedDate(fg.sku, fg.name)}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-on-surface-variant font-medium">
                                                            <div className="flex items-center gap-1">
                                                                {getTotalProduction(fg.sku, fg.name).toLocaleString()} M
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${hasBOM ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30'}`}>
                                                                {hasBOM ? <><span className="material-symbols-outlined text-[14px]">check_circle</span> Configured</> : <><span className="material-symbols-outlined text-[14px]">pending</span> Pending</>}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {hasBOM ? (
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            setIsViewOnlyBom(true);
                                                                            setEditBomData(bomRef);
                                                                            handleViewChange('create-bom');
                                                                        }}
                                                                        className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary hover:text-on-primary transition-colors text-xs font-bold inline-flex items-center gap-1"
                                                                        title="View BOM"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px]">visibility</span> View
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setIsViewOnlyBom(false);
                                                                            setEditBomData(bomRef);
                                                                            handleViewChange('create-bom');
                                                                        }}
                                                                        className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary hover:text-on-primary transition-colors text-xs font-bold inline-flex items-center gap-1"
                                                                        title="Edit BOM"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px]">edit</span> Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setStudioBomItem({ ...bomRef, finishedGoodName: fg.name, finishedGoodSku: fg.sku });
                                                                        }}
                                                                        className="px-3 py-1.5 rounded-lg border border-secondary/30 text-secondary hover:bg-secondary hover:text-on-secondary transition-colors text-xs font-bold inline-flex items-center gap-1"
                                                                        title="Print BOM"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px]">print</span> Print
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteBom(bomRef.id, fg.name)}
                                                                        className="p-1.5 rounded-lg border border-error/50 text-error hover:bg-error hover:text-white transition-colors flex items-center justify-center ml-2"
                                                                        title="Delete BOM"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-on-surface-variant/50 italic">Available after creation</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {filteredBOMGoods.length === 0 && (
                                        <div className="text-center py-10 text-on-surface-variant font-medium flex gap-2 flex-col items-center">
                                            <span className="material-symbols-outlined text-4xl opacity-50">inventory_2</span>
                                            No matching finished goods found
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredBOMGoods.map((fg, index) => {
                                    const bomRef = state.boms?.find(b => b.finishedGoodId === fg.id);
                                    const hasBOM = !!bomRef;
                                    return (
                                        <div key={index} className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="text-xs font-bold text-on-surface-variant mb-1">{fg.sku || 'NO-SKU'}</div>
                                                    <div className="text-lg font-bold text-on-surface">{fg.name}</div>
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${hasBOM ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30'}`}>
                                                    {hasBOM ? 'Configured' : 'Pending'}
                                                </span>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-2xl">
                                                <div>
                                                    <div className="text-xs font-medium text-on-surface-variant mb-1">Last Produced</div>
                                                    <div className="text-sm font-semibold text-on-surface">{getLastProducedDate(fg.sku, fg.name)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs font-medium text-on-surface-variant mb-1">Total Prod.</div>
                                                    <div className="text-sm font-semibold text-on-surface">{getTotalProduction(fg.sku, fg.name).toLocaleString()} M</div>
                                                </div>
                                            </div>
                                            
                                            <div className="mt-auto pt-4 border-t border-outline-variant/20">
                                                {hasBOM ? (
                                                    <div className="flex justify-between gap-2">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setIsViewOnlyBom(true);
                                                                    setEditBomData(bomRef);
                                                                    handleViewChange('create-bom');
                                                                }}
                                                                className="px-3 py-2 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-xs font-bold inline-flex items-center gap-1"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">visibility</span> View
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setIsViewOnlyBom(false);
                                                                    setEditBomData(bomRef);
                                                                    handleViewChange('create-bom');
                                                                }}
                                                                className="px-3 py-2 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-xs font-bold inline-flex items-center gap-1"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">edit</span> Edit
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setStudioBomItem({ ...bomRef, finishedGoodName: fg.name, finishedGoodSku: fg.sku });
                                                                }}
                                                                className="px-3 py-2 rounded-xl bg-secondary/5 text-secondary hover:bg-secondary/10 transition-colors text-xs font-bold inline-flex items-center gap-1"
                                                                title="Print BOM"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">print</span>
                                                            </button>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeleteBom(bomRef.id, fg.name)}
                                                            className="p-2 rounded-xl bg-error/5 text-error hover:bg-error/10 transition-colors flex items-center justify-center"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-2">
                                                        <span className="text-xs text-on-surface-variant/50 italic">Available after BOM creation</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredBOMGoods.length === 0 && (
                                    <div className="col-span-full text-center py-10 text-on-surface-variant font-medium flex gap-2 flex-col items-center">
                                        <span className="material-symbols-outlined text-4xl opacity-50">inventory_2</span>
                                        No matching finished goods found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {viewMode === 'bom-calculator' && (
                    <BOMCalculator 
                        onClose={() => setViewMode('bom-master')}
                    />
                )}

                {viewMode === 'master-batch-record' && <MasterBatchRecord />}
            {viewMode === 'orders' && (
                    <>
                        {/* Page Header Section */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in duration-300">
                            <div className="space-y-1">
                        <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase">
                            <span className="material-symbols-outlined text-sm">precision_manufacturing</span>
                            Manufacturing Workflow
                        </div>
                        <h2 className="text-4xl font-extrabold text-on-surface tracking-tight font-manrope">Production Orders</h2>
                        <p className="text-on-surface-variant max-w-lg">Manage and monitor active production cycles from approved plans to final completion.</p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 px-4 py-2 rounded-full shadow-sm text-sm font-medium text-on-surface hover:border-outline-variant/50 cursor-pointer transition-colors">
                            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">calendar_month</span>
                            All Time
                            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">keyboard_arrow_down</span>
                        </div>
                        <div className="flex items-center gap-1 bg-surface-container-low p-1.5 rounded-full">
                            {['All Orders', 'Active', 'Completed'].map(tab => (
                                <button 
                                    key={tab}
                                    onClick={() => setFilterTab(tab)}
                                    className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all ${filterTab === tab ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bento Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div 
                        className="col-span-1 md:col-span-2 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-[0_20px_40px_rgba(0,28,56,0.03)] flex justify-between items-center group cursor-pointer hover:border-primary/40 transition-colors"
                        onClick={() => { setHistoryType('target'); setHistoryModalOpen(true); }}
                    >
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-on-surface-variant">Total Production Output (Metres)</p>
                            <div className="flex items-end gap-2">
                                <p className="text-3xl font-black text-on-surface tracking-tighter font-manrope">{currentMonthlyProduction.toLocaleString()} <span className="text-sm font-normal text-on-surface-variant">Metres</span></p>
                                <p className="text-sm font-medium text-on-surface-variant mb-1">/ {state.productionTarget?.toLocaleString() || 0} M</p>
                            </div>
                            
                            {isEditingTarget ? (
                                <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                                    <input 
                                        type="number" 
                                        className="bg-surface-container p-1 rounded border border-primary/30 w-24 text-sm"
                                        value={tempTarget}
                                        onChange={e => setTempTarget(e.target.value)}
                                        autoFocus
                                    />
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateProductionTarget(Number(tempTarget));
                                            setIsEditingTarget(false);
                                        }} 
                                        className="text-primary hover:bg-primary/10 p-1 rounded text-xs font-bold"
                                    >
                                        Save
                                    </button>
                                </div>
                            ) : (
                                <div 
                                    className="text-xs font-bold text-primary cursor-pointer hover:underline w-fit inline-flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-full"
                                    onClick={(e) => { e.stopPropagation(); setIsEditingTarget(true); }}
                                >
                                    <span className="material-symbols-outlined text-[14px]">edit</span> Edit Target
                                </div>
                            )}
                        </div>
                        <div className="h-16 w-32 relative">
                            {/* Visual placeholder for a sparkline */}
                            <div className="absolute inset-0 flex items-end gap-1">
                                <div className="flex-1 bg-primary-fixed h-1/3 rounded-t-sm"></div>
                                <div className="flex-1 bg-primary-fixed h-2/3 rounded-t-sm"></div>
                                <div className="flex-1 bg-primary-container h-1/2 rounded-t-sm"></div>
                                <div className="flex-1 bg-primary-fixed h-full rounded-t-sm"></div>
                                <div className="flex-1 bg-primary-container h-3/4 rounded-t-sm"></div>
                            </div>
                        </div>
                    </div>
                    <div 
                        className="bg-surface-container p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-between cursor-pointer hover:border-tertiary-fixed-variant/40 transition-colors group"
                        onClick={() => { setHistoryType('items'); setHistoryModalOpen(true); }}
                    >
                        <div className="flex justify-between items-start">
                            <span className="material-symbols-outlined text-on-tertiary-fixed-variant" style={{fontVariationSettings: "'FILL' 1"}}>inventory_2</span>
                            <span className="material-symbols-outlined text-on-surface-variant/50 text-sm opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-xs uppercase tracking-widest font-bold text-on-tertiary-fixed-variant/60">Total Items</p>
                            <p className="text-2xl font-bold font-manrope">{totalCompletedItems.toLocaleString()}</p>
                        </div>
                    </div>
                    <div 
                        className="bg-secondary-container/30 p-6 rounded-3xl border border-outline-variant/10 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors group"
                        onClick={() => { setHistoryType('days'); setHistoryModalOpen(true); }}
                    >
                        <div className="flex justify-between items-start">
                            <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'wght' 700"}}>calendar_today</span>
                            <span className="material-symbols-outlined text-on-surface-variant/50 text-sm opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-xs uppercase tracking-widest font-bold text-primary/60">Working Days</p>
                            <p className="text-2xl font-bold font-manrope">{workingDaysInMonth}</p>
                        </div>
                    </div>
                </div>

                {/* Orders Table Section */}
                <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_20px_40px_rgba(0,28,56,0.06)] overflow-hidden border border-outline-variant/10">
                    <div className="px-8 py-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface/50">
                        <h3 className="font-bold text-lg font-manrope">Active Production Registry</h3>
                        <div className="flex items-center gap-4">
                            <button className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-lg">filter_list</span>
                                Advanced Filter
                            </button>
                            <button className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-lg">download</span>
                                Export CSV
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-surface-container-low dark:bg-[#121620]">
                                    <ResizableHeader className="font-semibold px-6 py-4">Plan ID</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4">Creation Date</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4">Plan Date</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4">Status</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4">Consumption</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4">Items / Products</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 text-right">Actions</ResizableHeader>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/20">
                                {displayedPlans.length > 0 ? displayedPlans.map((plan, i) => {
                                    const actualIndex = allPlans.findIndex(p => p.id === plan.id);
                                    const products = plan.items?.map(i => i.productName).join(', ') || 'Unknown';
                                    const hasConsumption = plan.consumptions && Object.keys(plan.consumptions).length > 0;
                                    
                                    return (
                                        <tr key={plan.id} className="group hover:bg-surface-container-lowest/50 transition-colors">
                                            <td className="px-6 py-6 font-bold text-primary">{plan.id}</td>
                                            <td className="px-6 py-6 font-medium text-on-surface-variant text-sm">{plan.createdAt ? new Date(plan.createdAt).toLocaleString() : (plan.date || new Date().toISOString().split('T')[0])}</td>
                                            <td className="px-6 py-6 font-medium text-on-surface-variant text-sm">{new Date(plan.date || new Date()).toLocaleDateString()}</td>
                                            <td className="px-6 py-6">
                                                {plan.status === 'Completed' ? (
                                                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary/10 text-tertiary text-xs font-bold w-fit border border-tertiary/20">
                                                        <span className="material-symbols-outlined text-xs" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                                                        Completed
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold w-fit border border-primary/20">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                                        {plan.status || 'In Process'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-6">
                                                {hasConsumption ? (
                                                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary/10 text-tertiary text-xs font-bold w-fit border border-tertiary/20">
                                                        <span className="material-symbols-outlined text-xs" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                                                        Added
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-bold w-fit border border-warning/20">
                                                        <span className="material-symbols-outlined text-xs">pending_actions</span>
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-6 text-sm font-semibold text-on-surface max-w-[200px] truncate" title={products}>
                                                {products}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="group-hover:opacity-100 flex items-center justify-end gap-2 transition-opacity">
                                                    {!hasConsumption && (
                                                        <button onClick={() => { setActivePlanIdx(actualIndex); }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-primary border border-primary/20 hover:bg-primary/5 rounded-md transition-colors">
                                                            <span className="material-symbols-outlined text-[16px]">open_in_new</span> Open
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="6" className="py-20 text-center text-on-surface-variant">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="material-symbols-outlined text-4xl opacity-30 mb-3" style={{fontVariationSettings: "'FILL' 1"}}>assignment</span>
                                                <p className="font-semibold text-base text-on-surface">No Plans Found</p>
                                                <p className="text-sm opacity-80 mt-1">There are no plans matching the selected filter.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-8 py-4 bg-surface-container-low/30 border-t border-outline-variant/10 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-on-surface-variant">Showing {displayedPlans.length} of {filteredPlans.length} production orders</span>
                            
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
                </>
                )}
            </div>
        )}

        {/* Existing Detail View Panels */}
        {activePlan && viewMode === 'orders' && (
            <div className="flex flex-col md:ml-0 w-full relative animate-in fade-in zoom-in-95 duration-300">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 mt-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                        <div onClick={handleActivePlanBack} className="flex items-center gap-2 px-3 py-1 bg-surface-container-low hover:bg-surface-container-high rounded-full text-on-surface-variant cursor-pointer transition-colors text-sm font-semibold mr-2 shadow-sm border border-outline-variant/10">
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            Back
                        </div>
                        <h2 className="font-headline text-display-md text-on-surface tracking-tight" style={{fontSize: "2.75rem", lineHeight: 1.1}}>{activePlan.id}</h2>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary/20">
                            <span className="w-2 h-2 rounded-full bg-tertiary mr-2 animate-pulse"></span>
                            {activePlan.status || 'In Process'}
                        </span>
                        </div>
                        <p className="text-on-surface-variant font-medium text-lg ml-[90px]">Production Order Details</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setViewMode('plan-consumption')} className="px-6 py-3 rounded-xl font-semibold bg-tertiary-container text-on-tertiary-container hover:bg-tertiary-container/80 transition-colors flex items-center gap-2 shadow-sm border border-tertiary/20">
                            <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                            Record Consumption
                        </button>
                        <button 
                            onClick={() => setStudioManifestPlan(activePlan)}
                            className="px-6 py-3 rounded-xl font-semibold text-primary border border-outline-variant/20 hover:bg-surface-container-low transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[20px]">print</span>
                            Print Manifest
                        </button>
                        <button onClick={handleActivePlanBack} className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-[0_10px_20px_rgba(0,66,119,0.15)] hover:shadow-[0_15px_30px_rgba(0,66,119,0.2)] transition-shadow flex items-center gap-2 ring-1 ring-primary-fixed/30">
                            <span className="material-symbols-outlined text-[20px]">save</span>
                            Save & Close
                        </button>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-surface-container-lowest rounded-xl shadow-[0_20px_40px_rgba(0,28,56,0.02)] overflow-hidden border border-outline-variant/10">
                    <div className="flex justify-between items-center p-6 border-b border-outline-variant/10 bg-surface/30">
                        <h3 className="text-on-surface font-bold text-lg font-headline">Production Manifest</h3>
                        <button onClick={() => {
                            setAddingManualRow(true);
                            const maxIdx = getGlobalMaxItemIndex();
                            setManualCode(`ITM-${String(maxIdx + 1).padStart(3, '0')}`);
                        }} className="text-primary font-semibold text-sm hover:text-primary-container transition-colors flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-4 py-2 rounded-full border border-primary/10">
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            Add New Item
                        </button>
                    </div>
                    <div className="overflow-x-auto min-h-[350px]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-surface-container-low dark:bg-[#121620]">
                                    <th className="py-4 px-6 text-on-surface-variant text-xs font-bold uppercase tracking-wider">Sale Order #</th>
                                    <th className="py-4 px-6 text-on-surface-variant text-xs font-bold uppercase tracking-wider">Order Date</th>
                                    <th className="py-4 px-6 text-on-surface-variant text-xs font-bold uppercase tracking-wider">Item Code</th>
                                    <th className="py-4 px-6 text-on-surface-variant text-xs font-bold uppercase tracking-wider">Item Name</th>
                                    <th className="py-4 px-6 text-on-surface-variant text-xs font-bold uppercase tracking-wider">Customer Name</th>
                                    <th className="py-4 px-6 text-on-surface-variant text-xs font-bold uppercase tracking-wider">BOM Configured</th>
                                    <th className="py-4 px-6 text-on-surface-variant text-xs font-bold uppercase tracking-wider text-right">Production Meters</th>
                                    <th className="py-4 px-6 text-on-surface-variant text-xs font-bold uppercase tracking-wider text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-outline-variant/5">
                                {addingManualRow && (
                                    <tr className="bg-primary/5 transition-colors group">
                                        <td className="py-4 px-6 font-bold text-on-surface text-center">-</td>
                                        <td className="py-4 px-6 font-medium text-on-surface-variant">{new Date().toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric'})}</td>
                                        <td className="py-4 px-6 font-mono text-xs font-semibold text-primary/80 bg-primary/5 rounded px-2 w-max inline-block mt-3 ml-4">{manualCode}</td>
                                        <td className="py-4 px-6 font-bold text-on-surface">
                                            <select 
                                                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded p-1 text-sm focus:border-primary focus:ring-0"
                                                value={manualProduct}
                                                onChange={(e) => setManualProduct(e.target.value)}
                                            >
                                                <option value="">Select Finish Good...</option>
                                                {finishGoods.map(fg => (
                                                    <option key={fg.id} value={fg.name}>{fg.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-4 px-6 text-on-surface-variant font-medium text-center">Godown</td>
                                        <td className="py-4 px-6 text-center">-</td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="inline-flex items-center bg-surface-container-lowest rounded-lg p-1 border border-primary/40 focus-within:border-primary transition-all shadow-[0_0_0_2px_rgba(0,66,119,0.1)]">
                                                <input 
                                                    className="w-24 bg-transparent border-none text-right font-black font-manrope text-on-surface focus:ring-0 text-sm p-1" 
                                                    type="number" 
                                                    value={manualQty}
                                                    onChange={(e) => setManualQty(Number(e.target.value))}
                                                />
                                                <span className="text-[10px] font-bold text-outline px-2 tracking-widest">M</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button 
                                                    onClick={() => handleCommitManualRow(activePlan.id)}
                                                    className="text-primary hover:bg-primary/10 p-2 rounded-full transition-all"
                                                    title="Save New Item"
                                                >
                                                    <span className="material-symbols-outlined text-[20px] block">check</span>
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setAddingManualRow(false);
                                                        setManualProduct('');
                                                        setManualQty(0);
                                                        setManualCode('');
                                                    }}
                                                    className="text-error/60 hover:text-error hover:bg-error/10 p-2 rounded-full transition-all"
                                                    title="Cancel"
                                                >
                                                    <span className="material-symbols-outlined text-[20px] block">close</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {activePlan.items?.length > 0 ? activePlan.items.map(item => (
                                    <tr key={item.itemCode} className="hover:bg-surface-container-low/30 transition-colors group">
                                        <td className="py-4 px-6 font-bold text-on-surface">{item.orderId}</td>
                                        <td className="py-4 px-6 font-medium text-on-surface-variant">{new Date(item.orderDate || Date.now()).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric'})}</td>
                                        <td className="py-4 px-6 font-mono text-xs font-semibold text-primary/80 bg-primary/5 rounded px-2 w-max inline-block mt-3 ml-4">{item.itemCode}</td>
                                        <td className="py-4 px-6 font-bold text-on-surface">{item.productName}</td>
                                        <td className="py-4 px-6 text-on-surface-variant font-medium">
                                            {(() => {
                                                const so = state.saleOrders?.find(s => s.id === item.orderId);
                                                const customer = so ? state.customers?.find(c => c.id === so.customerId) : null;
                                                return customer?.name || so?.customerName || item.customerName || 'Unknown';
                                            })()}
                                        </td>
                                        <td className="py-4 px-6">
                                            {(() => {
                                                const hasBOM = !!state.boms?.find(b => b.finishedGoodName === item.productName);
                                                return (
                                                    <span className={`px-3 py-1 rounded-md text-xs font-bold inline-flex items-center gap-1 ${hasBOM ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30'}`}>
                                                        {hasBOM ? <><span className="material-symbols-outlined text-[12px]">check_circle</span> Yes</> : <><span className="material-symbols-outlined text-[12px]">close</span> No</>}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="inline-flex items-center bg-surface-container rounded-lg p-1 border border-outline-variant/20 focus-within:border-primary focus-within:bg-secondary-container/20 transition-all focus-within:shadow-[0_0_0_2px_rgba(0,66,119,0.1)]">
                                                <input 
                                                    className="w-24 bg-transparent border-none text-right font-black font-manrope text-on-surface focus:ring-0 text-sm p-1" 
                                                    type="number" 
                                                    value={item.outputQty || item.quantity || 0}
                                                    onChange={(e) => handleUpdateItemOutput(activePlan.id, item.itemCode, e.target.value)}
                                                />
                                                <span className="text-[10px] font-bold text-outline px-2 tracking-widest">M</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <button 
                                                onClick={() => handleRemoveItem(activePlan.id, item.itemCode, item.orderId)}
                                                className="text-error/60 hover:text-error hover:bg-error/10 p-2 rounded-full transition-all"
                                                title="Remove Item from Plan"
                                            >
                                                <span className="material-symbols-outlined text-[20px] block">delete</span>
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" className="py-20 text-center text-on-surface-variant">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="material-symbols-outlined text-4xl opacity-30 mb-3" style={{fontVariationSettings: "'FILL' 1"}}>inbox</span>
                                                <p className="font-semibold text-base text-on-surface">Manifest Empty</p>
                                                <p className="text-sm opacity-80 mt-1">Add items to begin executing this production plan.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        )}

      </div>

      {viewMode === 'plan-consumption' && activePlan && (
          <PlanConsumption 
              plan={activePlan}
              onClose={() => handleViewChange(returnViewMode)}
          />
      )}

      <BulkUploadModal 
        isOpen={uploadBOMOpen}
        onClose={() => setUploadBOMOpen(false)}
        entityName="BOMs"
        onUpload={handleBOMUpload}
      />
      
      <ProductionHistoryModal 
          isOpen={historyModalOpen}
          onClose={() => setHistoryModalOpen(false)}
          type={historyType}
      />

      {studioManifestPlan && manifestPrintData && (
        <UniversalPrintStudioModal
          isOpen={Boolean(studioManifestPlan)}
          onClose={() => setStudioManifestPlan(null)}
          documentType="production_manifest"
          documentData={manifestPrintData}
          documentTitle={`Production Manifest - ${studioManifestPlan.id || 'Order'}`}
        />
      )}

      {studioBomItem && bomPrintData && (
        <UniversalPrintStudioModal
          isOpen={Boolean(studioBomItem)}
          onClose={() => setStudioBomItem(null)}
          documentType="bom_master"
          documentData={bomPrintData}
          documentTitle={`Bill of Materials - ${studioBomItem.finishedGoodName || 'BOM'}`}
        />
      )}
    </Layout>
  );
}
