import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';

export default function DepartmentSettings() {
  const { state, setState } = useApp();
  const { appAlert, appConfirm } = useDialog();

  const departments = state.departments || [];
  const items = state.items || [];

  // Form States
  const [editingId, setEditingId] = useState(null); // null means adding new
  const [deptName, setDeptName] = useState('');
  const [allowedTypes, setAllowedTypes] = useState({
    'Finished Goods': true,
    'Raw Material': false
  });
  
  // Selected Item IDs state (local to form)
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Clean form helper
  const handleResetForm = () => {
    setEditingId(null);
    setDeptName('');
    setAllowedTypes({
      'Finished Goods': true,
      'Raw Material': false
    });
    setSelectedItemIds([]);
    setSearchQuery('');
  };

  // When editing, populate form
  const handleEdit = (dept) => {
    setEditingId(dept.id);
    const nameVal = dept.name || dept.label || '';
    setDeptName(nameVal);
    
    const typesMap = {
      'Finished Goods': false,
      'Raw Material': false
    };
    if (dept.itemTypes && Array.isArray(dept.itemTypes)) {
      dept.itemTypes.forEach(t => {
        if (typesMap[t] !== undefined) typesMap[t] = true;
      });
    } else {
      // Fallback
      typesMap['Finished Goods'] = true;
    }
    setAllowedTypes(typesMap);

    // Get current items assigned to this department
    const assignedIds = items
      .filter(item => {
        const itemDepts = (item.department || '').split(',').map(d => d.trim()).filter(Boolean);
        return itemDepts.includes(nameVal);
      })
      .map(item => item.id);
    setSelectedItemIds(assignedIds);
    setSearchQuery('');
  };

  // Filter items matching the allowed types
  const activeTypes = Object.keys(allowedTypes).filter(t => allowedTypes[t]);
  const filteredItems = items.filter(item => {
    // Match type
    const matchesType = activeTypes.includes(item.category || item.type);
    if (!matchesType) return false;
    
    // Match search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (item.name || '').toLowerCase().includes(q);
      const skuMatch = (item.sku || '').toLowerCase().includes(q);
      return nameMatch || skuMatch;
    }
    return true;
  });

  const handleToggleItem = (itemId) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredItems.map(item => item.id);
    setSelectedItemIds(prev => {
      // Add all filteredIds that aren't already present
      const next = [...prev];
      filteredIds.forEach(id => {
        if (!next.includes(id)) next.push(id);
      });
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    const filteredIds = filteredItems.map(item => item.id);
    setSelectedItemIds(prev => prev.filter(id => !filteredIds.includes(id)));
  };

  // Save/Submit Handler
  const handleSave = (e) => {
    e.preventDefault();
    const cleanName = deptName.trim();
    if (!cleanName) {
      appAlert('Department Name is required.', 'error');
      return;
    }

    // Check duplicate name (handles both string and object elements)
    const isDuplicate = departments.some(d => {
      const name = typeof d === 'object' ? (d.name || d.label || '') : d;
      const id = typeof d === 'object' ? d.id : null;
      return id !== editingId && name.trim().toLowerCase() === cleanName.toLowerCase();
    });
    if (isDuplicate) {
      appAlert('A department with this name already exists. Please choose a unique name.', 'error');
      return;
    }

    // Create the department object
    const selectedTypesArray = Object.keys(allowedTypes).filter(t => allowedTypes[t]);

    const deptId = editingId || 'DEP-' + Date.now();
    const originalDept = departments.find(d => d.id === editingId);
    const originalName = originalDept ? (originalDept.name || originalDept.label) : '';

    const newDept = {
      id: deptId,
      name: cleanName,
      label: cleanName,
      value: cleanName,
      itemTypes: selectedTypesArray,
      itemIds: selectedItemIds,
      disabled: false
    };

    // Update Departments Array
    let updatedDepts = [...departments];
    if (editingId) {
      const idx = updatedDepts.findIndex(d => d.id === editingId);
      if (idx > -1) updatedDepts[idx] = newDept;
    } else {
      updatedDepts.push(newDept);
    }

    // Update Items Array supporting multiple departments
    const updatedItems = items.map(item => {
      let depts = (item.department || '').split(',').map(d => d.trim()).filter(Boolean);
      
      // Clean up previous naming configurations
      depts = depts.filter(d => d !== cleanName && d !== originalName);
      
      // If selected, append it back
      if (selectedItemIds.includes(item.id)) {
        depts.push(cleanName);
      }
      
      return {
        ...item,
        department: depts.join(', ')
      };
    });

    // NOTE (Omer, 2026-10-25): stock-department saves used to also push
    // the department into HR's own list ('hr_departments_config'). That
    // cross-write is removed — HR keeps its canonical five departments
    // and stock departments are managed only here.

    // Save back to collections in a single batch state transaction to avoid Supabase sync race conditions
    setState(prev => ({
      ...prev,
      departments: updatedDepts,
      items: updatedItems
    }));

    appAlert(editingId ? 'Department updated successfully!' : 'Department created successfully!', 'success');
    handleResetForm();
  };

  // Delete Handler
  const handleDelete = async (dept) => {
    const name = dept.name || dept.label;
    const count = items.filter(item => {
      const itemDepts = (item.department || '').split(',').map(d => d.trim()).filter(Boolean);
      return itemDepts.includes(name);
    }).length;

    const proceed = await appConfirm(
      `Are you sure you want to delete the department "${name}"?\n\nThis department contains ${count} items. Deleting it will clear the department mapping for these items.`,
      "Delete Department",
      "Delete",
      "Cancel"
    );

    if (proceed) {
      // Remove from departments
      const updatedDepts = departments.filter(d => d.id !== dept.id);
      
      // Clear this specific department from items' multi-department listing
      const updatedItems = items.map(item => {
        let depts = (item.department || '').split(',').map(d => d.trim()).filter(Boolean);
        depts = depts.filter(d => d !== name);
        return {
          ...item,
          department: depts.join(', ')
        };
      });

      // NOTE (Omer, 2026-10-25): deleting a STOCK department no longer
      // deletes anything from HR's own department list — the two lists
      // are independent (see the save handler note above).

      // Save back to collections in a single batch state transaction to avoid Supabase sync race conditions
      setState(prev => ({
        ...prev,
        departments: updatedDepts,
        items: updatedItems
      }));
      appAlert(`Department "${name}" deleted successfully.`, 'success');

      if (editingId === dept.id) {
        handleResetForm();
      }
    }
  };

  return (
    <div className="bg-surface rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10 w-full">
      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-outline-variant/15">
        
        {/* Left Form Column */}
        <div className="flex-1 p-8 space-y-6 bg-surface-container-lowest">
          <header className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px]">corporate_fare</span>
              Manage Departments
            </div>
            
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-3xl font-black text-on-surface tracking-tight font-manrope">
                {editingId ? 'Edit Department' : 'Create Department'}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Create New
                </button>
              )}
            </div>
            
            <p className="text-on-surface-variant text-sm font-semibold">
              Configure department profiles, select allowed item categories, and map specific items.
            </p>
          </header>

          <hr className="border-outline-variant/15" />

          <form onSubmit={handleSave} className="space-y-6">
            {/* Department Name */}
            <div className="relative group w-full">
              <input 
                required
                type="text" 
                value={deptName} 
                onChange={e => setDeptName(e.target.value)}
                placeholder="e.g. Stitching Division" 
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all"
              />
              <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-black uppercase tracking-wider text-primary">
                Department Name
              </label>
            </div>

            {/* Allowed Item Types (Checkboxes) */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Allowed Item Types
              </span>
              <div className="flex flex-wrap gap-4">
                {Object.keys(allowedTypes).map(type => (
                  <label key={type} className="flex items-center gap-2.5 px-4 py-3 bg-surface border border-outline-variant/20 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors select-none">
                    <input 
                      type="checkbox"
                      checked={allowedTypes[type]}
                      onChange={() => setAllowedTypes(prev => ({
                        ...prev,
                        [type]: !prev[type]
                      }))}
                      className="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary"
                    />
                    <span className="text-xs font-bold text-on-surface-variant">{type}s</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Allowed Items Selection Grid */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Select Associated Items ({selectedItemIds.length} Selected)
                </span>
                {filteredItems.length > 0 && (
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={handleSelectAllFiltered}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Select All ({filteredItems.length})
                    </button>
                    <span className="text-[10px] text-slate-300">|</span>
                    <button 
                      type="button" 
                      onClick={handleDeselectAllFiltered}
                      className="text-[10px] font-bold text-rose-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                )}
              </div>

              {/* Items Search Input */}
              <div className="relative group w-full">
                <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-slate-400">search</span>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search items by name or SKU..." 
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl pl-10 pr-4 py-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all"
                />
              </div>

              {/* Items Grid List */}
              <div className="max-h-[220px] overflow-y-auto border border-outline-variant/15 rounded-2xl p-4 bg-surface space-y-2 custom-scrollbar">
                {filteredItems.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                    {activeTypes.length === 0 
                      ? 'Please check at least one allowed Item Type above' 
                      : 'No items matching criteria found'}
                  </div>
                ) : (
                  filteredItems.map(item => {
                    const isSelected = selectedItemIds.includes(item.id);
                    const otherDepts = (item.department || '')
                      .split(',')
                      .map(d => d.trim())
                      .filter(d => d && d !== deptName);

                    return (
                      <div 
                        key={item.id}
                        onClick={() => handleToggleItem(item.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected 
                            ? 'bg-primary/5 border-primary/30 shadow-sm' 
                            : 'border-outline-variant/10 hover:border-outline-variant/40 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary pointer-events-none"
                          />
                          <div>
                            <p className="text-xs font-bold text-on-surface">{item.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 font-mono mt-0.5">
                              SKU: {item.sku || 'N/A'} • Type: {item.category || item.type}
                            </p>
                          </div>
                        </div>
                        {otherDepts.length > 0 && (
                          <span className="text-[9px] font-bold bg-amber-500/10 text-amber-600 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            Also in: {otherDepts.join(', ')}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-primary to-primary-container text-white font-extrabold text-xs shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {editingId ? 'Update Department' : 'Save Department'}
              </button>
              
              {editingId && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="py-3.5 px-5 rounded-2xl bg-surface-container-high border border-outline-variant/30 text-on-surface-variant font-bold text-xs hover:bg-surface-container transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Active Departments Column */}
        <div className="w-full lg:w-[440px] p-8 bg-surface-container-low flex flex-col gap-6 shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-extrabold text-on-surface text-lg">Active Departments</h3>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                System Registered Directories ({departments.length})
              </p>
            </div>
            
            {/* Prominent Create New header shortcut */}
            {editingId && (
              <button 
                onClick={handleResetForm}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary-container hover:underline"
              >
                <span className="material-symbols-outlined text-[14px]">add_circle</span>
                New
              </button>
            )}
          </div>

          <hr className="border-outline-variant/15" />

          {/* Department List Grid */}
          <div className="flex-1 overflow-y-auto space-y-4 max-h-[550px] pr-1 custom-scrollbar">
            {departments.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm font-semibold">
                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">corporate_fare</span>
                <p>No departments registered yet.</p>
                <p className="text-xs text-slate-400 font-medium mt-1">Use the form on the left to add your first department.</p>
              </div>
            ) : (
              departments.map(dept => {
                const deptNameVal = dept.name || dept.label;
                const assignedItems = items.filter(item => {
                  const itemDepts = (item.department || '').split(',').map(d => d.trim()).filter(Boolean);
                  return itemDepts.includes(deptNameVal);
                });
                const isSelectedForEdit = editingId === dept.id;

                return (
                  <div 
                    key={dept.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isSelectedForEdit 
                        ? 'bg-white border-primary shadow-md ring-1 ring-primary/20' 
                        : 'bg-surface border-outline-variant/20 shadow-sm hover:border-outline-variant/50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        <h4 className="font-extrabold text-on-surface text-base leading-tight">
                          {deptNameVal}
                        </h4>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(dept.itemTypes || ['Finished Goods']).map(type => (
                            <span 
                              key={type} 
                              className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                type === 'Finished Goods' 
                                  ? 'bg-primary/10 text-primary' 
                                  : 'bg-secondary/10 text-secondary'
                              }`}
                            >
                              {type}s
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleEdit(dept)}
                          className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-primary/10 hover:text-primary rounded-lg text-slate-500 transition-colors"
                          title="Edit Department"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button 
                          onClick={() => handleDelete(dept)}
                          className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-500 transition-colors"
                          title="Delete Department"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-on-surface-variant font-semibold pt-2 border-t border-outline-variant/10">
                      <span>Mapped Items:</span>
                      <span className="font-extrabold text-primary bg-primary/5 px-2 py-0.5 rounded-md">
                        {assignedItems.length} Products
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
