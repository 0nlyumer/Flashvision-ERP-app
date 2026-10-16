import FGCombinationBuilder from "../ui/FGCombinationBuilder";
import React, { useState, Suspense, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';
import GlobalPagination from '../ui/GlobalPagination';
import useDynamicColumns from '../../hooks/useDynamicColumns';
import DraggableResizableHeader from '../ui/DraggableResizableHeader';
import CustomMultiSelect from '../ui/CustomMultiSelect';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Failed to load 3D model:", error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function RealModel({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function DummyModel({ type }) {
  if (type === 'Cloth' || type === 'Textiles') {
    return (
      <mesh>
        <cylinderGeometry args={[1, 1, 2, 32]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
    );
  } else if (type === 'Chemical') {
    return (
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="#10b981" />
      </mesh>
    );
  } else if (type === 'Plastic') {
    return (
      <mesh>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
    );
  } else {
    return (
      <mesh>
        <torusGeometry args={[1, 0.4, 16, 100]} />
        <meshStandardMaterial color="#8b5cf6" />
      </mesh>
    );
  }
}

function Model({ type, url }) {
  const [isUrlValid, setIsUrlValid] = useState(null);

  React.useEffect(() => {
    if (!url) {
      setIsUrlValid(false);
      return;
    }
    const isValidFormat = typeof url === 'string' && (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://'));
    if (!isValidFormat) {
      setIsUrlValid(false);
      return;
    }

    // Safely check if the URL is fetchable before rendering in ThreeJS
    fetch(url)
      .then(res => {
        if (res.ok) {
          setIsUrlValid(true);
        } else {
          setIsUrlValid(false);
        }
      })
      .catch(() => {
        setIsUrlValid(false);
      });
  }, [url]);

  if (isUrlValid === null) {
    return null; // Silent loader state
  }

  if (isUrlValid) {
    return (
      <ErrorBoundary fallback={<DummyModel type={type} />}>
        <Suspense fallback={null}>
          <RealModel url={url} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return <DummyModel type={type} />;
}

const getSafeItemWithDeptStock = (item) => {
    const nextItem = { ...item };
    if (!nextItem.stockByDepartment) {
        nextItem.stockByDepartment = {};
    }
    const depts = (nextItem.department || '').split(',').map(d => d.trim()).filter(Boolean);
    depts.forEach((dept, idx) => {
        if (nextItem.stockByDepartment[dept] === undefined) {
            if (idx === 0) {
                nextItem.stockByDepartment[dept] = Number(nextItem.stock || 0);
            } else {
                nextItem.stockByDepartment[dept] = 0;
            }
        }
    });
    nextItem.stock = Object.values(nextItem.stockByDepartment).reduce((sum, val) => sum + Number(val || 0), 0);
    return nextItem;
};

const DEFAULT_COLUMNS = [
  { id: 'sku', label: 'Item ID', visible: true, width: 120 },
  { id: 'name', label: 'Product Details', visible: true, width: 250 },
  { id: 'stock', label: 'Stock Level', visible: true, width: 120 },
  { id: 'rolls', label: 'Rolls', visible: true, width: 100 },
  { id: 'uom', label: 'UOM', visible: true, width: 80 },
  { id: 'category', label: 'Category', visible: false, width: 120 },
  { id: 'rawMaterialType', label: 'Item Type', visible: false, width: 120 },
  { id: 'subCategory', label: 'Subcategory', visible: false, width: 120 },
  { id: 'price', label: 'Price', visible: false, width: 100 },
  { id: 'alert', label: 'Reorder Level', visible: false, width: 100 },
  { id: 'status', label: 'Status', visible: false, width: 100 },
  { id: 'specifications', label: 'Specifications', visible: false, width: 200 },
  { id: 'backClothId', label: 'Back Cloth', visible: false, width: 120 },
  { id: 'packingType', label: 'Packing Type', visible: false, width: 120 },
  { id: 'packingSize', label: 'Packing Size', visible: false, width: 120 },
  { id: 'uomNumber', label: 'UOM Base Qty', visible: false, width: 120 },
  { id: 'rollSize', label: 'Roll Size', visible: false, width: 100 }
];

export default function InvStock({ selectedDepartments = [], selectable = false, selectedIds = [], onToggleSelect, onSelectAll, flattenTypes = false, excludeSaleOrderStock = false }) {
  const { state, toggleGlobalPagination } = useApp();
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOutputTypes, setSelectedOutputTypes] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showColSettings, setShowColSettings] = useState(false);

  // Check if selected department contains finished goods items
  const hasFinishedGoodsInDept = useMemo(() => {
    const depts = selectedDepartments || [];
    const allItems = state.items || [];

    const isFG = (item) => {
      if (!item) return false;
      const cat = (item.category || '').toLowerCase().trim();
      const rmType = (item.rawMaterialType || '').toLowerCase().trim();
      const type = (item.type || '').toLowerCase().trim();
      return (
        cat.includes('finish') ||
        rmType.includes('finish') ||
        type.includes('finish')
      );
    };

    if (depts.length > 0) {
      return allItems.some(item => {
        const itemDept = item.department || '';
        const inSelected = depts.some(d => {
          const dVal = typeof d === 'string' ? d : (d?.value || d?.label || '');
          return (
            dVal === itemDept ||
            dVal.toLowerCase() === itemDept.toLowerCase() ||
            (Array.isArray(item.departments) && item.departments.some(dep => (typeof dep === 'string' ? dep : dep?.value)?.toLowerCase() === dVal.toLowerCase()))
          );
        });
        return inSelected && isFG(item);
      });
    }

    return allItems.some(isFG);
  }, [selectedDepartments, state.items]);

  const { columns, visibleColumns, toggleColumn, resizeColumn, moveColumn } = useDynamicColumns(DEFAULT_COLUMNS, 'InvStock_columns');
  const colSettingsRef = useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (colSettingsRef.current && !colSettingsRef.current.contains(event.target)) {
        setShowColSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOutputType = (type) => {
      setSelectedOutputTypes(prev => 
          prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
      );
  };

  const availableTypes = useMemo(() => Array.from(new Set(
      state.items.flatMap(item => item.stockByType ? Object.keys(item.stockByType) : [])
  )).filter(Boolean), [state.items]);

  const filteredRows = useMemo(() => {
      let items = state?.items || [];
      
      if (selectedDepartments && selectedDepartments.length > 0) {
          items = items.filter(item => {
              const safeItem = getSafeItemWithDeptStock(item);
              const depts = (safeItem.department || '').split(',').map(d => d.trim()).filter(Boolean);
              return depts.some(d => selectedDepartments.includes(d)) || 
                     selectedDepartments.some(dept => safeItem.stockByDepartment && safeItem.stockByDepartment[dept] > 0);
          });
      }

      // Apply search filter
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          items = items.filter(r => 
              (r.sku || r.id)?.toLowerCase().includes(lowerTerm) ||
              r.name?.toLowerCase().includes(lowerTerm)
          );
      }

      const mappedItems = [];
      
      items.forEach(item => {
          const safeItem = getSafeItemWithDeptStock(item);
          let totalStock = 0;
          if (selectedDepartments && selectedDepartments.length > 0) {
              selectedDepartments.forEach(dept => {
                  totalStock += safeItem.stockByDepartment?.[dept] || 0;
              });
              if (totalStock === 0 && (!safeItem.stockByDepartment || Object.keys(safeItem.stockByDepartment).length === 0)) {
                  totalStock = parseFloat(safeItem.stock ?? safeItem.stockLevel ?? safeItem.quantity ?? safeItem.qty ?? 0) || 0;
              }
          } else {
              totalStock = parseFloat(safeItem.stock ?? safeItem.stockLevel ?? safeItem.quantity ?? safeItem.qty ?? 0) || 0;
          }

          let hasTypes = false;
          const stockTypesData = [];
          
          if (safeItem.stockByType && Object.keys(safeItem.stockByType).length > 0) {
              hasTypes = true;
              totalStock = 0; // Reset and calculate from types
              Object.entries(safeItem.stockByType).forEach(([typeName, qty]) => {
                  if (selectedOutputTypes.length === 0 || selectedOutputTypes.includes(typeName)) {
                      totalStock += qty;
                  }
                  stockTypesData.push({ typeName, qty });
              });
          }

          let allocatedLegacy = 0;
          if (excludeSaleOrderStock) {
              const orders = state?.saleOrders || [];
              orders.forEach(o => {
                  if (o.status !== 'Delivered' && o.status !== 'Cancelled') {
                      o.items?.forEach(i => {
                          if (i.itemId === safeItem.id || i.itemCode === safeItem.sku || i.itemCode === safeItem.id) {
                              const prod = parseFloat(i.producedQty) || 0;
                              const disp = (parseFloat(i.dispatchedQty) || 0) + (parseFloat(i.deliveredQty) || 0);
                              if (prod > disp) {
                                  allocatedLegacy += (prod - disp);
                              }
                          }
                      });
                  }
              });
              
              if (allocatedLegacy > 0) {
                  totalStock = Math.max(0, totalStock - allocatedLegacy);
                  if (hasTypes) {
                      let remainingAllocated = allocatedLegacy;
                      stockTypesData.forEach(t => {
                          if (remainingAllocated <= 0) return;
                          let deduct = Math.min(t.qty, remainingAllocated);
                          t.qty -= deduct;
                          remainingAllocated -= deduct;
                      });
                  }
              }
          } else {
              // Fallback for legacy data
              let legacyStock = 0;
              const orders = state?.saleOrders || [];
              orders.forEach(o => {
                  o.items?.forEach(i => {
                      if (i.itemId === safeItem.id || i.itemCode === safeItem.sku || i.itemCode === safeItem.id) {
                          legacyStock += (parseFloat(i.producedQty) || 0) - (parseFloat(i.dispatchedQty) || 0);
                      }
                  });
              });
              if (legacyStock > 0 && totalStock === 0) {
                  totalStock = legacyStock;
              }
          }

          if (flattenTypes && hasTypes) {
              stockTypesData.forEach(t => {
                  if (t.qty > 0 && (selectedOutputTypes.length === 0 || selectedOutputTypes.includes(t.typeName))) {
                      mappedItems.push({
                          ...safeItem,
                          displayStock: t.qty,
                          displayType: t.typeName,
                          displayUom: safeItem.uom || 'Unit',
                          uniqueKey: `${safeItem.id}:::${t.typeName}`,
                          hasTypes: false,
                          name: `${safeItem.name} (${t.typeName})`,
                          stockTypesData: []
                      });
                  }
              });
          } else {
              // In flattenTypes mode, only push if stock > 0. Otherwise, normal logic.
              if (totalStock > 0 || !excludeSaleOrderStock) {
                  mappedItems.push({
                      ...safeItem,
                      displayStock: totalStock,
                      displayType: hasTypes ? 'Multiple Types' : 'Standard',
                      displayUom: safeItem.uom || 'Unit',
                      uniqueKey: safeItem.id,
                      hasTypes,
                      stockTypesData
                  });
              }
          }
      });
      
      return mappedItems;
  }, [state.items, state.saleOrders, selectedDepartments, searchTerm, selectedOutputTypes, flattenTypes, excludeSaleOrderStock]);

  // Pagination Logic
  const isPaginated = state?.isGlobalPaginated;
  const displayedRows = isPaginated 
      ? filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      : filteredRows;

  const activeItem = selectedItem || (filteredRows.length > 0 ? filteredRows[0] : null);

  const renderCell = (colId, item) => {
    switch(colId) {
        case 'sku':
            return <span className="font-mono font-medium text-xs text-primary">{item.sku || item.id}</span>;
        case 'name':
            return (
                <div className="flex items-center gap-3">
                  {item.image ? (
                      <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover shadow-sm border border-outline-variant/20 shrink-0" />
                  ) : (
                      <div className="w-10 h-10 rounded-lg bg-secondary-container/30 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>inventory_2</span>
                      </div>
                  )}
                  <div>
                    <div className="font-bold text-sm text-on-surface">{item.name || 'Unknown Item'}</div>
                    <div className="text-[10px] text-on-surface-variant max-w-[180px] truncate" title={item.description || item.specifications}>{item.description || item.specifications || 'No description'}</div>
                  </div>
                </div>
            );
        case 'stock':
            return (
                <span className="font-bold text-sm text-on-surface">
                    {item.displayStock.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}
                </span>
            );
        case 'rolls':
            return (
                <span className="text-xs font-medium text-on-surface-variant">
                    {item.rollSize && item.rollSize > 0 ? (item.displayStock / item.rollSize).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2}) : '-'}
                </span>
            );
        case 'uom':
            return <span className="text-xs text-on-surface-variant font-bold text-tertiary">{item.displayUom}</span>;
        case 'price':
            return <span className="text-sm">Rs. {item.price || '0.00'}</span>;
        case 'status':
            return (
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {item.status || "Active"}
                </span>
            );
        case 'category':
            return <span className="text-sm font-medium text-on-surface-variant">{item.category || item.type || '-'}</span>;
        case 'rawMaterialType':
            return <span className="text-sm font-medium text-on-surface-variant">{item.rawMaterialType || '-'}</span>;
        default:
            return <span className="text-sm text-on-surface-variant truncate block">{item[colId] || '-'}</span>;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 flex-1 w-full h-[calc(100vh-140px)] min-h-[640px] animate-in fade-in duration-300 max-w-full">
      {/* Left Main List */}
      <div className="flex-1 bg-surface-container-lowest rounded-[1.75rem] shadow-[0_16px_36px_rgba(0,28,56,0.05)] border border-outline-variant/10 flex flex-col overflow-hidden h-full">
        <div className="px-6 py-3.5 border-b border-outline-variant/10 flex flex-col gap-2.5 bg-surface/50 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold font-manrope text-on-surface leading-tight">Stock Inventory</h3><p className="text-xs text-on-surface-variant">Real-time oversight of synthetic assets</p>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input 
                  type="text" 
                  placeholder="Search by ID, name, or SKU..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant/30 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            {hasFinishedGoodsInDept && (
              <FGCombinationBuilder compact={false} placeholder="Combination Filter" allowCreation={false} onSelectItem={(chosen) => setSearchTerm(chosen.name)} />
            )}
          </div>
          
          {filteredRows.some(i => i.category?.toLowerCase() === 'finished goods' || i.rawMaterialType?.toLowerCase() === 'finished good' || i.category?.toLowerCase() === 'finish good') && availableTypes.length > 0 && (
             <div className="flex flex-wrap gap-2 items-center">
                 <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-2">Output Types Filter:</span>
                 {availableTypes.map(type => (
                     <button
                         key={type}
                         onClick={() => toggleOutputType(type)}
                         className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                             selectedOutputTypes.includes(type)
                                 ? 'bg-primary text-white border-primary shadow-sm'
                                 : 'bg-surface border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                         }`}
                     >
                         {type}
                     </button>
                 ))}
                 {selectedOutputTypes.length > 0 && (
                     <button 
                         onClick={() => setSelectedOutputTypes([])}
                         className="text-xs text-error hover:underline ml-2"
                     >
                         Clear Filter
                     </button>
                 )}
             </div>
          )}
        </div>
        
        <div className="flex-1 overflow-auto relative">
            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', minWidth: `${visibleColumns.reduce((acc, col) => acc + (col.width || 120), 0) + 50}px` }}>
                <thead className="sticky top-0 bg-surface-container-low/90 backdrop-blur-md z-10 border-b border-outline-variant/20 shadow-sm">
                    <tr className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">
                        {selectable && (
                            <th className="px-6 py-4 w-12 text-center">
                                <input 
                                    type="checkbox"
                                    checked={displayedRows.length > 0 && displayedRows.every(r => selectedIds.includes(r.uniqueKey))}
                                    ref={input => { 
                                        if(input) {
                                            const some = displayedRows.some(r => selectedIds.includes(r.uniqueKey));
                                            const all = displayedRows.length > 0 && displayedRows.every(r => selectedIds.includes(r.uniqueKey));
                                            input.indeterminate = some && !all; 
                                        }
                                    }}
                                    onChange={(e) => {
                                        if (onSelectAll) {
                                            const ids = displayedRows.map(r => r.uniqueKey);
                                            onSelectAll(ids, e.target.checked);
                                        }
                                    }}
                                    className="rounded text-primary focus:ring-primary/20 border-outline-variant/50 w-4 h-4 cursor-pointer" 
                                />
                            </th>
                        )}
                        {visibleColumns.map((col, index) => (
                            <DraggableResizableHeader 
                                key={col.id}
                                id={col.id}
                                defaultWidth={col.width}
                                onResize={resizeColumn}
                                onMove={moveColumn}
                                className={`px-6 py-4 ${index === visibleColumns.length - 1 ? 'pr-12' : ''}`}
                            >
                                {col.label}
                            </DraggableResizableHeader>
                        ))}
                        <th className="w-full"></th>
                    </tr>
                    {/* Settings Dropdown Button in Header */}
                    <th className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center">
                        <div className="relative" ref={colSettingsRef}>
                            <button 
                                onClick={() => setShowColSettings(!showColSettings)}
                                className="w-8 h-8 rounded-full hover:bg-on-surface/5 flex items-center justify-center text-on-surface-variant transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">more_vert</span>
                            </button>
                            {showColSettings && (
                                <div className="absolute right-0 top-full mt-1 w-56 bg-surface rounded-xl shadow-lg border border-outline-variant/20 p-2 z-50 animate-in fade-in slide-in-from-top-2 text-none lowercase !normal-case">
                                    <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-2 border-b border-outline-variant/10 mb-2 text-left">
                                        Visible Columns
                                    </div>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1 text-left">
                                        {columns.map(col => (
                                            <label key={col.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors">
                                                <input 
                                                    type="checkbox" 
                                                    checked={col.visible}
                                                    onChange={() => toggleColumn(col.id)}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant/30"
                                                />
                                                <span className="text-sm font-medium text-on-surface normal-case capitalize leading-tight">{col.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </th>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                    {displayedRows.length > 0 ? displayedRows.map(row => (
                        <tr 
                            key={row.uniqueKey} 
                            onClick={() => setSelectedItem(row)}
                            className={`cursor-pointer transition-colors hover:bg-primary/5 ${activeItem?.id === row.id ? 'bg-primary/10 border-l-4 border-primary' : 'border-l-4 border-transparent'}`}
                        >
                            {selectable && (
                                <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                    <input 
                                        type="checkbox"
                                        checked={selectedIds.includes(row.uniqueKey)}
                                        onChange={(e) => {
                                            if (onToggleSelect) onToggleSelect(row.uniqueKey, e.target.checked);
                                        }}
                                        className="rounded text-primary focus:ring-primary border-outline-variant w-4 h-4 cursor-pointer" 
                                    />
                                </td>
                            )}
                            {visibleColumns.map((col, index) => (
                                <td key={col.id} className="px-6 py-4 truncate">
                                    {renderCell(col.id, row)}
                                </td>
                            ))}
                            <td></td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={visibleColumns.length + 1} className="text-center py-12 text-on-surface-variant">No items found matching criteria.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Pagination & Toggle Area */}
        <GlobalPagination 
            totalItems={filteredRows.length}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
        />
      </div>

      {/* Right Side Panel */}
      <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col gap-3.5 h-full">
          {/* Top 3D Viewer (Free space) */}
          <div className="h-44 xl:h-50 relative flex items-center justify-center shrink-0 bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden">
               <ErrorBoundary fallback={
                   <div className="w-full h-full flex flex-col items-center justify-center text-on-surface-variant gap-2 p-4">
                       {activeItem?.image ? (
                           <img src={activeItem.image} alt={activeItem.name} className="w-24 h-24 rounded-xl object-cover shadow-sm" />
                       ) : (
                           <span className="material-symbols-outlined text-5xl opacity-40">category</span>
                       )}
                       <span className="text-xs font-semibold">2D Item Preview</span>
                   </div>
               }>
                   <Canvas shadows camera={{ position: [0, 0, 4], fov: 50 }} className="w-full h-full cursor-move">
                       <ambientLight intensity={0.5} />
                       <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} castShadow />
                       <OrbitControls makeDefault autoRotate autoRotateSpeed={1.5} enablePan={false} />
                       <Suspense fallback={null}>
                          <Stage environment="city" intensity={0.6}>
                             <Model type={activeItem?.rawMaterialType || activeItem?.subCategory || activeItem?.category} url={activeItem?.model3d} />
                          </Stage>
                       </Suspense>
                   </Canvas>
               </ErrorBoundary>
          </div>

          {/* Bottom Details Panel */}
          {activeItem ? (
             <div className="flex-1 bg-surface-container-lowest rounded-[1.75rem] shadow-[0_16px_36px_rgba(0,28,56,0.05)] border border-outline-variant/10 p-5 flex flex-col overflow-y-auto custom-scrollbar">
                 <div className="flex justify-between items-start mb-6">
                     <div>
                         <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary mb-2 inline-block">
                             {activeItem.category || activeItem.type || 'Inventory Item'}
                         </span>
                         <h2 className="text-2xl font-black text-on-surface">{activeItem.name}</h2>
                         <p className="font-mono text-sm text-on-surface-variant">{activeItem.sku || activeItem.id}</p>
                     </div>
                 </div>

                 <div className="space-y-6">
                     {activeItem.hasTypes && activeItem.stockTypesData.length > 0 ? (
                         <div className="space-y-3">
                             <h4 className="text-xs uppercase font-bold tracking-widest text-on-surface-variant">Output Types Stock</h4>
                             <div className="grid grid-cols-2 gap-3">
                                 {activeItem.stockTypesData.map(t => (
                                     <div key={t.typeName} className={`p-4 rounded-2xl border ${t.typeName.toLowerCase().includes('wastage') ? 'bg-error/5 border-error/20' : 'bg-surface border-outline-variant/20'}`}>
                                         <p className={`text-[10px] uppercase tracking-wider mb-1 font-bold ${t.typeName.toLowerCase().includes('wastage') ? 'text-error' : 'text-on-surface-variant'}`}>{t.typeName}</p>
                                         <p className={`text-xl font-bold ${t.typeName.toLowerCase().includes('wastage') ? 'text-error' : 'text-emerald-600'}`}>{t.qty.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})} <span className="text-xs font-medium text-on-surface-variant ml-1">{t.typeName.toLowerCase().includes('wastage') ? 'Kgs' : activeItem.uom}</span></p>
                                     </div>
                                 ))}
                             </div>
                             <div className="bg-surface-container-low p-4 rounded-xl flex justify-between items-center mt-2">
                                 <span className="text-sm font-bold text-on-surface">Total Selected Filtered</span>
                                 <div className="text-right">
                                     <span className="text-lg font-black text-on-surface block">{activeItem.displayStock.toLocaleString()} {activeItem.uom}</span>
                                     <span className="text-xs text-on-surface-variant font-medium">Rolls: {activeItem.rollSize && activeItem.rollSize > 0 ? (activeItem.displayStock / activeItem.rollSize).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2}) : '-'}</span>
                                 </div>
                             </div>
                         </div>
                     ) : (
                         <div className="grid grid-cols-2 gap-4">
                             <div className="bg-surface p-4 rounded-2xl border border-outline-variant/20">
                                 <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1 font-bold">In Stock</p>
                                 <p className="text-xl font-bold text-emerald-600">{activeItem.displayStock.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})} <span className="text-sm font-medium text-on-surface-variant ml-1">{activeItem.uom}</span></p>
                             </div>
                             <div className="bg-surface p-4 rounded-2xl border border-outline-variant/20">
                                 <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1 font-bold">Rolls Quantity</p>
                                 <p className="text-xl font-bold text-primary">{activeItem.rollSize && activeItem.rollSize > 0 ? (activeItem.displayStock / activeItem.rollSize).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2}) : '-'} <span className="text-sm font-medium text-on-surface-variant ml-1">Rolls</span></p>
                             </div>
                             <div className="bg-surface p-4 rounded-2xl border border-outline-variant/20 col-span-2">
                                 <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1 font-bold">Packing Size</p>
                                 <p className="text-xl font-bold text-primary">{activeItem.packingSizeRaw || activeItem.packingSize || '-'} <span className="text-sm font-medium text-on-surface-variant ml-1">{activeItem.packingType}</span></p>
                             </div>
                         </div>
                     )}

                     <div>
                         <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                             <span className="material-symbols-outlined text-[18px] text-primary">info</span> Detail Specifications
                         </h4>
                         <div className="bg-surface-container-low/50 rounded-xl p-4 text-sm text-on-surface-variant leading-relaxed">
                             {activeItem.specifications || 'No detailed specifications provided for this item.'}
                         </div>
                     </div>

                     <div className="pt-4 border-t border-outline-variant/10">
                         <div className="flex justify-between items-center">
                             <span className="text-sm text-on-surface-variant">Estimated Cost:</span>
                             <span className="font-bold text-on-surface text-lg">Rs. {activeItem.price || '0.00'}</span>
                         </div>
                     </div>
                 </div>
             </div>
          ) : (
             <div className="flex-1 bg-surface-container-lowest rounded-[2rem] border border-outline-variant/10 flex items-center justify-center p-6 text-center">
                 <div>
                     <div className="w-16 h-16 bg-surface-container mx-auto rounded-full flex items-center justify-center text-outline mb-4">
                         <span className="material-symbols-outlined text-2xl">touch_app</span>
                     </div>
                     <p className="text-on-surface-variant font-medium">Select an item from the list to view its 3D model and complete stock details.</p>
                 </div>
             </div>
          )}
      </div>
    </div>
  );
}
