import React, { useState, useEffect } from 'react';
import BulkUploadModal from './BulkUploadModal';
import ProfileCardModal from './ProfileCardModal';
import { useApp } from '../../context/AppContext';
import { nextItemCode } from '../../utils/itemCodes';
import { useDialog } from '../../context/DialogContext';
import CustomSelect from '../ui/CustomSelect';
import GlobalPagination from '../ui/GlobalPagination';

export default function AddRawMaterial() {
  const { state, setCollection, currencySymbol } = useApp();
  const currSym = currencySymbol || state?.adminSetup?.baseCurrency?.match(/\(([^)]+)\)/)?.[1] || 'Rs';
  const { appConfirm, appAlert } = useDialog();
  const [showHistory, setShowHistory] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [viewProfileData, setViewProfileData] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const rawMaterials = state.items.filter(item => item.category === 'Raw Material');

  const generateTrackingCode = () => nextItemCode(state.items, 'Raw Material', state.categoryPrefixes);

  // Form State
  const [formData, setFormData] = useState({
    id: '', name: '', sku: '', uom: '', rawMaterialType: '', specifications: '', price: '', alert: '', category: 'Raw Material', type: 'Raw Material', status: 'Active'
  });

  useEffect(() => {
    if (!formData.id && !showHistory) {
      setFormData(prev => ({ ...prev, sku: generateTrackingCode() }));
    }
  }, [state.items, showHistory]);

  const displayedMaterials = state?.isGlobalPaginated
    ? rawMaterials.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : rawMaterials;

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if(formErrors[e.target.name]) setFormErrors(prev => ({ ...prev, [e.target.name]: null }));
  };

  const handleSave = () => {
    let errors = {};
    if (!formData.name) errors.name = "Material Name";
    if (!formData.sku) errors.sku = "Material Code (SKU)";
    if (!formData.rawMaterialType) errors.rawMaterialType = "Raw Material Type";
    if (!formData.uom) errors.uom = "Unit of Measure (UOM)";
    if (!formData.price) errors.price = "Estimated Cost / Unit";

    if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        appAlert(`Please fill the following mandatory fields:\n${Object.values(errors).join(', ')}`);
        return;
    }

    let updatedItems = [...state.items];
    
    if (formData.id) {
      updatedItems = updatedItems.map(item => item.id === formData.id ? formData : item);
    } else {
      updatedItems.push({ ...formData, id: 'RM' + Date.now() });
    }
    
    setCollection('items', updatedItems);
    setFormData({ id: '', name: '', sku: generateTrackingCode(), uom: '', rawMaterialType: '', specifications: '', price: '', alert: '', category: 'Raw Material', type: 'Raw Material', status: 'Active' });
    setFormErrors({});
    setShowHistory(true);
  };

  const handleEdit = async (item) => {
    if (!(await appConfirm('Are you sure you want to edit this raw material?'))) return;
    setFormData(item);
    setShowHistory(false);
  };

  const handleDelete = async (id) => {
    if(await appConfirm('Are you sure you want to delete this material?')) {
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
    const requiredHeaders = ['Item Name', 'Department', 'Raw Material Type', 'Unit of Measure', 'Packing Type', 'Packing Size', 'Estimated Cost'];
    const missingHeaders = requiredHeaders.filter(rh => !headers.some(h => h.toLowerCase() === rh.toLowerCase()));
    if (missingHeaders.length > 0) {
      appAlert(`CSV file template mismatch!\nMissing required columns: ${missingHeaders.join(', ')}`);
      return;
    }

    rows.forEach((row, index) => {
      const rowNum = index + 2;
      const getKey = (names) => {
        const match = headers.find(h => names.some(n => n.toLowerCase() === h.toLowerCase()));
        return match ? row[match] : '';
      };

      const name = getKey(['Item Name', 'Item name']);
      const rmType = getKey(['Raw Material Type', 'Raw material type']);
      const uom = getKey(['Unit of Measure', 'Unit of measure', 'UOM', 'uom']);
      const packSizeStr = getKey(['Packing Size', 'Packing size']);
      const estCostStr = getKey(['Estimated Cost', 'Estimated cost']);

      if (!name) {
        errors.push(`Row ${rowNum}: 'Item Name' is empty.`);
      }
      if (!rmType) {
        errors.push(`Row ${rowNum}: 'Raw Material Type' is empty.`);
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

    if (errors.length > 0) {
      const errorMsg = `File validation failed! Please correct the following errors:\n\n` + errors.slice(0, 15).join('\n') + (errors.length > 15 ? `\n...and ${errors.length - 15} more errors.` : '');
      appAlert(errorMsg);
      return;
    }

    let updatedItems = [...state.items];
    const existingRM = updatedItems.filter(i => i.category === 'Raw Material');
    let rmCount = existingRM.length;
    let addedCount = 0;

    rows.forEach(row => {
      const name = row['Item Name'] || row['Item name'];
      if (!name) return;

      const dept = row['Department'] || row['department'] || 'Procurement';
      const rmType = row['Raw Material Type'] || row['Raw material type'] || 'Other';
      const uom = row['Unit of Measure'] || row['Unit of measure'] || row['UOM'] || 'Units (ea)';
      const packingType = row['Packing Type'] || row['Packing type'] || 'Box';
      const packingSize = row['Packing Size'] || row['Packing size'] || '1';
      const estCost = row['Estimated Cost'] || row['Estimated cost'] || '0.00';
      const formattedPrice = currSym + (parseFloat(String(estCost).replace(/^[^0-9.-]+/, '')) || 0).toFixed(2);
      const model3d = row['3D Model'] || row['3d model'] || '';

      const sku = nextItemCode(updatedItems, 'Raw Material', state.categoryPrefixes);

      updatedItems.push({
        id: 'RM' + (Date.now() + addedCount),
        name: name,
        sku: sku,
        uom: uom,
        rawMaterialType: rmType,
        packingType: packingType,
        packingSize: packingSize,
        price: formattedPrice,
        category: 'Raw Material',
        type: 'Raw Material',
        status: 'Active',
        specifications: '',
        alert: '',
        image: null,
        model3d: model3d ? `/models/${model3d}` : null,
        model3dName: model3d || null,
        department: dept
      });
      addedCount++;
    });

    if (addedCount > 0) {
      setCollection('items', updatedItems);
      appAlert(`Successfully uploaded and created ${addedCount} raw materials!`);
    } else {
      appAlert("No valid raw material entries were found in the file.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
        <div>
          <h2 className="text-xl font-bold font-headline text-on-surface mb-2">Raw Material Procurement Settings</h2>
          <p className="text-sm font-body text-on-surface-variant max-w-2xl">
            {showHistory ? "Monitor your registered raw materials, specifications, and low stock thresholds." : "Register base commodities and materials used across OMS production."}
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
              {showHistory ? "category" : "history"}
            </span>
            {showHistory ? "Add Raw Material" : "View History"}
          </button>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-2xl overflow-hidden shadow-sm">
        
        {!showHistory ? (
          /* ======================= ADD NEW FORM ======================= */
          <div className="p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative group col-span-1 md:col-span-2">
                <input name="name" value={formData.name} onChange={handleInputChange} type="text" placeholder="e.g. Aluminum Sheets 2mm" className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all ${formErrors.name ? 'border-error/80 ring-1 ring-error/30' : 'border-outline-variant/30'}`} />
                <label className={`absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider ${formErrors.name ? 'text-error' : 'text-primary'}`}>Material Name</label>
              </div>
              
              <div className="relative group">
                <input name="sku" value={formData.sku} onChange={handleInputChange} type="text" placeholder="e.g. RM-AL-002" className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all font-mono ${formErrors.sku ? 'border-error/80 ring-1 ring-error/30' : 'border-outline-variant/30'}`} />
                <label className={`absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider ${formErrors.sku ? 'text-error' : 'text-primary'}`}>Material Code (SKU)</label>
              </div>

              <div className="relative group">
                <CustomSelect
                  name="rawMaterialType"
                  value={formData.rawMaterialType}
                  onChange={handleInputChange}
                  options={[
                    { label: 'Select Type...', value: '' },
                    { label: 'Cloth', value: 'Cloth' },
                    { label: 'Chemical', value: 'Chemical' },
                    { label: 'Metal', value: 'Metal' },
                    { label: 'Plastic', value: 'Plastic' },
                    { label: 'Other', value: 'Other' }
                  ]}
                  label="Raw Material Type"
                  error={formErrors.rawMaterialType}
                />
              </div>

              <div className="relative group">
                <CustomSelect
                  name="uom"
                  value={formData.uom}
                  onChange={handleInputChange}
                  options={[
                    { label: 'Select UOM...', value: '' },
                    { label: 'Kilograms (kg)', value: 'Kilograms (kg)' },
                    { label: 'Liters (L)', value: 'Liters (L)' },
                    { label: 'Units (ea)', value: 'Units (ea)' },
                    { label: 'Meters (m)', value: 'Meters (m)' }
                  ]}
                  label="Unit of Measure (UOM)"
                  error={formErrors.uom}
                />
              </div>

              <div className="relative group col-span-1 md:col-span-2">
                 <textarea name="specifications" value={formData.specifications} onChange={handleInputChange} rows="3" placeholder="Provide composition details, grades, or handling instructions..." className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all resize-none"></textarea>
                <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold text-primary uppercase tracking-wider">Specifications</label>
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 text-xs font-bold">{currSym}</span>
                </div>
                <input name="price" value={formData.price} onChange={handleInputChange} type="text" placeholder="0.00" className={`w-full bg-surface border rounded-xl pl-8 pr-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all ${formErrors.price ? 'border-error/80 ring-1 ring-error/30' : 'border-outline-variant/30'}`} />
                <label className={`absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider ${formErrors.price ? 'text-error' : 'text-primary'}`}>Estimated Cost / Unit</label>
              </div>

              <div className="relative group">
                <input name="alert" value={formData.alert} onChange={handleInputChange} type="number" placeholder="e.g. 50" className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all" />
                <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold text-primary uppercase tracking-wider">Minimum Stock Alert</label>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-outline-variant/20 flex justify-end gap-4">
              <button 
                onClick={() => {
                  setFormData({ id: '', name: '', sku: generateTrackingCode(), uom: '', rawMaterialType: '', specifications: '', price: '', alert: '', category: 'Raw Material', type: 'Raw Material', status: 'Active' });
                  setFormErrors({});
                }} 
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-primary hover:bg-surface transition-colors"
              >
                Reset
              </button>
              <button onClick={handleSave} className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-primary to-primary-container shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 relative overflow-hidden group">
                <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
                <span className="relative flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">{formData.id ? "save" : "category"}</span>
                  {formData.id ? "Update Material" : "Save Material"}
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* ======================= HISTORY DATA TABLE ======================= */
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-dim border-b border-outline-variant/30">
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Material Name</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Code / SKU</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">UOM</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Est. Cost</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Stock Alert</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 uppercase font-medium text-xs font-body text-on-surface">
                  {displayedMaterials.map((mat) => (
                    <tr key={mat.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-4 px-6 font-bold">{mat.name}</td>
                      <td className="py-4 px-6 font-mono text-primary">{mat.sku}</td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-secondary/10 text-secondary">
                          {mat.uom || mat.unit}
                        </span>
                      </td>
                      <td className="py-4 px-6">{mat.price || mat.cost}</td>
                      <td className="py-4 px-6 font-mono text-tertiary">{mat.alert || 0}</td>
                      <td className="py-4 px-6 flex justify-end gap-2">
                        <button onClick={() => setViewProfileData(mat)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface hover:bg-blue-50 text-on-surface-variant hover:text-blue-500 transition-colors border border-outline-variant/30" title="View Profile">
                           <span className="material-symbols-outlined text-[16px]">visibility</span>
                        </button>
                        <button onClick={() => handleEdit(mat)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors border border-outline-variant/30" title="Edit">
                           <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button onClick={() => handleDelete(mat.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface hover:bg-red-50 text-on-surface-variant hover:text-red-500 transition-colors border border-outline-variant/30" title="Delete">
                           <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <GlobalPagination 
              totalItems={rawMaterials.length}
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
        entityName="Raw Materials" 
        onUpload={handleBulkUpload}
      />
      <ProfileCardModal 
        isOpen={!!viewProfileData} 
        onClose={() => setViewProfileData(null)} 
        data={viewProfileData} 
        type="Raw Material" 
      />
    </div>
  );
}
