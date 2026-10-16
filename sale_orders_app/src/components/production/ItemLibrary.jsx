import FGCombinationBuilder from "../ui/FGCombinationBuilder";
import React, { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';
import CustomMultiSelect from '../ui/CustomMultiSelect';
import GlobalPagination from '../ui/GlobalPagination';
import useDynamicColumns from '../../hooks/useDynamicColumns';
import DraggableResizableHeader from '../ui/DraggableResizableHeader';
import { formatCurrencyPKR } from '../../utils/currencyUtils';

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
  { id: 'sku', label: 'Item Code', visible: true, width: 120 },
  { id: 'name', label: 'Name', visible: true, width: 200 },
  { id: 'category', label: 'Category', visible: true, width: 120 },
  { id: 'rawMaterialType', label: 'Item Type', visible: true, width: 120 },
  { id: 'subCategory', label: 'Subcategory', visible: true, width: 120 },
  { id: 'uom', label: 'UOM', visible: true, width: 80 },
  { id: 'stock', label: 'Stock Level', visible: true, width: 120 },
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

export default function ItemLibrary() {
  const { state, setCollection, currencySymbol } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState(() => {
      const saved = localStorage.getItem('ItemLibrary_departments');
      return saved ? JSON.parse(saved) : [];
  });
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
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { columns, visibleColumns, toggleColumn, resizeColumn, moveColumn } = useDynamicColumns(DEFAULT_COLUMNS, 'ItemLibrary_columns');
  const fileInputRef = useRef(null);
  const colSettingsRef = useRef(null);

  // Setup click outside for settings
  useEffect(() => {
    function handleClickOutside(event) {
        if (colSettingsRef.current && !colSettingsRef.current.contains(event.target)) {
            setShowColSettings(false);
        }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const availableTypes = useMemo(() => Array.from(new Set(
      (state.items || []).flatMap(item => item.stockByType ? Object.keys(item.stockByType) : [])
  )).filter(Boolean), [state.items]);

  const toggleOutputType = (type) => {
      setSelectedOutputTypes(prev => 
          prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
      );
  };

  const filteredItems = useMemo(() => {
      let items = state?.items || [];
      
      if (selectedDepartments && selectedDepartments.length > 0) {
          items = items.filter(item => {
              const safeItem = getSafeItemWithDeptStock(item);
              const depts = (safeItem.department || '').split(',').map(d => d.trim()).filter(Boolean);
              return depts.some(d => selectedDepartments.includes(d)) || 
                     selectedDepartments.some(dept => safeItem.stockByDepartment && safeItem.stockByDepartment[dept] > 0);
          });
      } else {
          // If no department is selected, show nothing
          return [];
      }

      const lowerQuery = searchQuery.toLowerCase();
      items = items.filter(i => {
        if (searchQuery && !(i.name.toLowerCase().includes(lowerQuery) || i.sku.toLowerCase().includes(lowerQuery))) {
            return false;
        }
        return true;
      });

      return items.map(item => {
        const safeItem = getSafeItemWithDeptStock(item);
        let totalStock = 0;
        if (selectedDepartments && selectedDepartments.length > 0) {
            selectedDepartments.forEach(dept => {
                totalStock += safeItem.stockByDepartment[dept] || 0;
            });
        } else {
            totalStock = safeItem.stock || 0;
        }
        let hasTypes = false;
        
        if (safeItem.stockByType && Object.keys(safeItem.stockByType).length > 0) {
            hasTypes = true;
            totalStock = 0; // recalculate based on selection
            Object.entries(safeItem.stockByType).forEach(([typeName, qty]) => {
                if (selectedOutputTypes.length === 0 || selectedOutputTypes.includes(typeName)) {
                    totalStock += qty;
                }
            });
        }
        return {
            ...safeItem,
            displayStock: totalStock,
            hasTypes
        };
    });
  }, [state.items, selectedDepartments, searchQuery, selectedOutputTypes]);

  const displayedItems = state?.isGlobalPaginated
    ? filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredItems;

  const activeItem = selectedItem || (filteredItems.length > 0 ? filteredItems[0] : null);
  const hasFinishedGoods = filteredItems.some(i => i.category?.toLowerCase() === 'finished goods' || i.rawMaterialType?.toLowerCase() === 'finished good' || i.category?.toLowerCase() === 'finish good');

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && activeItem) {
      const imageUrl = URL.createObjectURL(file);
      const updatedItems = state.items.map(item => 
        item.id === activeItem.id ? { ...item, image: imageUrl } : item
      );
      setCollection('items', updatedItems);
      setSelectedItem({ ...activeItem, image: imageUrl });
    }
  };

  const renderCell = (colId, item) => {
    switch(colId) {
        case 'sku':
            return <span className="font-mono text-xs text-primary font-bold">{item.sku}</span>;
        case 'name':
            return (
                <div className="flex items-center gap-3">
                    {item.image ? (
                        <img src={item.image} alt={item.name} className="w-8 h-8 rounded-lg object-cover shadow-sm border border-outline-variant/20 shrink-0" />
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center border border-outline-variant/20 shrink-0">
                            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">category</span>
                        </div>
                    )}
                    <span className="font-medium text-sm text-on-surface truncate">{item.name}</span>
                </div>
            );
        case 'stock':
            return (
                <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${item.displayStock > (item.alert || 10) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {item.displayStock.toLocaleString()}
                </span>
            );
        case 'uom':
            return <span className="text-sm font-bold text-tertiary">{item.uom || '-'}</span>;
        case 'price':
            return <span className="text-sm">{formatCurrencyPKR(item.price)}</span>;
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
    <div className="flex flex-col gap-2 flex-1 w-full h-[calc(100vh-140px)] min-h-[640px] animate-in fade-in duration-300">
      {/* Top Controls outside table */}
      <div className="flex justify-end pr-2 mb-1"><div className="w-[280px]">
          <CustomMultiSelect 
              options={(state.departments || []).map(d => ({ value: d.value, label: d.label }))}
              selectedValues={selectedDepartments}
              onChange={setSelectedDepartments}
              placeholder="Filter by Department..."
          />
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 flex-1 w-full h-full min-h-0 max-w-full">
        {/* Left Main List */}
        <div className="flex-1 bg-surface-container-lowest rounded-[1.75rem] shadow-[0_16px_36px_rgba(0,28,56,0.05)] border border-outline-variant/10 flex flex-col overflow-hidden h-full">
          <div className="px-6 py-3.5 border-b border-outline-variant/10 flex flex-col gap-2.5 bg-surface/50 shrink-0">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold font-manrope text-on-surface leading-tight">Item Inventory</h3><p className="text-xs text-on-surface-variant">Manage and view stock details of all items</p>
              </div>
              <div className="flex gap-4 items-center">
                  <div className="relative w-72">
                     <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                     <input 
                        type="text" 
                        placeholder="Search items..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant/30 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                     />
                  </div>
                  {hasFinishedGoodsInDept && (
                    <FGCombinationBuilder compact={false} placeholder="Combination" allowCreation={false} onSelectItem={(chosen) => setSearchQuery(chosen.name)} />
                  )}
                  {/* Settings Dropdown Button */}
                  <div className="relative" ref={colSettingsRef}>
                      <button 
                          onClick={() => setShowColSettings(!showColSettings)}
                          className="w-10 h-10 bg-surface border border-outline-variant/30 rounded-xl flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
                          title="Configure Columns"
                      >
                          <span className="material-symbols-outlined text-[20px]">view_week</span>
                      </button>
                      {showColSettings && (
                          <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl shadow-lg border border-outline-variant/20 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                              <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-3 py-2 border-b border-outline-variant/10 mb-2">
                                  Visible Columns
                              </div>
                              <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                  {columns.map(col => (
                                      <label key={col.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors">
                                          <input 
                                              type="checkbox" 
                                              checked={col.visible}
                                              onChange={() => toggleColumn(col.id)}
                                              className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant/30"
                                          />
                                          <span className="text-sm font-medium text-on-surface">{col.label}</span>
                                      </label>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
            </div>
          
          {hasFinishedGoods && availableTypes.length > 0 && (
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
                    <tr className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">
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
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                    {displayedItems.length > 0 ? displayedItems.map(item => (
                        <tr 
                            key={item.id} 
                            onClick={() => setSelectedItem(item)}
                            className={`cursor-pointer transition-colors hover:bg-primary/5 ${activeItem?.id === item.id ? 'bg-primary/10 border-l-4 border-primary' : 'border-l-4 border-transparent'}`}
                        >
                            {visibleColumns.map((col, index) => (
                                <td key={col.id} className="px-6 py-4 truncate">
                                    {renderCell(col.id, item)}
                                </td>
                            ))}
                            <td></td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={visibleColumns.length} className="text-center py-12 text-on-surface-variant">No items found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        
        <GlobalPagination 
            totalItems={filteredItems.length}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
        />
      </div>

      {/* Right Side Panel */}
      <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col gap-3.5 h-full">
          {/* Top 3D Viewer */}
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
                             {activeItem.rawMaterialType || activeItem.category || 'Inventory Item'}
                         </span>
                         <h2 className="text-2xl font-black text-on-surface">{activeItem.name}</h2>
                         <p className="font-mono text-sm text-on-surface-variant">{activeItem.sku}</p>
                     </div>
                 </div>

                 <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                         <div className="bg-surface p-4 rounded-2xl border border-outline-variant/20 col-span-2">
                             <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1 font-bold">Department</p>
                             <p className="text-xl font-bold text-primary">{activeItem.department || 'N/A'}</p>
                         </div>
                         <div className="bg-surface p-4 rounded-2xl border border-outline-variant/20">
                             <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1 font-bold">In Stock</p>
                             <p className="text-xl font-bold text-emerald-600">{activeItem.displayStock || 0} <span className="text-sm font-medium">{activeItem.uom}</span></p>
                         </div>
                         <div className="bg-surface p-4 rounded-2xl border border-outline-variant/20">
                             <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1 font-bold">Packing Size</p>
                             <p className="text-xl font-bold text-primary">{activeItem.packingSizeRaw || activeItem.packingSize || '-'} <span className="text-sm font-medium text-on-surface-variant ml-1">{activeItem.packingType}</span></p>
                         </div>
                     </div>

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
                             <span className="font-bold text-on-surface text-lg">{formatCurrencyPKR(activeItem.price)}</span>
                         </div>
                     </div>
                 </div>
             </div>
          ) : (
              <div className="flex-1 bg-surface-container-lowest rounded-[2rem] shadow-[0_20px_40px_rgba(0,28,56,0.06)] border border-outline-variant/10 flex items-center justify-center p-6 text-center">
                  <div className="text-on-surface-variant space-y-2">
                      <span className="material-symbols-outlined text-4xl opacity-50">inventory</span>
                      <p className="font-bold">No Item Selected</p>
                      <p className="text-sm">Select an item from the list to view its details.</p>
                  </div>
              </div>
          )}
      </div>
      </div>
    </div>
  );
}
