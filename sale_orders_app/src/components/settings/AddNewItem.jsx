import React, { useState, useRef, useEffect } from 'react';
import BulkUploadModal from './BulkUploadModal';
import ProfileCardModal from './ProfileCardModal';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import CustomSelect from '../ui/CustomSelect';
import GlobalPagination from '../ui/GlobalPagination';
import { formatCurrencyPKR } from '../../utils/currencyUtils';

export default function AddNewItem() {
  const { state, setCollection } = useApp();
  const { appConfirm, appPrompt, appAlert } = useDialog();
  const [showHistory, setShowHistory] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [categoryType, setCategoryType] = useState('Finished Goods');
  const [viewProfileData, setViewProfileData] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Math tracking for Finished Goods Roll Size Calculation
  const [uomNumber, setUomNumber] = useState(0);
  const [packingSize, setPackingSize] = useState(0);

  // Auto calculated Roll Size
  const rollSize = (uomNumber * packingSize) || 0;

  const ObjectInitialState = {
    id: '', name: '', sku: '', uom: '', specifications: '', price: '', alert: '', status: 'Active', image: null, model3d: null, subCategory: '', backClothId: '', rawMaterialType: '', packingType: '', packingSizeRaw: '', department: ''
  };

  // Unified Form Data
  const [formData, setFormData] = useState(ObjectInitialState);
  
  const fileInputRef = useRef(null);
  const modelInputRef = useRef(null);

  // Searchable Dropdown State
  const [searchClothQuery, setSearchClothQuery] = useState('');
  const [isClothDropdownOpen, setIsClothDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsClothDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clothRawMaterials = state.items.filter(item => (item.category === 'Raw Material' || item.type === 'Raw Material') && item.rawMaterialType === 'Cloth');
  const displayItems = state.items;

  const filteredClothMaterials = clothRawMaterials.filter(rm => 
    rm.name.toLowerCase().includes(searchClothQuery.toLowerCase())
  );

  const [historyFilter, setHistoryFilter] = useState('All');
  
  const filteredDisplayItems = displayItems.filter(item => {
    if (historyFilter === 'All') return true;
    if (historyFilter === 'Finished Goods') return item.category === 'Finished Goods' || item.type === 'Finish Good';
    if (historyFilter === 'Raw Material') return item.category === 'Raw Material' || item.type === 'Raw Material';
    return true;
  });

  const displayedFilteredItems = state?.isGlobalPaginated 
    ? filteredDisplayItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredDisplayItems;

  const generateTrackingCode = (cat) => {
    const list = state.items.filter(i => (i.category === cat || i.type === cat));
    const count = list.length;
    const prefix = state.categoryPrefixes?.[cat] || (cat === 'Finished Goods' ? 'ITM' : 'RM');
    return prefix + '-' + String(count + 1).padStart(3, '0');
  };

  useEffect(() => {
    if (!formData.id && !showHistory) {
      setFormData(prev => ({ ...prev, sku: generateTrackingCode(categoryType) }));
    }
  }, [state.items, showHistory, categoryType, state.categoryPrefixes]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if(formErrors[e.target.name]) setFormErrors(prev => ({ ...prev, [e.target.name]: null }));
  };

  const handleAddOption = async (listName, formField, label) => {
    const newVal = await appPrompt(`Enter new ${label}:`);
    if (newVal && newVal.trim() !== '') {
      const newObj = { label: newVal.trim(), value: newVal.trim(), disabled: false };
      const updatedList = [...(state[listName] || []), newObj];
      setCollection(listName, updatedList);
      setFormData(prev => ({ ...prev, [formField]: newVal.trim() }));
      if(formErrors[formField]) setFormErrors(prev => ({ ...prev, [formField]: null }));
    }
  };

  const handleEditOption = async (listName, opt) => {
    const newVal = await appPrompt(`Edit value for ${opt.label}:`, opt.label);
    if (newVal && newVal.trim() !== '' && newVal.trim() !== opt.label) {
      const updatedList = (state[listName] || []).map(o => {
        if (typeof o === 'object') {
          return o.value === opt.value ? { ...o, label: newVal.trim(), value: newVal.trim() } : o;
        }
        return o === opt.value ? newVal.trim() : o;
      });
      setCollection(listName, updatedList);
    }
  };

  const handleDeleteOption = async (listName, opt) => {
    if (await appConfirm(`Are you sure you want to delete ${opt.label}?`)) {
      const updatedList = (state[listName] || []).filter(o => typeof o === 'object' ? o.value !== opt.value : o !== opt.value);
      setCollection(listName, updatedList);
    }
  };

  const handleToggleDisableOption = async (listName, opt) => {
    const action = opt.disabled ? "enable" : "disable";
    if (await appConfirm(`Are you sure you want to ${action} ${opt.label}?`)) {
      const updatedList = (state[listName] || []).map(o => {
        if (typeof o === 'object') {
          return o.value === opt.value ? { ...o, disabled: !o.disabled } : o;
        }
        return o;
      });
      setCollection(listName, updatedList);
    }
  };

  const checkInUse = (field, value) => {
    if (field === 'category') return state.items.some(i => i.category === value || i.type === value);
    return state.items.some(item => item[field] === value);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: URL.createObjectURL(file) });
    }
  };

  const handleModelUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const modelUrl = URL.createObjectURL(file);
      setFormData({ ...formData, model3d: modelUrl, model3dName: file.name });
    }
  };

  const handleSave = () => {
    let errors = {};
    if (!formData.name) errors.name = "Item Name / Title";
    if (!formData.sku) errors.sku = "SKU / Item Code";
    
    if (categoryType === 'Finished Goods') {
        if (!formData.uom) errors.uom = "Unit of Measure (UOM)";
        if (!formData.backClothId) errors.backClothId = "Back Cloth Name";
        if (!uomNumber) errors.uomNumber = "UOM (Base Quantity)";
        if (!packingSize) errors.packingSize = "Packing Size";
    } else {
        if (!formData.rawMaterialType) errors.rawMaterialType = `${categoryType} Type`;
        if (!formData.uom) errors.uom = "Unit of Measure (UOM)";
    }

    if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        appAlert(`Please fill the following mandatory fields:\n${Object.values(errors).join(', ')}`);
        return;
    }

    let updatedItems = [...state.items];
    const itemPayload = { 
        ...formData, 
        category: categoryType, 
        type: categoryType, 
        rollSize, 
        uomNumber, 
        packingSize: categoryType === 'Finished Goods' ? packingSize : formData.packingSizeRaw 
    };
    
    if (formData.id) {
      updatedItems = updatedItems.map(item => item.id === formData.id ? itemPayload : item);
    } else {
      updatedItems.push({ ...itemPayload, id: 'I' + Date.now() });
    }
    
    setCollection('items', updatedItems);
    handleReset();
    setShowHistory(true);
  };

  const handleReset = () => {
    setFormData({ ...ObjectInitialState, sku: generateTrackingCode(categoryType) });
    setUomNumber(0);
    setPackingSize(0);
    setFormErrors({});
  };

  const handleEdit = async (item) => {
    if (!(await appConfirm('Are you sure you want to edit this item?'))) return;
    setCategoryType(item.category || (item.type === 'Finish Good' ? 'Finished Goods' : 'Raw Material'));
    setFormData({ ...ObjectInitialState, ...item, packingSizeRaw: item.category === 'Raw Material' ? item.packingSize : '' });
    setUomNumber(item.uomNumber || 0);
    setPackingSize(item.category === 'Finished Goods' ? (item.packingSize || 0) : 0);
    setShowHistory(false);
  };

  const handleDelete = async (id) => {
    if(await appConfirm('Are you sure you want to delete this item?')) {
      const updatedItems = state.items.filter(item => item.id !== id);
      setCollection('items', updatedItems);
    }
  };

  const handleBulkUpload = (csvText) => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      appAlert("No valid data found in CSV file.");
      return;
    }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const firstCell = line.split(',')[0]?.trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (firstCell === 'end' || line.trim().toLowerCase() === 'end') {
        break;
      }

      const values = [];
      let currentVal = '';
      let inQuotes = false;
      for (let char of line) {
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim());
      
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index]?.replace(/^["']|["']$/g, '') || '';
      });
      
      const name = (rowData['Item Name'] || rowData['Item name'] || '').trim();
      if (/[a-zA-Z0-9]/.test(name)) {
        rows.push(rowData);
      }
    }

    const errors = [];
    
    // 1. Check Headers
    if (categoryType === 'Finished Goods') {
      const requiredHeaders = ['Item Name', 'Department', 'UOM', 'Back Cloth Name', 'UOM Base Quantity', 'Packing Size', 'Unit Price'];
      const missingHeaders = requiredHeaders.filter(rh => !headers.some(h => h.toLowerCase() === rh.toLowerCase()));
      if (missingHeaders.length > 0) {
        appAlert(`CSV file template mismatch!\nMissing required columns: ${missingHeaders.join(', ')}`);
        return;
      }
      
      // 2. Row Level Validation
      rows.forEach((row, index) => {
        const rowNum = index + 2;
        const getKey = (names) => {
          const match = headers.find(h => names.some(n => n.toLowerCase() === h.toLowerCase()));
          return match ? row[match] : '';
        };

        const name = getKey(['Item Name', 'Item name']);
        const uom = getKey(['UOM', 'uom']);
        const clothName = getKey(['Back Cloth Name', 'Back cloth name']);
        const uomBaseQtyStr = getKey(['UOM Base Quantity', 'UOM base quantity']);
        const packSizeStr = getKey(['Packing Size', 'Packing size']);
        const unitPriceStr = getKey(['Unit Price', 'Unit price']);

        if (!name) {
          errors.push(`Row ${rowNum}: 'Item Name' is empty.`);
        }
        if (!uom) {
          errors.push(`Row ${rowNum}: 'UOM' is empty.`);
        }
        if (!clothName) {
          errors.push(`Row ${rowNum}: 'Back Cloth Name' is empty.`);
        } else {
          const clothItem = state.items.find(i => i.name.toLowerCase() === clothName.trim().toLowerCase());
          if (!clothItem) {
            errors.push(`Row ${rowNum}: Back Cloth Name "${clothName}" does not exist in registered Raw Materials.`);
          }
        }
        
        const uomBaseQty = Number(uomBaseQtyStr);
        if (isNaN(uomBaseQty) || uomBaseQty <= 0) {
          errors.push(`Row ${rowNum}: 'UOM Base Quantity' ("${uomBaseQtyStr}") must be a valid positive number.`);
        }

        const packSize = Number(packSizeStr);
        if (isNaN(packSize) || packSize <= 0) {
          errors.push(`Row ${rowNum}: 'Packing Size' ("${packSizeStr}") must be a valid positive number.`);
        }

        const cleanPrice = (unitPriceStr || '').replace(/[^\d.]/g, '');
        const unitPrice = parseFloat(cleanPrice);
        if (isNaN(unitPrice) || unitPrice < 0) {
          errors.push(`Row ${rowNum}: 'Unit Price' ("${unitPriceStr}") must be a valid non-negative number.`);
        }
      });
      
    } else {
      const requiredHeaders = ['Item Name', 'Department', `${categoryType} Type`, 'Unit of Measure', 'Packing Type', 'Packing Size', 'Estimated Cost'];
      const missingHeaders = requiredHeaders.filter(rh => !headers.some(h => h.toLowerCase() === rh.toLowerCase()));
      if (missingHeaders.length > 0) {
        const altRequired = ['Item Name', 'Department', 'Raw Material Type', 'Unit of Measure', 'Packing Type', 'Packing Size', 'Estimated Cost'];
        const altMissing = altRequired.filter(rh => !headers.some(h => h.toLowerCase() === rh.toLowerCase()));
        if (altMissing.length > 0) {
          appAlert(`CSV file template mismatch!\nMissing required columns: ${missingHeaders.join(', ')}`);
          return;
        }
      }

      rows.forEach((row, index) => {
        const rowNum = index + 2;
        const getKey = (names) => {
          const match = headers.find(h => names.some(n => n.toLowerCase() === h.toLowerCase()));
          return match ? row[match] : '';
        };

        const name = getKey(['Item Name', 'Item name']);
        const rmType = getKey([`${categoryType} Type`, `${categoryType} type`, 'Raw Material Type', 'Raw material type']);
        const uom = getKey(['Unit of Measure', 'Unit of measure', 'UOM', 'uom']);
        const packSizeStr = getKey(['Packing Size', 'Packing size']);
        const estCostStr = getKey(['Estimated Cost', 'Estimated cost']);

        if (!name) {
          errors.push(`Row ${rowNum}: 'Item Name' is empty.`);
        }
        if (!rmType) {
          errors.push(`Row ${rowNum}: '${categoryType} Type' is empty.`);
        }
        if (!uom) {
          errors.push(`Row ${rowNum}: 'Unit of Measure' is empty.`);
        }
        
        const packSize = Number(packSizeStr);
        if (isNaN(packSize) || packSize <= 0) {
          errors.push(`Row ${rowNum}: 'Packing Size' ("${packSizeStr}") must be a valid positive number.`);
        }

        const cleanCost = (estCostStr || '').replace(/[^\d.]/g, '');
        const estCost = parseFloat(cleanCost);
        if (isNaN(estCost) || estCost < 0) {
          errors.push(`Row ${rowNum}: 'Estimated Cost' ("${estCostStr}") must be a valid non-negative number.`);
        }
      });
    }

    if (errors.length > 0) {
      const errorMsg = `File validation failed! Please correct the following errors:\n\n` + errors.slice(0, 15).join('\n') + (errors.length > 15 ? `\n...and ${errors.length - 15} more errors.` : '');
      appAlert(errorMsg);
      return;
    }

    let updatedItems = [...state.items];
    let addedCount = 0;

    if (categoryType === 'Finished Goods') {
      const existingFG = updatedItems.filter(i => i.category === 'Finished Goods' || i.type === 'Finished Goods');
      let fgCount = existingFG.length;

      rows.forEach(row => {
        const name = row['Item Name'] || row['Item name'];
        if (!name) return;

        const dept = row['Department'] || row['department'] || 'Production Department';
        const uom = row['UOM'] || row['uom'] || 'Units (ea)';
        const clothName = row['Back Cloth Name'] || row['Back cloth name'] || '';
        const uomBaseQty = Number(row['UOM Base Quantity'] || row['UOM base quantity']) || 0;
        const packSize = Number(row['Packing Size'] || row['Packing size']) || 0;
        const unitPrice = row['Unit Price'] || row['Unit price'] || '0.00';
        const cleanUnitPrice = parseFloat(String(unitPrice).replace(/[^0-9.-]/g, '')) || 0;
        const formattedPrice = `Rs. ${cleanUnitPrice.toFixed(2)}`;

        // find matching cloth
        const clothItem = updatedItems.find(i => i.name.toLowerCase() === clothName.toLowerCase());
        const backClothId = clothItem ? clothItem.id : '';

        fgCount++;
        const sku = `ITM-${String(fgCount).padStart(3, '0')}`;

        updatedItems.push({
          id: 'I' + (Date.now() + addedCount),
          name: name,
          sku: sku,
          uom: uom,
          backClothId: backClothId,
          uomNumber: uomBaseQty,
          packingSize: packSize,
          rollSize: uomBaseQty * packSize,
          price: formattedPrice,
          category: 'Finished Goods',
          type: 'Finished Goods',
          status: 'Active',
          specifications: '',
          alert: '',
          image: null,
          model3d: null,
          subCategory: '',
          rawMaterialType: '',
          packingType: '',
          packingSizeRaw: '',
          department: dept
        });
        addedCount++;
      });
    } else {
      const currentCat = categoryType;
      const existingRM = updatedItems.filter(i => i.category === currentCat || i.type === currentCat);
      let rmCount = existingRM.length;
      const prefix = state.categoryPrefixes?.[currentCat] || (currentCat === 'Raw Material' ? 'RM' : 'ITM');

      rows.forEach(row => {
        const name = row['Item Name'] || row['Item name'];
        if (!name) return;

        const dept = row['Department'] || row['department'] || 'Procurement';
        const rmType = row[`${currentCat} Type`] || row[`${currentCat} type`] || row['Raw Material Type'] || row['Raw material type'] || 'Other';
        const uom = row['Unit of Measure'] || row['Unit of measure'] || row['UOM'] || 'Units (ea)';
        const packingType = row['Packing Type'] || row['Packing type'] || 'Box';
        const packingSize = row['Packing Size'] || row['Packing size'] || '1';
        const estCost = row['Estimated Cost'] || row['Estimated cost'] || '0.00';
        const cleanEstCost = parseFloat(String(estCost).replace(/[^0-9.-]/g, '')) || 0;
        const formattedPrice = `Rs. ${cleanEstCost.toFixed(2)}`;
        const model3d = row['3D Model'] || row['3d model'] || '';

        rmCount++;
        const sku = `${prefix}-${String(rmCount).padStart(3, '0')}`;

        updatedItems.push({
          id: 'I' + (Date.now() + addedCount),
          name: name,
          sku: sku,
          uom: uom,
          rawMaterialType: rmType,
          packingType: packingType,
          packingSize: packingSize,
          packingSizeRaw: packingSize,
          price: formattedPrice,
          category: currentCat,
          type: currentCat,
          status: 'Active',
          specifications: '',
          alert: '',
          image: null,
          model3d: model3d ? `/models/${model3d}` : null,
          model3dName: model3d || null,
          subCategory: '',
          backClothId: '',
          department: dept
        });
        addedCount++;
      });
    }

    if (addedCount > 0) {
      setCollection('items', updatedItems);
      appAlert(`Successfully uploaded and created ${addedCount} items!`);
    } else {
      appAlert("No valid item entries were found in the file.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
        <div>
          <h2 className="text-xl font-bold font-headline text-on-surface mb-2">Item Master Directory</h2>
          <p className="text-sm font-body text-on-surface-variant max-w-2xl">
            {showHistory ? "View, edit, or generate reports for all registered items across the system." : "Register new Finished Goods or Raw Materials into the master database."}
          </p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setIsBulkUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant/30 rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-sm text-primary">upload_file</span>
            Bulk Upload
          </button>
          
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
              showHistory 
                ? "bg-surface border border-outline-variant/30 text-on-surface hover:bg-surface-container-low" 
                : "bg-surface-container-low border border-primary/20 text-primary hover:bg-primary/10"
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {showHistory ? "add_circle" : "history"}
            </span>
            {showHistory ? "Add New Item" : "View Item History"}
          </button>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-2xl overflow-hidden shadow-sm">
        
        {!showHistory ? (
          /* ======================= ADD NEW FORM ======================= */
          <div className="p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              
              {/* PRIMARY SELECTION (Always Visible) */}
              <div className="relative group col-span-1 md:col-span-2 xl:col-span-3 pb-4 border-b border-outline-variant/20 mb-2 flex flex-col md:flex-row gap-6">
                 <div className="w-full md:w-1/2 flex items-center gap-2">
                   <div className="relative w-full">
                     <CustomSelect
                       name="categoryType"
                       value={categoryType}
                       onChange={(e) => {
                         setCategoryType(e.target.value);
                         setFormErrors({});
                       }}
                       options={(state.itemCategories || []).map(c => typeof c === 'object' ? c : { label: c, value: c })}
                       label="Item Category Type"
                       onEditOption={(opt) => handleEditOption('itemCategories', opt)}
                       onDeleteOption={(opt) => handleDeleteOption('itemCategories', opt)}
                       onToggleDisableOption={(opt) => handleToggleDisableOption('itemCategories', opt)}
                       checkInUse={(val) => checkInUse('category', val)}
                     />
                   </div>
                   <button type="button" onClick={async () => {
                       const newVal = await appPrompt("Enter new Item Category:");
                       if (newVal && newVal.trim() !== '') {
                           const catName = newVal.trim();
                           const prefix = await appPrompt(`Enter short code prefix for ${catName} (e.g. PKG):`);
                           const finalPrefix = (prefix && prefix.trim() !== '') ? prefix.trim().toUpperCase() : catName.substring(0, 3).toUpperCase();
                           
                           const newCatObj = { label: catName, value: catName, disabled: false };
                           const updatedCategories = [...(state.itemCategories || []), newCatObj];
                           setCollection('itemCategories', updatedCategories);
                           
                           const updatedPrefixes = { ...(state.categoryPrefixes || {}), [catName]: finalPrefix };
                           setCollection('categoryPrefixes', updatedPrefixes);
                           
                           setCategoryType(catName);
                       }
                   }} className="w-11 h-11 flex-shrink-0 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl flex items-center justify-center transition-colors shadow-sm" title="Add Custom Category">
                     <span className="material-symbols-outlined text-[20px]">add</span>
                   </button>
                 </div>

                 <div className="w-full md:w-1/2 flex items-center gap-2">
                   <div className="relative w-full">
                     <CustomSelect
                       name="department"
                       value={formData.department}
                       onChange={handleInputChange}
                        options={(state.departments || []).map(d => {
                          const name = typeof d === 'object' ? (d.name || d.label) : d;
                          return { label: name, value: name };
                        })}
                        label="Department"
                        error={formErrors.department}
                     />
                   </div>
                 </div>
              </div>

              {/* COMMON FIELDS (Always Visible) */}
              <div className="relative group col-span-1 md:col-span-2 xl:col-span-1">
                <input name="name" value={formData.name} onChange={handleInputChange} type="text" placeholder={categoryType === 'Finished Goods' ? "e.g. Industrial Servo Motor" : "e.g. Aluminum Sheets 2mm"} className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all ${formErrors.name ? 'border-error/80 ring-1 ring-error/30' : 'border-outline-variant/30'}`} />
                <label className={`absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider ${formErrors.name ? 'text-error' : 'text-primary'}`}>Item Name / Title</label>
              </div>
              
              <div className="relative group relative">
                <input name="sku" value={formData.sku} onChange={handleInputChange} type="text" placeholder={categoryType === 'Finished Goods' ? "e.g. MTR-SRV-001" : "e.g. RM-AL-002"} className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all font-mono ${formErrors.sku ? 'border-error/80 ring-1 ring-error/30' : 'border-outline-variant/30'}`} />
                <label className={`absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider ${formErrors.sku ? 'text-error' : 'text-primary'}`}>SKU / Item Code</label>
              </div>

              {/* DYNAMIC RENDER: FINISHED GOODS FIELDS */}
              {categoryType === 'Finished Goods' && (
                <>
                  <div className="relative group flex items-center gap-2">
                    <div className="relative w-full">
                      <CustomSelect
                        name="uom"
                        value={formData.uom}
                        onChange={handleInputChange}
                        options={(state.uomList || []).map(u => typeof u === 'object' ? u : { label: u, value: u })}
                        label="Unit of Measure"
                        error={formErrors.uom}
                        onEditOption={(opt) => handleEditOption('uomList', opt)}
                        onDeleteOption={(opt) => handleDeleteOption('uomList', opt)}
                        onToggleDisableOption={(opt) => handleToggleDisableOption('uomList', opt)}
                        checkInUse={(val) => checkInUse('uom', val)}
                      />
                    </div>
                    <button type="button" onClick={() => handleAddOption('uomList', 'uom', 'UOM')} className="w-11 h-11 flex-shrink-0 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl flex items-center justify-center transition-colors shadow-sm" title="Add Custom UOM">
                      <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                  </div>

                  {/* ROLL SIZE CALCULATOR WIDGET */}
                  <div className="col-span-1 md:col-span-2 xl:col-span-3 bg-tertiary/5 border border-tertiary/20 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                    <div className="relative group">
                      <input 
                        type="number" 
                        value={uomNumber || ''} 
                        onChange={(e) => { setUomNumber(parseFloat(e.target.value) || 0); if(formErrors.uomNumber) setFormErrors(prev => ({...prev, uomNumber: null})); }} 
                        placeholder="0.00" 
                        className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-tertiary focus:border-transparent transition-all font-mono ${formErrors.uomNumber ? 'border-error/80 ring-1 ring-error/30' : 'border-outline-variant/30'}`} 
                      />
                      <label className={`absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider ${formErrors.uomNumber ? 'text-error' : 'text-tertiary'}`}>UOM (Base Quantity)</label>
                    </div>
                    
                    <div className="relative flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-400 font-light absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden sm:block">close</span>
                      <div className="relative w-full group">
                        <input 
                          type="number" 
                          value={packingSize || ''} 
                          onChange={(e) => { setPackingSize(parseFloat(e.target.value) || 0); if(formErrors.packingSize) setFormErrors(prev => ({...prev, packingSize: null})); }} 
                          placeholder="0.00" 
                          className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-tertiary focus:border-transparent transition-all font-mono ${formErrors.packingSize ? 'border-error/80 ring-1 ring-error/30' : 'border-outline-variant/30'}`} 
                        />
                        <label className={`absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider ${formErrors.packingSize ? 'text-error' : 'text-tertiary'}`}>Packing Size</label>
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="w-full bg-tertiary text-white rounded-xl px-4 py-3 text-sm font-bold shadow-inner flex justify-between items-center">
                        <span className="text-xs uppercase tracking-widest text-tertiary-container">Computed Roll Size</span>
                        <span>{rollSize.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative group col-span-1 md:col-span-2 xl:col-span-3 bg-surface-dim/30 p-5 rounded-xl border border-outline-variant/20">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 mt-1">
                        <span className="material-symbols-outlined text-secondary text-sm">texture</span>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h4 className="text-sm font-bold text-on-surface">Associated Base Material</h4>
                          <p className="text-xs text-on-surface-variant">Specify the designated cloth backing or underlying base material required for manufacturing this item.</p>
                        </div>
                        <div className="relative w-full max-w-md" ref={dropdownRef}>
                          <input 
                            type="text" 
                            name="backClothSearch" 
                            placeholder="Type to search Back Cloth..."
                            value={isClothDropdownOpen ? searchClothQuery : (clothRawMaterials.find(rm => rm.id === formData.backClothId)?.name || '')}
                            onChange={(e) => {
                              setSearchClothQuery(e.target.value);
                              if(!isClothDropdownOpen) setIsClothDropdownOpen(true);
                              if (e.target.value === '') {
                                setFormData(prev => ({ ...prev, backClothId: '' }));
                              }
                            }}
                            onFocus={() => {
                              setIsClothDropdownOpen(true);
                              setSearchClothQuery('');
                            }}
                            className={`w-full bg-surface border rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all ${formErrors.backClothId ? 'border-error/80 ring-1 ring-error/30' : 'border-outline-variant/30'}`}
                          />
                          <label className={`absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider ${formErrors.backClothId ? 'text-error' : 'text-secondary'}`}>Back Cloth Name</label>
                          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">search</span>
                          
                          {isClothDropdownOpen && (
                            <ul className="absolute z-10 w-full mt-1 bg-surface border border-outline-variant/30 rounded-xl max-h-60 overflow-auto shadow-lg">
                              <li 
                                className="px-4 py-2 hover:bg-surface-container-low cursor-pointer text-sm text-on-surface-variant italic"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, backClothId: '' }));
                                  setIsClothDropdownOpen(false);
                                }}
                              >
                                -- Clear Selection --
                              </li>
                              {filteredClothMaterials.map(rm => (
                                <li 
                                  key={rm.id} 
                                  className="px-4 py-2 hover:bg-surface-container-low cursor-pointer text-sm text-on-surface"
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, backClothId: rm.id }));
                                    if(formErrors.backClothId) setFormErrors(prev => ({ ...prev, backClothId: null }));
                                    setSearchClothQuery('');
                                    setIsClothDropdownOpen(false);
                                  }}
                                >
                                  {rm.name}
                                </li>
                              ))}
                              {filteredClothMaterials.length === 0 && (
                                <li className="px-4 py-2 text-sm text-on-surface-variant text-center">No results found</li>
                              )}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group col-span-1 md:col-span-2 xl:col-span-3">
                    <textarea name="specifications" value={formData.specifications} onChange={handleInputChange} rows="3" placeholder="Enter detailed description, specifications, or usage instructions..." className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all resize-none"></textarea>
                    <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold text-primary uppercase tracking-wider">Detailed Description</label>
                  </div>
                </>
              )}

              {/* DYNAMIC RENDER: RAW MATERIAL / CUSTOM CATEGORY FIELDS */}
              {categoryType !== 'Finished Goods' && (
                <>
                  <div className="relative group col-span-1 md:col-span-2 xl:col-span-3 mb-4 flex flex-col items-center justify-center text-center">
                    <input type="file" ref={modelInputRef} onChange={handleModelUpload} accept=".obj,.gltf,.glb" className="hidden" />
                    {formData.model3d ? (
                      <div className="flex flex-col items-center group cursor-pointer" onClick={() => modelInputRef.current.click()}>
                        <div className="w-48 h-48 bg-transparent flex items-center justify-center relative">
                           {/* Simulated 3D Model Free Space Viewer */}
                           <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent rounded-full animate-pulse"></div>
                           <span className="material-symbols-outlined text-6xl text-primary drop-shadow-lg">view_in_ar</span>
                        </div>
                        <span className="text-sm font-bold text-primary mt-2">{formData.model3d}</span>
                        <span className="text-xs text-primary/70 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to Change 3D Model</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-on-surface-variant cursor-pointer group" onClick={() => modelInputRef.current.click()}>
                        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center shadow-lg shadow-surface-variant/20 border-none group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined text-primary text-2xl">view_in_ar</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-primary group-hover:text-primary/80 transition-colors">Add 3D Object (Free Space)</span>
                          <span className="text-xs mt-1">.obj, .gltf, .glb up to 15MB</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative group flex items-center gap-2">

                    <div className="relative w-full">
                      <CustomSelect
                        name="rawMaterialType"
                        value={formData.rawMaterialType}
                        onChange={handleInputChange}
                        options={(state.rawMaterialTypesList || []).map(rt => typeof rt === 'object' ? rt : { label: rt, value: rt })}
                        label={`${categoryType.toUpperCase()} TYPE`}
                        error={formErrors.rawMaterialType}
                        onEditOption={(opt) => handleEditOption('rawMaterialTypesList', opt)}
                        onDeleteOption={(opt) => handleDeleteOption('rawMaterialTypesList', opt)}
                        onToggleDisableOption={(opt) => handleToggleDisableOption('rawMaterialTypesList', opt)}
                        checkInUse={(val) => checkInUse('rawMaterialType', val)}
                      />
                    </div>
                    <button type="button" onClick={() => handleAddOption('rawMaterialTypesList', 'rawMaterialType', `${categoryType} Type`)} className="w-11 h-11 flex-shrink-0 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl flex items-center justify-center transition-colors shadow-sm" title={`Add Custom ${categoryType} Type`}>
                      <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                  </div>

                  <div className="relative group flex items-center gap-2">
                    <div className="relative w-full">
                      <CustomSelect
                        name="uom"
                        value={formData.uom}
                        onChange={handleInputChange}
                        options={(state.uomList || []).map(u => typeof u === 'object' ? u : { label: u, value: u })}
                        label="Unit of Measure"
                        error={formErrors.uom}
                        onEditOption={(opt) => handleEditOption('uomList', opt)}
                        onDeleteOption={(opt) => handleDeleteOption('uomList', opt)}
                        onToggleDisableOption={(opt) => handleToggleDisableOption('uomList', opt)}
                        checkInUse={(val) => checkInUse('uom', val)}
                      />
                    </div>
                    <button type="button" onClick={() => handleAddOption('uomList', 'uom', 'UOM')} className="w-11 h-11 flex-shrink-0 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl flex items-center justify-center transition-colors shadow-sm" title="Add Custom UOM">
                      <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                  </div>

                  <div className="relative group flex items-center gap-2">
                    <div className="relative w-full">
                      <CustomSelect
                        name="packingType"
                        value={formData.packingType}
                        onChange={handleInputChange}
                        options={(state.packingTypesList || []).map(pt => typeof pt === 'object' ? pt : { label: pt, value: pt })}
                        label="Packing Type"
                        error={formErrors.packingType}
                        onEditOption={(opt) => handleEditOption('packingTypesList', opt)}
                        onDeleteOption={(opt) => handleDeleteOption('packingTypesList', opt)}
                        onToggleDisableOption={(opt) => handleToggleDisableOption('packingTypesList', opt)}
                        checkInUse={(val) => checkInUse('packingType', val)}
                      />
                    </div>
                    <button type="button" onClick={() => handleAddOption('packingTypesList', 'packingType', 'Packing Type')} className="w-11 h-11 flex-shrink-0 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl flex items-center justify-center transition-colors shadow-sm" title="Add Custom Packing Type">
                      <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                  </div>

                  <div className="relative group">
                    <input name="packingSizeRaw" value={formData.packingSizeRaw} onChange={handleInputChange} type="number" placeholder="e.g. 50" className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all ${formErrors.packingSizeRaw ? 'border-error/80 ring-1 ring-error/30' : 'border-outline-variant/30'}`} />
                    <label className={`absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider ${formErrors.packingSizeRaw ? 'text-error' : 'text-primary'}`}>Packing Size</label>
                  </div>

                  <div className="relative group col-span-1 md:col-span-2 xl:col-span-3">
                    <textarea name="specifications" value={formData.specifications} onChange={handleInputChange} rows="3" placeholder="Provide composition details, grades, or handling instructions..." className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all resize-none"></textarea>
                    <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold text-primary uppercase tracking-wider">Material Specifications</label>
                  </div>
                </>
              )}

              {/* COMMON FOOTER FIELDS (Status) */}

              <div className="relative group">
                <CustomSelect
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  options={[
                    { label: 'Active', value: 'Active' },
                    { label: 'Inactive', value: 'Inactive' },
                    { label: 'Discontinued', value: 'Discontinued' }
                  ]}
                  label="Status"
                />
              </div>

            </div>

            <div className="mt-8 pt-6 border-t border-outline-variant/20 flex justify-end gap-4">
              <button onClick={handleReset} className="px-6 py-2.5 rounded-xl font-bold text-sm text-primary hover:bg-surface transition-colors">Clear Form</button>
              <button onClick={handleSave} className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-primary to-primary-container shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 relative overflow-hidden group">
                <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
                <span className="relative flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">{formData.id ? "save" : "add_circle"}</span>
                  {formData.id ? `Update ${categoryType}` : `Register ${categoryType}`}
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* ======================= UNIFIED HISTORY DATA TABLE ======================= */
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center gap-2 overflow-x-auto custom-scrollbar">
              {['All', 'Finished Goods', 'Raw Material'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setHistoryFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
                    historyFilter === filter 
                      ? 'bg-primary text-white shadow-sm' 
                      : 'bg-surface border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-dim border-b border-outline-variant/30">
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Item Name / Title</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Code / SKU</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Type</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Value</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 uppercase font-medium text-xs font-body text-on-surface">
                  {displayedFilteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-4 px-6 font-bold flex items-center gap-2">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-6 h-6 rounded object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-surface border border-outline-variant/30 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[10px] text-on-surface-variant">image</span>
                          </div>
                        )}
                        {item.name}
                      </td>
                      <td className="py-4 px-6 font-mono text-primary">{item.sku}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          item.category === 'Finished Goods' ? 'bg-primary-container text-on-primary-container' : 'bg-secondary-container text-on-secondary-container'
                        }`}>
                          {item.category || item.type}
                        </span>
                      </td>
                      <td className="py-4 px-6">{formatCurrencyPKR(item.price)}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          item.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.status || "Active"}
                        </span>
                      </td>
                      <td className="py-4 px-6 flex justify-end gap-2">
                        <button onClick={() => setViewProfileData(item)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface hover:bg-blue-50 text-on-surface-variant hover:text-blue-500 transition-colors border border-outline-variant/30" title="View Profile">
                           <span className="material-symbols-outlined text-[16px]">visibility</span>
                        </button>
                        <button onClick={() => handleEdit(item)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors border border-outline-variant/30" title="Edit">
                           <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface hover:bg-red-50 text-on-surface-variant hover:text-red-500 transition-colors border border-outline-variant/30" title="Delete">
                           <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <GlobalPagination 
              totalItems={filteredDisplayItems.length}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
            />
          </div>
        )}
      </div>

      <BulkUploadModal 
        isOpen={isBulkUploadOpen} 
        onClose={() => setIsBulkUploadOpen(false)} 
        entityName={categoryType} 
        onUpload={handleBulkUpload}
      />
      <ProfileCardModal 
        isOpen={!!viewProfileData} 
        onClose={() => setViewProfileData(null)} 
        data={viewProfileData} 
        type="Item Identity" 
      />
    </div>
  );
}
