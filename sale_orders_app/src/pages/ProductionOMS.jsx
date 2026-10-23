import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';

import OmsFilter from '../components/oms/OmsFilter';
import OmsClothRequirement from '../components/oms/OmsClothRequirement';
import OmsSelection from '../components/oms/OmsSelection';
import OmsAdjustment from '../components/oms/OmsAdjustment';
import OmsSlip from '../components/oms/OmsSlip';
import OmsHistory from '../components/oms/OmsHistory';

export default function ProductionOMS() {
  const [activeTab, setActiveTab] = useState('filter');
  const [isAdjustingPlan, setIsAdjustingPlan] = useState(false);
  const [selectedPlanItems, setSelectedPlanItems] = useState([]); // Tracking selection
  const [editingPlanId, setEditingPlanId] = useState(null); // Track plan being edited
  const [editingPlanDate, setEditingPlanDate] = useState(''); // Track plan date
  const { state, updateSaleOrderItemStatus, setCollection } = useApp();

  const pendingItems = useMemo(() => {
    // 1. Sale order items
    const soPending = (state.saleOrders || []).flatMap(order => 
      (order.items || [])
        .map(item => {
            const statusLower = (item.status || '').toLowerCase();
            if (statusLower !== 'pending' && statusLower !== 'in process' && statusLower !== 'in production') return null;
            
            const remainingToPlan = (item.quantity || 0) - (item.producedQty || 0);
            if (remainingToPlan <= 0) return null;

            return { ...item, remainingToPlan, orderId: order.id, date: order.date, customerId: order.customerId };
        })
        .filter(Boolean)
    );

    // 2. Custom stock items
    const customPending = (state.customOmsItems || [])
        .map(item => {
            const statusLower = (item.status || '').toLowerCase();
            if (statusLower !== 'pending' && statusLower !== 'in process' && statusLower !== 'in production') return null;
            
            const remainingToPlan = (item.quantity || 0) - (item.producedQty || 0);
            if (remainingToPlan <= 0) return null;

            return { 
                ...item, 
                remainingToPlan, 
                orderId: item.id, 
                date: item.date, 
                customerId: 'FOR STOCK', 
                customerName: 'FOR STOCK' 
            };
        })
        .filter(Boolean);

    return [...soPending, ...customPending].map(item => {
        const product = (state.items || []).find(i => i.id === item.itemId || i.sku === item.itemCode);
        let requiredFabric = null;
        let fabricStock = 0;
        let fabricRequiredQty = 0;
        if (product && product.requiredFabricId) {
          requiredFabric = (state.items || []).find(i => i.id === product.requiredFabricId);
          fabricStock = requiredFabric?.stock || 0;
          fabricRequiredQty = (item.remainingToPlan * (product.fabricRatio || 0));
        }

        return {
          ...item,
          quantity: item.remainingToPlan,
          originalQuantity: item.quantity,
          productName: item.productName || product?.name || 'Unknown',
          requiredFabricName: requiredFabric?.name || 'None',
          requiredFabricId: requiredFabric?.id || '',
          fabricStock,
          fabricRequiredQty,
          hasShortage: requiredFabric ? fabricStock < fabricRequiredQty : false
        };
    });
  }, [state.saleOrders, state.customOmsItems, state.productionPlans, state.items]);

  const allFilterItems = useMemo(() => {
    // 1. Sale order items
    const soItems = (state.saleOrders || []).flatMap(order => 
      (order.items || [])
        .map(item => {
          const product = (state.items || []).find(i => i.id === item.itemId);
          let requiredFabric = null;
          let fabricStock = 0;
          let fabricRequiredQty = 0;
          if (product && product.requiredFabricId) {
            requiredFabric = (state.items || []).find(i => i.id === product.requiredFabricId);
            fabricStock = requiredFabric?.stock || 0;
            fabricRequiredQty = (item.quantity * (product.fabricRatio || 0));
          }

          return {
            ...item,
            orderId: order.id,
            date: order.date,
            customerId: order.customerId,
            customerName: (state.customers || []).find(c => c.id === order.customerId)?.name || order.customer || 'Unknown',
            productName: product?.name || 'Unknown',
            requiredFabricName: requiredFabric?.name || 'None',
            requiredFabricId: requiredFabric?.id || '',
            fabricStock,
            fabricRequiredQty,
            hasShortage: requiredFabric ? fabricStock < fabricRequiredQty : false,
            isCustom: false
          };
        })
    );

    // 2. Custom OMS items (FOR STOCK)
    const customOmsItemsList = (state.customOmsItems || []).map(item => {
      const product = (state.items || []).find(i => i.id === item.itemId || i.sku === item.itemCode);
      let requiredFabric = null;
      let fabricStock = 0;
      let fabricRequiredQty = 0;
      if (product && product.requiredFabricId) {
        requiredFabric = (state.items || []).find(i => i.id === product.requiredFabricId);
        fabricStock = requiredFabric?.stock || 0;
        fabricRequiredQty = (item.quantity * (product.fabricRatio || 0));
      }

      return {
        ...item,
        orderId: item.id, // Keep the custom id as orderId internally
        date: item.date,
        customerId: 'FOR STOCK',
        customerName: 'FOR STOCK',
        productName: product?.name || item.productName || 'Unknown',
        requiredFabricName: requiredFabric?.name || 'None',
        requiredFabricId: requiredFabric?.id || '',
        fabricStock,
        fabricRequiredQty,
        hasShortage: requiredFabric ? fabricStock < fabricRequiredQty : false,
        isCustom: true
      };
    });

    // 3. Manual items added to production plans (orderId === '-')
    const manualPlanItems = [];
    (state.productionPlans || []).forEach(plan => {
      (plan.items || []).forEach(pi => {
        const isManual = pi.orderId === '-' || !(state.saleOrders || []).some(o => o.id === pi.orderId);
        if (isManual) {
          // Prevent duplicates by checking if we already added it
          const itemKey = `${plan.id}:::${pi.itemCode}`;
          const existing = manualPlanItems.find(x => x.itemKey === itemKey);
          if (!existing) {
            const product = (state.items || []).find(i => i.sku === pi.itemCode || i.name === pi.productName);
            
            // Calculate produced quantity for this item in this plan
            const batchTypes = state.batchOutputTypes || [
                { id: 1, name: 'Finished Good', uom: 'Meters', category: 'Finish Good' },
                { id: 2, name: 'Wastage', uom: 'Kgs', category: 'Wastage' },
                { id: 3, name: 'B-Grade', uom: 'Meters', category: 'Finish Good' }
            ];
            const producedQty = (pi.outputs || []).reduce((sum, o) => {
                const typeObj = batchTypes.find(t => String(t.id) === String(o.typeId) || t.name === o.typeName);
                const isWastage = typeObj ? typeObj.category === 'Wastage' : o.typeName?.toLowerCase().includes('wastage');
                return isWastage ? sum : sum + (parseFloat(o.quantity) || 0);
            }, 0);

            manualPlanItems.push({
              id: itemKey,
              itemCode: pi.itemCode,
              productName: pi.productName,
              quantity: pi.quantity,
              producedQty: producedQty,
              status: plan.status === 'Completed' ? 'Completed' : 'In Process',
              orderId: '-',
              date: pi.orderDate || plan.date || plan.createdAt || new Date().toISOString(),
              customerId: 'FOR STOCK',
              customerName: 'FOR STOCK',
              isManualPlanItem: true,
              itemKey: itemKey,
              requiredFabricName: pi.requiredFabricName || 'None',
              fabricStock: 0,
              fabricRequiredQty: 0,
              hasShortage: false
            });
          }
        }
      });
    });

    return [...soItems, ...customOmsItemsList, ...manualPlanItems];
  }, [state.saleOrders, state.customOmsItems, state.productionPlans, state.items, state.batchOutputTypes]);

  const activeRuns = state.productionPlans || [];

  const handleStartRuns = (itemsToRun, planDate) => {

    // Batch process items
    let updatedItems = [...(state.items || [])];
    const planItems = itemsToRun.map(pItem => {
      // We don't deduct stock again if we are just editing and stock was already deducted
      // But for simplicity, we assume editing a plan doesn't change requiredFabricQty or we handle it if needed.
      // Currently, we'll only deduct if it's a NEW plan.
      if (!editingPlanId && pItem.requiredFabricName !== 'None') {
        const fabricIndex = updatedItems.findIndex(it => it.name === pItem.requiredFabricName);
        if (fabricIndex !== -1) {
             updatedItems[fabricIndex] = { 
                 ...updatedItems[fabricIndex], 
                 stock: updatedItems[fabricIndex].stock - pItem.fabricRequiredQty 
             };
        }
      }
      
      updateSaleOrderItemStatus(pItem.orderId, pItem.itemCode, 'In Process', 0, pItem.lineCode || null);

      return {
        orderId: pItem.orderId,
        customerName: pItem.customerId === 'FOR STOCK'
          ? 'FOR STOCK'
          : ((state.customers || []).find(c => c.id === pItem.customerId)?.name || pItem.customer || 'Unknown'),
        orderDate: pItem.date,
        itemCode: pItem.itemCode,
        lineCode: pItem.lineCode || null,
        productName: pItem.productName,
        quantity: pItem.quantity,
        outputQty: pItem.producedQty || pItem.quantity,
        remaining: pItem.producedQty || pItem.quantity,
        requiredFabricName: pItem.requiredFabricName || 'None',
        fabricRequiredQty: pItem.fabricRequiredQty || 0,
        requiredFabricId: pItem.requiredFabricId || '',
        customerId: pItem.customerId
      };
    });

    if (editingPlanId) {
      // Update existing plan
      const updatedPlans = activeRuns.map(plan => {
        if (plan.id === editingPlanId) {
          return {
            ...plan,
            date: planDate,
            items: planItems
          };
        }
        return plan;
      });
      setCollection('productionPlans', updatedPlans);
    } else {
      // Create new plan
      const newIdNo = activeRuns.length + 1;
      const newPlan = {
        id: `PLN-${String(newIdNo).padStart(3, '0')}`,
        date: planDate,
        createdAt: new Date().toISOString(),
        createdBy: state.currentUser?.name || 'System Admin',
        items: planItems,
        progress: 0,
        status: 'In Process'
      };
      setCollection('items', updatedItems);
      setCollection('productionPlans', [...activeRuns, newPlan]);
    }
    
    // Jump straight to History
    setIsAdjustingPlan(false);
    setEditingPlanId(null);
    setEditingPlanDate('');
    setActiveTab('history');
  };

  const tabs = [
    { id: 'filter', label: 'Filter Sale Orders', icon: 'filter_alt' },
    { id: 'planning', label: 'Production Planning', icon: 'build' },
    { id: 'history', label: 'Planning History', icon: 'history' },
    { id: 'cloth', label: 'Cloth Requirement', icon: 'dry_cleaning' }
  ];

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
     const tab = searchParams.get('tab');
     if (tab && tabs.find(t => t.id === tab)) {
         setActiveTab(tab);
     }
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
    if (tabId !== 'planning') {
        setIsAdjustingPlan(false);
        setEditingPlanId(null);
        setEditingPlanDate('');
    }
  };

  const subNavConfig = {
      title: "OMS",
      items: tabs,
      activeId: activeTab,
      onSelect: handleTabChange
  };

  const triggerPlanAdjustment = (selected) => {
    setSelectedPlanItems(selected || []);
    setEditingPlanId(null);
    setEditingPlanDate('');
    setIsAdjustingPlan(true);
  };

  const triggerEditPlan = (planId) => {
    const plan = activeRuns.find(p => p.id === planId);
    if (plan) {
      // Restore items as if they were selected
      const mappedItems = (plan.items || []).map(pItem => ({
        ...pItem,
        date: pItem.orderDate,
        customerId: pItem.customerId || '', // Need to map if available
        quantity: pItem.quantity,
        producedQty: pItem.outputQty
      }));
      setSelectedPlanItems(mappedItems);
      setEditingPlanId(plan.id);
      setEditingPlanDate(plan.date.split('T')[0]); // yyyy-mm-dd format
      setIsAdjustingPlan(true);
      setActiveTab('planning');
    }
  };

  return (
    <Layout subNavConfig={subNavConfig}>
      <div className="flex flex-col h-full">
        <div className="flex-1">
            {activeTab === 'filter' && <OmsFilter pendingItems={allFilterItems} customers={state.customers || []} />}
            {activeTab === 'planning' && !isAdjustingPlan && (
                <OmsSelection 
                   pendingItems={pendingItems} 
                   customers={state.customers || []}
                   handlePlanProduction={triggerPlanAdjustment} 
                />
            )}
            {activeTab === 'planning' && isAdjustingPlan && (
                <OmsAdjustment 
                   pendingItems={selectedPlanItems.length > 0 ? selectedPlanItems : pendingItems} 
                   handleStartRun={handleStartRuns} 
                   onCancel={() => { setIsAdjustingPlan(false); setEditingPlanId(null); setEditingPlanDate(''); }}
                   editingPlanDate={editingPlanDate}
                />
            )}
            {activeTab === 'history' && <OmsHistory completedRuns={activeRuns} onEditPlan={triggerEditPlan} />}
            {activeTab === 'cloth' && <OmsClothRequirement />}
        </div>
      </div>
    </Layout>
  );
}
