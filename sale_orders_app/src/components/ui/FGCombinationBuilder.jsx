import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import {
  DEFAULT_FG_CONFIG,
  getInitialFGConfig,
  generateFGDisplayName,
  matchItemToCombination,
  createFinishedGoodFromCombo,
  parseRollSizeFromPacking,
  normalizeFGConfig,
  applyAutoSelect,
  detectTypeToken,
  effectiveMasking,
  FG_MASK_FIELDS
} from '../../utils/fgCombinationUtils';
import {
  findClothItemForFabric,
  clothStockMeters,
  listClothItems,
  comboFromClothItem,
  reconcileClothSelection,
  clothItemTypeToken
} from '../../utils/clothRequirement';
import FGQuickConfigModal from './FGQuickConfigModal';

export default function FGCombinationBuilder({
  onSelectItem,
  allowCreation = false,
  allowQuickConfig = true,
  placeholder = 'Builder',
  compact = true,
  buttonClassName = ''
}) {
  const { state } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isQuickConfigOpen, setIsQuickConfigOpen] = useState(false);
  const [isMatchDropdownOpen, setIsMatchDropdownOpen] = useState(true);

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const matchDropdownRef = useRef(null);
  const [panelCoords, setPanelCoords] = useState({ top: 0, left: 0, width: 1200 });
  const [hasBeenDragged, setHasBeenDragged] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ mouseX: 0, mouseY: 0, initialTop: 0, initialLeft: 0 });

  // Dynamic configuration with live local sync (normalized so masking
  // defaults + auto-select seeds exist even for older saved configs)
  const [config, setConfig] = useState(() => normalizeFGConfig(state.fg_combinations_config || getInitialFGConfig()));

  useEffect(() => {
    if (state.fg_combinations_config) {
      setConfig(normalizeFGConfig(state.fg_combinations_config));
    }
  }, [state.fg_combinations_config]);

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail) {
        setConfig(normalizeFGConfig(e.detail));
      }
    };
    window.addEventListener('fg-config-updated', handleUpdate);
    return () => window.removeEventListener('fg-config-updated', handleUpdate);
  }, []);

  // Per-item masking overrides for THIS registration only (maskKey -> masked)
  const [maskOverrides, setMaskOverrides] = useState({});
  const masking = useMemo(() => effectiveMasking(config, maskOverrides), [config, maskOverrides]);

  // Combination selection state. Fabric is a REAL cloth item from
  // inventory (RM + rawMaterialType 'Cloth', the Cloth Quality Setup
  // list): clothItemId is the pick; fabricName/fabricColor derive from it.
  const [combo, setCombo] = useState({
    paperCode: '',
    baseItem: '',
    color: '',
    layers: '',
    fabricName: '',
    fabricColor: '',
    clothItemId: '',
    packing: '',
    department: ''
  });

  // Real cloth items from inventory — the Fabric dropdown's options.
  const clothItems = useMemo(() => listClothItems(state.items || []), [state.items]);

  const selectedClothItem = useMemo(() => {
    if (!combo.clothItemId) return null;
    return clothItems.find(i => i.id === combo.clothItemId) || null;
  }, [clothItems, combo.clothItemId]);

  // When the Gauge/Item carries a known type (DTY/PC/CN...), the Fabric
  // dropdown narrows to the cloth items of that fabric type; with no type
  // (or no cloth of that type) it lists every cloth item.
  const fabricOptions = useMemo(() => {
    const typeKeys = [
      ...((config.autoSelect?.typeFabric || []).map(r => r.type)),
      ...((config.autoSelect?.typePacking || []).map(r => r.type))
    ];
    const type = detectTypeToken(combo.baseItem, typeKeys);
    if (!type) return clothItems;
    const matching = clothItems.filter(i => clothItemTypeToken(i).toUpperCase() === type);
    return matching.length > 0 ? matching : clothItems;
  }, [clothItems, combo.baseItem, config.autoSelect]);

  // Fabric color is fixed by the picked cloth item (its name carries the
  // color); there is no separate color list anymore.
  const availableFabricColors = useMemo(() => {
    if (!selectedClothItem) return [];
    const { fabricColor } = comboFromClothItem(selectedClothItem);
    return fabricColor ? [fabricColor] : [];
  }, [selectedClothItem]);

  // Count active attributes
  const activeAttributeCount = useMemo(() => {
    return Object.values(combo).filter(Boolean).length;
  }, [combo]);

  // Generated dynamic preview name
  const generatedName = useMemo(() => {
    return generateFGDisplayName(combo, masking);
  }, [combo, masking]);

  // Finished Goods list from state.items
  const finishedGoods = useMemo(() => {
    return (state.items || []).filter(i => i.category === 'Finished Goods' || i.type === 'Finish Good');
  }, [state.items]);

  // Matching items
  const matchingItems = useMemo(() => {
    if (activeAttributeCount === 0) return [];
    return finishedGoods.filter(item => matchItemToCombination(item, combo));
  }, [finishedGoods, combo, activeAttributeCount]);

  const exactMatchExists = useMemo(() => {
    if (!generatedName) return false;
    return finishedGoods.some(i => (i.name || '').toLowerCase() === generatedName.toLowerCase());
  }, [finishedGoods, generatedName]);

  // Stock hints: cloth stock resolves from inventory by fabric + fabric
  // color; paper stock shows only when the paper is tracked as an
  // inventory item (never invented when it is not).
  const clothHint = useMemo(() => {
    if (selectedClothItem) {
      return { cloth: selectedClothItem, stock: clothStockMeters(selectedClothItem) };
    }
    if (!combo.fabricName || !combo.fabricColor) return null;
    const cloth = findClothItemForFabric(combo.fabricName, combo.fabricColor, state.items || []);
    if (!cloth) return null;
    return { cloth, stock: clothStockMeters(cloth) };
  }, [selectedClothItem, combo.fabricName, combo.fabricColor, state.items]);

  const paperHint = useMemo(() => {
    if (!combo.paperCode) return null;
    const code = combo.paperCode.trim().toUpperCase();
    if (!code) return null;
    const paper = (state.items || []).find(i => i && i.category !== 'Finished Goods' &&
      String(i.name || '').toUpperCase().split(/[^A-Z0-9]+/).includes(code));
    if (!paper) return null;
    return { paper, stock: Number(paper.stock ?? 0) || 0, uom: paper.uom || '' };
  }, [combo.paperCode, state.items]);

  const handleSelectField = (field, value) => {
    setCombo(prev => {
      let next = { ...prev, [field]: value };
      // Auto-select: type->fabric / type->packing maps + generic rules
      next = applyAutoSelect(next, field, config);
      // Keep the cloth-item pick coherent with the (possibly auto-set)
      // fabric type: a unique matching cloth item auto-picks, several
      // matches leave the exact pick to the Fabric dropdown.
      next = reconcileClothSelection(next, state.items || []);
      return next;
    });
    setIsMatchDropdownOpen(true);
  };

  // Fabric dropdown pick: a real cloth item. Fabric type + fabric color
  // both derive from the item itself (its name carries both).
  const handleSelectCloth = (itemId) => {
    setCombo(prev => {
      if (!itemId) return { ...prev, clothItemId: '', fabricName: '', fabricColor: '' };
      const item = clothItems.find(i => i.id === itemId);
      if (!item) return prev;
      return { ...prev, ...comboFromClothItem(item) };
    });
    setIsMatchDropdownOpen(true);
  };

  const toggleMaskOverride = (maskKey) => {
    setMaskOverrides(prev => ({ ...prev, [maskKey]: !(masking[maskKey]) }));
  };

  const handleReset = () => {
    setCombo({
      paperCode: '',
      baseItem: '',
      color: '',
      layers: '',
      fabricName: '',
      fabricColor: '',
      clothItemId: '',
      packing: '',
      department: ''
    });
    setMaskOverrides({});
  };

  const handleChooseItem = (item) => {
    if (onSelectItem) {
      onSelectItem(item);
    }
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    if (!allowCreation || !generatedName) return;
    const defaultDept = config.defaultDepartment || (state.departments?.[0]?.name || state.departments?.[0]?.label || 'Finished Goods');
    const newItem = createFinishedGoodFromCombo(
      combo,
      state.items || [],
      masking,
      config.packings,
      defaultDept,
      state.categoryPrefixes,
      Object.keys(maskOverrides).length > 0 ? maskOverrides : null
    );
    if (onSelectItem) {
      onSelectItem(newItem);
    }
    setIsOpen(false);
  };

  // Draggable handle
  const handlePanelPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('select') || e.target.closest('button')) return;

    setIsDragging(true);
    setHasBeenDragged(true);
    dragOffsetRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialTop: panelCoords.top,
      initialLeft: panelCoords.left
    };

    const handlePointerMove = (moveEvt) => {
      const deltaX = moveEvt.clientX - dragOffsetRef.current.mouseX;
      const deltaY = moveEvt.clientY - dragOffsetRef.current.mouseY;

      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const width = panelCoords.width;

      let newLeft = Math.max(10, Math.min(screenWidth - width - 10, dragOffsetRef.current.initialLeft + deltaX));
      let newTop = Math.max(10, Math.min(screenHeight - 80, dragOffsetRef.current.initialTop + deltaY));

      setPanelCoords(prev => ({
        ...prev,
        left: Math.round(newLeft),
        top: Math.round(newTop)
      }));
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Auto-adjust positioning according to table position and screen boundaries
  const updateCoordinates = () => {
    if (!triggerRef.current || hasBeenDragged) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Desired width for single horizontal row
    const targetWidth = Math.min(1240, screenWidth - 32);

    // Default left aligns with trigger
    let left = rect.left;

    // If panel would overflow the right edge of the screen, shift it left
    if (left + targetWidth > screenWidth - 16) {
      left = screenWidth - 16 - targetWidth;
    }

    // Guarantee it NEVER goes off-screen to the left
    if (left < 16) {
      left = 16;
    }

    // Vertical positioning: below trigger if space available, otherwise above
    const estimatedHeight = 110;
    const spaceBelow = screenHeight - rect.bottom;
    let top = rect.bottom + 6;

    if (spaceBelow < estimatedHeight + 10 && rect.top > estimatedHeight + 10) {
      top = rect.top - estimatedHeight - 6;
    }

    setPanelCoords({
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(targetWidth)
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!hasBeenDragged) {
      updateCoordinates();
    }

    const handleScrollOrResize = () => {
      if (!hasBeenDragged) {
        updateCoordinates();
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    const handleClickOutside = (e) => {
      if (matchDropdownRef.current && !matchDropdownRef.current.contains(e.target)) {
        setIsMatchDropdownOpen(false);
      }
      if (
        isQuickConfigOpen ||
        (triggerRef.current && triggerRef.current.contains(e.target)) ||
        (panelRef.current && panelRef.current.contains(e.target)) ||
        e.target.closest('[role="dialog"]') ||
        e.target.closest('[data-builder-modal]')
      ) {
        return;
      }
      setIsOpen(false);
      setIsMatchDropdownOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isQuickConfigOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, hasBeenDragged, isQuickConfigOpen]);

  return (
    <div className="relative inline-flex items-center shrink-0" ref={triggerRef}>
      {/* 1. Toggle Button (Icon Only - Clean & Uncluttered) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Close FG Builder" : "Open FG Combination Builder"}
        aria-label="Finished Goods Combination Builder"
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all border shrink-0 shadow-sm cursor-pointer ${
          isOpen
            ? 'bg-primary text-white border-primary shadow-md ring-2 ring-primary/30'
            : activeAttributeCount > 0
            ? 'bg-primary/10 border-primary/50 text-primary hover:bg-primary/20'
            : 'bg-surface hover:bg-surface-container-low border-outline-variant/30 text-on-surface'
        } ${buttonClassName}`}
      >
        <span className="material-symbols-outlined text-[19px]">
          {isOpen ? 'expand_less' : activeAttributeCount > 0 ? 'view_in_ar' : 'tune'}
        </span>
        {activeAttributeCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-black flex items-center justify-center shadow-xs">
            {activeAttributeCount}
          </span>
        )}
      </button>

      {/* 2. Draggable Single Horizontal Row Combination Builder Panel (Portal) */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: `${panelCoords.top}px`,
            left: `${panelCoords.left}px`,
            width: `${panelCoords.width}px`,
            zIndex: 9999
          }}
          className="fg-builder-panel rounded-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150 text-on-surface"
        >
          {/* ROW 1: Single Horizontal Row of 7 Dropdowns + Action Controls */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-outline-variant/15 scrollbar-thin">
            
            {/* Header Drag Handle */}
            <div 
              onPointerDown={handlePanelPointerDown}
              className={`flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-on-surface-variant shrink-0 px-2 py-1 rounded-lg bg-surface-container-low/70 select-none border border-outline-variant/20 ${
                isDragging ? 'cursor-grabbing ring-1 ring-primary' : 'cursor-grab'
              }`}
              title="Click and drag to move builder anywhere on screen"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">drag_indicator</span>
              <span className="hidden sm:inline">FG Combo:</span>
            </div>

            {/* 1. Paper / Texture */}
            <div className="shrink-0 w-[130px]">
              <select
                value={combo.paperCode}
                onChange={(e) => handleSelectField('paperCode', e.target.value)}
                className={`w-full bg-surface-container-lowest border rounded-lg px-2 py-1.5 text-xs font-bold transition-all focus:ring-2 focus:ring-primary/25 outline-none ${
                  combo.paperCode ? 'border-primary text-primary bg-primary/5' : 'border-outline-variant/30 text-on-surface'
                }`}
                title={masking.maskPaperCode ? "Paper Code (Masked in title)" : "Texture / Release Paper Code"}
              >
                <option value="">Paper {masking.maskPaperCode ? '🔒' : ''} ▾</option>
                {(config.paperCodes || []).map(p => (
                  <option key={p.id} value={p.code}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Base Item / Gauge */}
            <div className="shrink-0 w-[145px]">
              <select
                value={combo.baseItem}
                onChange={(e) => handleSelectField('baseItem', e.target.value)}
                className={`w-full bg-surface-container-lowest border rounded-lg px-2 py-1.5 text-xs font-bold transition-all focus:ring-2 focus:ring-primary/25 outline-none ${
                  combo.baseItem ? 'border-primary text-primary bg-primary/5' : 'border-outline-variant/30 text-on-surface'
                }`}
                title={masking.maskItemName ? "Item / Gauge (Masked in title)" : "Base Synthetic Leather Item & Thickness"}
              >
                <option value="">Gauge / Item {masking.maskItemName ? '🔒' : ''} ▾</option>
                {(config.gauges || []).map(g => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Color */}
            <div className="shrink-0 w-[125px]">
              <select
                value={combo.color}
                onChange={(e) => handleSelectField('color', e.target.value)}
                className={`w-full bg-surface-container-lowest border rounded-lg px-2 py-1.5 text-xs font-bold transition-all focus:ring-2 focus:ring-primary/25 outline-none ${
                  combo.color ? 'border-primary text-primary bg-primary/5' : 'border-outline-variant/30 text-on-surface'
                }`}
                title={masking.maskColor ? "Color (Masked in title)" : "Top Layer Color"}
              >
                <option value="">Color {masking.maskColor ? '🔒' : ''} ▾</option>
                {(config.colors || []).map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Layers */}
            <div className="shrink-0 w-[105px]">
              <select
                value={combo.layers}
                onChange={(e) => handleSelectField('layers', e.target.value)}
                className={`w-full bg-surface-container-lowest border rounded-lg px-2 py-1.5 text-xs font-bold transition-all focus:ring-2 focus:ring-primary/25 outline-none ${
                  combo.layers ? 'border-primary text-primary bg-primary/5' : 'border-outline-variant/30 text-on-surface'
                }`}
                title={masking.maskLayers ? "Layers (Masked in title)" : "Specification Layers"}
              >
                <option value="">Layers {masking.maskLayers ? '🔒' : ''} ▾</option>
                {(config.layers || []).map(l => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Backing Fabric — real cloth items from inventory
                (RM + rawMaterialType 'Cloth', the Cloth Quality Setup list) */}
            <div className="shrink-0 w-[150px]">
              <select
                value={combo.clothItemId}
                onChange={(e) => handleSelectCloth(e.target.value)}
                className={`w-full bg-surface-container-lowest border rounded-lg px-2 py-1.5 text-xs font-bold transition-all focus:ring-2 focus:ring-primary/25 outline-none ${
                  combo.clothItemId ? 'border-primary text-primary bg-primary/5' : 'border-outline-variant/30 text-on-surface'
                }`}
                title={masking.maskFabric ? "Backing Fabric (Masked in title)" : "Backing cloth item (Inventory → Cloth Quality Setup)"}
              >
                <option value="">Fabric {masking.maskFabric ? '🔒' : ''} ▾</option>
                {fabricOptions.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 6. Fabric Color — carried by the picked cloth item's name */}
            <div className="shrink-0 w-[125px]">
              <select
                value={combo.fabricColor}
                onChange={(e) => handleSelectField('fabricColor', e.target.value)}
                disabled={!selectedClothItem || availableFabricColors.length === 0}
                className={`w-full bg-surface-container-lowest border rounded-lg px-2 py-1.5 text-xs font-bold transition-all focus:ring-2 focus:ring-primary/25 outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                  combo.fabricColor ? 'border-primary text-primary bg-primary/5' : 'border-outline-variant/30 text-on-surface'
                }`}
                title={masking.maskFabricColor ? "Fabric Color (Masked in title)" : "Backing Fabric Color (from the cloth item)"}
              >
                <option value="">Fabric Col {masking.maskFabricColor ? '🔒' : ''} ▾</option>
                {availableFabricColors.map((col, idx) => (
                  <option key={idx} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {/* 7. Packing */}
            <div className="shrink-0 w-[120px]">
              <select
                value={combo.packing}
                onChange={(e) => handleSelectField('packing', e.target.value)}
                className={`w-full bg-surface-container-lowest border rounded-lg px-2 py-1.5 text-xs font-bold transition-all focus:ring-2 focus:ring-primary/25 outline-none ${
                  combo.packing ? 'border-primary text-primary bg-primary/5' : 'border-outline-variant/30 text-on-surface'
                }`}
                title={masking.maskPacking ? "Packing attribute (Masked from title, preserved in DB)" : "Packing Specification"}
              >
                <option value="">Packing {masking.maskPacking ? '🔒' : ''} ▾</option>
                {(config.packings || []).map(pk => (
                  <option key={pk.id} value={pk.name}>
                    {pk.name} ({pk.size}{pk.uom})
                  </option>
                ))}
              </select>
            </div>



            {/* Action Controls: Reset, Settings Gear, and Close */}
            <div className="flex items-center gap-1 shrink-0 ml-auto pl-1">
              {activeAttributeCount > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-red-500 transition-colors cursor-pointer"
                  title="Reset All Selections"
                >
                  <span className="material-symbols-outlined text-[17px]">restart_alt</span>
                </button>
              )}

              {allowQuickConfig && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsQuickConfigOpen(true);
                  }}
                  className="p-1.5 rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                  title="FG Combination Configuration (Attributes, Lookups, Masking)"
                >
                  <span className="material-symbols-outlined text-[17px]">settings</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Close Builder"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            </div>

          </div>

          {/* ROW 2: Dynamic Identity Preview & Matching Items / Registration Bar */}
          <div className="flex items-center justify-between gap-3 pt-2 text-xs">
            
            {/* Generated Name Preview Badge */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {generatedName ? (
                <div className="flex items-center gap-1.5 bg-surface-container-high/70 text-on-surface px-2.5 py-1 rounded-lg border border-outline-variant/30 font-bold text-xs truncate max-w-xl shadow-xs">
                  <span className="material-symbols-outlined text-[15px] text-primary shrink-0">verified</span>
                  <span className="truncate">{generatedName}</span>
                </div>
              ) : (
                <span className="text-[11px] text-on-surface-variant italic">
                  Select attributes in the row above to build Finished Good combination
                </span>
              )}

              {/* Department Target Badge (Set in Builder Settings) */}
              <span 
                className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 shrink-0 flex items-center gap-1"
                title="Default Department configured in Builder settings where this item will be registered"
              >
                <span className="material-symbols-outlined text-[13px]">business</span>
                <span>Dept: {config.defaultDepartment || 'Finished Goods'}</span>
              </span>

              {combo.packing && masking.maskPacking && (
                <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
                  Packing: {combo.packing} (in DB)
                </span>
              )}
            </div>

            {/* Actions / Results */}
            <div className="flex items-center gap-2 shrink-0">
              
              {/* Matching items toggle pill */}
              {matchingItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsMatchDropdownOpen(prev => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-extrabold transition-all shadow-xs active:scale-95 cursor-pointer"
                  title="Toggle live matching items panel below"
                >
                  <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                  <span>{matchingItems.length} {matchingItems.length === 1 ? 'Match' : 'Matches'} Found</span>
                  <span 
                    className="material-symbols-outlined text-[15px] transition-transform duration-200"
                    style={{ transform: isMatchDropdownOpen ? 'rotate(180deg)' : 'none' }}
                  >
                    expand_more
                  </span>
                </button>
              )}

              {/* No match indicator */}
              {activeAttributeCount > 0 && matchingItems.length === 0 && (
                <span className="text-[11px] font-semibold text-amber-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  {allowCreation ? 'Not registered in warehouse' : 'No matching items'}
                </span>
              )}

              {/* Register as New Finished Good: Allowed ONLY in Sales Order screen */}
              {allowCreation && activeAttributeCount >= 2 && !exactMatchExists && generatedName && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                  title="Register this new Finished Good and add to Sales Order"
                >
                  <span className="material-symbols-outlined text-[15px]">add_circle</span>
                  <span>+ Register As New FG</span>
                </button>
              )}

            </div>

          </div>

          {/* ROW 2b: per-item title masking overrides + live stock hints */}
          {(allowCreation || clothHint || paperHint) && (
            <div className="flex items-center gap-2 pt-2 flex-wrap">
              {allowCreation && (
                <div className="flex items-center gap-1 flex-wrap" title="Title masking for THIS item only — overrides the global masking set in the gear configuration">
                  <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1 mr-0.5">
                    <span className="material-symbols-outlined text-[13px]">visibility</span> Title:
                  </span>
                  {FG_MASK_FIELDS.map(f => {
                    const masked = !!masking[f.maskKey];
                    const overridden = Object.prototype.hasOwnProperty.call(maskOverrides, f.maskKey);
                    return (
                      <button
                        key={f.maskKey}
                        type="button"
                        onClick={() => toggleMaskOverride(f.maskKey)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                          masked
                            ? 'bg-surface-container text-on-surface-variant/60 border-outline-variant/20 line-through decoration-on-surface-variant/40'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        } ${overridden ? 'ring-1 ring-primary/60' : ''}`}
                        title={masked ? `${f.label} is masked out of this item's title — click to include it` : `${f.label} is included in this item's title — click to mask it`}
                      >
                        {f.label}{overridden ? ' •' : ''}
                      </button>
                    );
                  })}
                </div>
              )}

              {(clothHint || paperHint) && <span className="flex-1" />}

              {paperHint && (
                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/25 shrink-0" title={`Paper stock on hand (${paperHint.paper.name})`}>
                  <span className="material-symbols-outlined text-[12px] align-middle mr-0.5">layers</span>
                  Paper stock: {paperHint.stock.toLocaleString()} {paperHint.uom}
                </span>
              )}

              {clothHint && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                  clothHint.stock.meters !== null && clothHint.stock.meters <= 0
                    ? 'text-red-500 bg-red-500/10 border-red-500/30'
                    : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                }`} title={`Backing cloth stock on hand (${clothHint.cloth.name})`}>
                  <span className="material-symbols-outlined text-[12px] align-middle mr-0.5">dry_cleaning</span>
                  Cloth: {clothHint.cloth.name} — {clothHint.stock.meters !== null
                    ? `${clothHint.stock.meters.toLocaleString()} m in stock`
                    : `${clothHint.stock.kg.toLocaleString()} kg (quality not set)`}
                </span>
              )}
            </div>
          )}

          {/* ROW 3: INSTANT LIVE MATCHING FINISHED GOODS (Auto-opens right below builder on any selection) */}
          {activeAttributeCount > 0 && matchingItems.length > 0 && isMatchDropdownOpen && (
            <div className="mt-2.5 pt-2.5 border-t border-outline-variant/15 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">
                    Live Matching Finished Goods in Warehouse ({matchingItems.length})
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-medium hidden sm:inline">
                    — Click any item to instantly select into order
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMatchDropdownOpen(false)}
                  className="text-[10px] font-bold text-on-surface-variant hover:text-on-surface px-2 py-0.5 rounded hover:bg-surface-container-high transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Hide</span>
                  <span className="material-symbols-outlined text-[13px]">expand_less</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {matchingItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleChooseItem(item)}
                    className="text-left p-2.5 rounded-xl bg-surface-container-low/90 hover:bg-primary/10 border border-outline-variant/20 hover:border-primary/50 text-on-surface hover:text-primary transition-all flex items-start gap-2.5 group cursor-pointer shadow-xs active:scale-[0.98]"
                    title={`Select ${item.name}`}
                  >
                    <span className="font-mono text-[10px] font-black bg-primary/15 text-primary px-1.5 py-0.5 rounded-md shrink-0 mt-0.5">
                      {item.sku || 'ITM'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold truncate text-on-surface group-hover:text-primary">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant mt-0.5 flex-wrap">
                        {item.department && <span>Dept: {item.department}</span>}
                        {item.rollSize && <span>• {item.rollSize}m Roll</span>}
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          • Stock: {item.stock ?? 0}m
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                      add_circle
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ROW 3 (No match found): Prominent Registration Banner */}
          {activeAttributeCount >= 2 && matchingItems.length === 0 && allowCreation && generatedName && (
            <div className="mt-2.5 pt-2.5 border-t border-outline-variant/15 flex items-center justify-between gap-3 animate-in fade-in duration-200 bg-primary/5 p-3 rounded-xl border border-primary/20">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[22px] text-amber-500 shrink-0">info</span>
                <div>
                  <p className="text-xs font-extrabold text-on-surface">No matching finished good registered in warehouse.</p>
                  <p className="text-[11px] text-on-surface-variant">
                    You can register <strong className="text-primary">{generatedName}</strong> into the default department (<span className="font-bold">{config.defaultDepartment || 'Finished Goods'}</span>) right now.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCreateNew}
                className="bg-primary hover:bg-primary/90 text-white text-xs font-extrabold px-4 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                title="Register this new Finished Good and add to Sales Order"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>+ Register As New FG</span>
              </button>
            </div>
          )}

        </div>,
        document.body
      )}

      {/* 3. Non-blocking Quick Configuration Modal */}
      {allowQuickConfig && (
        <FGQuickConfigModal
          isOpen={isQuickConfigOpen}
          onClose={() => setIsQuickConfigOpen(false)}
        />
      )}
    </div>
  );
}
