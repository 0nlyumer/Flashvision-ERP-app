/**
 * FG Combination Builder & Identity Recognition Utilities
 * Synthetic Leather ERP Architecture
 */

import { nextItemCode } from './itemCodes';

export const DEFAULT_FG_CONFIG = {
  paperCodes: [
    { id: 'p1', code: 'P-101', name: 'Nappa Smooth Grain', description: 'Fine classic leather texture' },
    { id: 'p2', code: 'P-102', name: 'Lamb Skin Grain', description: 'Soft lamb texture' },
    { id: 'p3', code: 'P-103', name: 'Crazy Horse Pull-up', description: 'Vintage pull-up effect' },
    { id: 'p4', code: 'P-104', name: 'Milled Pebbled Grain', description: 'Deep pebbled grain' },
    { id: 'p5', code: 'P-105', name: 'Saffiano Cross-hatch', description: 'Diagonal embossed pattern' },
    { id: 'p6', code: 'P-106', name: 'Carbon Fiber Weave', description: 'Geometric automotive weave' },
    { id: 'p7', code: 'P-107', name: 'Crocodile Emboss', description: 'Exotic reptile pattern' },
    { id: 'p8', code: 'P-108', name: 'Perforated Matrix', description: 'Breathable sports perforations' }
  ],
  gauges: [
    { id: 'g1', name: '0.60mm Rexine', gauge: '0.60mm' },
    { id: 'g2', name: '0.70mm Rexine', gauge: '0.70mm' },
    { id: 'g3', name: '0.80mm PU Leather', gauge: '0.80mm' },
    { id: 'g4', name: '0.90mm PU Leather', gauge: '0.90mm' },
    { id: 'g5', name: '1.00mm Industrial Synthetic', gauge: '1.00mm' },
    { id: 'g6', name: '1.20mm Heavy Duty Coated', gauge: '1.20mm' },
    { id: 'g7', name: '1.40mm Shoe Upper Grade', gauge: '1.40mm' }
  ],
  colors: [
    { id: 'c1', name: 'Jet Black', hex: '#111111' },
    { id: 'c2', name: 'Dark Brown', hex: '#4A2C11' },
    { id: 'c3', name: 'Tan Caramel', hex: '#C18742' },
    { id: 'c4', name: 'Pure White', hex: '#FFFFFF' },
    { id: 'c5', name: 'Navy Blue', hex: '#1B263B' },
    { id: 'c6', name: 'Burgundy Red', hex: '#6B1123' },
    { id: 'c7', name: 'Olive Green', hex: '#556B2F' },
    { id: 'c8', name: 'Camel Beige', hex: '#C29B38' },
    { id: 'c9', name: 'Smoke Grey', hex: '#708090' }
  ],
  layers: [
    { id: 'l1', name: '1L' },
    { id: 'l2', name: '2L' },
    { id: 'l3', name: '3L' },
    { id: 'l4', name: '4L' }
  ],
  fabrics: [
    { id: 'f1', name: 'Knitted Cotton', colors: ['White', 'Black', 'Grey', 'Raw Ecru'] },
    { id: 'f2', name: 'T/C Mesh', colors: ['White', 'Black', 'Blue'] },
    { id: 'f3', name: 'Microfiber Suede', colors: ['Grey', 'Beige', 'Black'] },
    { id: 'f4', name: 'Woven Twill', colors: ['White', 'Natural Ecru'] },
    { id: 'f5', name: 'Non-Woven Spunlace', colors: ['White', 'Black'] }
  ],
  defaultDepartment: 'Finished Goods',
  departments: [
    { id: 'dept_fg', name: 'Finished Goods', isDefault: true },
    { id: 'dept_prod', name: 'Production Department', isDefault: false },
    { id: 'dept_wh', name: 'Warehouse', isDefault: false },
    { id: 'dept_insp', name: 'Inspection & Grading', isDefault: false }
  ],
  packings: [
    { id: 'pk1', name: '50M Standard Roll', uom: 'Meters', size: 50 },
    { id: 'pk2', name: '100M Jumbo Roll', uom: 'Meters', size: 100 },
    { id: 'pk3', name: 'Polybag Wrapped', uom: 'Rolls', size: 1 },
    { id: 'pk4', name: 'Double Fold Carton', uom: 'Carton', size: 25 },
    { id: 'pk5', name: 'Export Wooden Crate', uom: 'Crate', size: 200 }
  ],
  masking: {
    maskPacking: true,      // Packing is masked from display name by default
    maskPaperCode: false,
    maskItemName: false,
    maskColor: false,
    maskLayers: false,
    maskFabric: false
  }
};

/**
 * Generates the standardized FG Item Display Name based on combination attributes and masking rules.
 * Standard generated item display name pattern:
 * {Paper Code} {Item Name} {Color} {Layers} ({Fabric Name} {Fabric Color})
 */
/**
 * Formats layer representation to concise "3L" format (never full word "Layer").
 */
export function formatLayerShort(layerStr = '') {
  if (!layerStr) return '';
  const trimmed = String(layerStr).trim();
  const match = trimmed.match(/^(\d+)\s*(?:layer|layers|l)?$/i);
  if (match) {
    return `${match[1]}L`;
  }
  return trimmed.replace(/\s*layers?/gi, 'L').trim();
}

export function generateFGDisplayName(combo = {}, maskingConfig = {}) {
  const parts = [];

  // 1. Paper / Texture Code
  if (combo.paperCode && !maskingConfig.maskPaperCode) {
    parts.push(combo.paperCode);
  }

  // 2. Base Item Name / Gauge
  if (combo.baseItem && !maskingConfig.maskItemName) {
    parts.push(combo.baseItem);
  }

  // 3. Top Layer Color
  if (combo.color && !maskingConfig.maskColor) {
    parts.push(combo.color);
  }

  // 4. Layers: Always short "3L" format (never full word "Layer")
  if (combo.layers && !maskingConfig.maskLayers) {
    parts.push(formatLayerShort(combo.layers));
  }

  // 5. Backing Fabric & Color: in parentheses: ([Fabric Name] [Fabric Color])
  if (!maskingConfig.maskFabric && (combo.fabricName || combo.fabricColor)) {
    const fabricTokens = [combo.fabricName, combo.fabricColor].filter(Boolean);
    if (fabricTokens.length > 0) {
      parts.push(`(${fabricTokens.join(' ')})`);
    }
  }

  // 6. Packing: If explicitly unmasked
  if (combo.packing && !maskingConfig.maskPacking) {
    parts.push(`[${combo.packing}]`);
  }

  return parts.join(' ').trim();
}

/**
 * Returns a human-friendly representation of the full combination attributes (even masked ones)
 * for tooltips and builder cards.
 */
export function getCombinationBadgeList(combo = {}) {
  const badges = [];
  if (combo.paperCode) badges.push({ label: 'Texture', value: combo.paperCode, icon: 'texture' });
  if (combo.baseItem) badges.push({ label: 'Gauge', value: combo.baseItem, icon: 'straighten' });
  if (combo.color) badges.push({ label: 'Color', value: combo.color, icon: 'palette' });
  if (combo.layers) badges.push({ label: 'Layers', value: combo.layers, icon: 'layers' });
  if (combo.fabricName) badges.push({ label: 'Fabric', value: `${combo.fabricName}${combo.fabricColor ? ' (' + combo.fabricColor + ')' : ''}`, icon: 'dry_cleaning' });
  if (combo.packing) badges.push({ label: 'Packing', value: combo.packing, icon: 'inventory_2', isMasked: true });
  return badges;
}

/**
 * Checks whether an item matches active combination filter criteria.
 * Supports both modern combinationDetails and backwards-compatible regex / substring matching on existing item names.
 */
export function matchItemToCombination(item, filter = {}) {
  if (!item) return false;

  // If item has structured combinationDetails, match against fields
  const details = item.combinationDetails || {};

  // Normalize text for fallback substring search
  const itemNameLower = (item.name || '').toLowerCase();
  const itemSkuLower = (item.sku || '').toLowerCase();

  // 1. Paper Code
  if (filter.paperCode) {
    const pCode = filter.paperCode.toLowerCase();
    const detailsCode = (details.paperCode || '').toLowerCase();
    if (detailsCode ? detailsCode !== pCode : !itemNameLower.includes(pCode)) {
      return false;
    }
  }

  // 2. Base Item / Gauge
  if (filter.baseItem) {
    const bItem = filter.baseItem.toLowerCase();
    const detailsBase = (details.baseItem || '').toLowerCase();
    if (detailsBase ? detailsBase !== bItem : !itemNameLower.includes(bItem)) {
      return false;
    }
  }

  // 3. Top Color
  if (filter.color) {
    const col = filter.color.toLowerCase();
    const detailsColor = (details.color || '').toLowerCase();
    if (detailsColor ? detailsColor !== col : !itemNameLower.includes(col)) {
      return false;
    }
  }

  // 4. Layers (supports both '3L' and legacy '3 Layer')
  if (filter.layers) {
    const layShort = formatLayerShort(filter.layers).toLowerCase();
    const layRaw = filter.layers.toLowerCase();
    const detailsLayers = (details.layers || '').toLowerCase();
    const detailsLayersShort = formatLayerShort(detailsLayers).toLowerCase();
    const matchDetails = detailsLayers ? (detailsLayers === layRaw || detailsLayersShort === layShort) : false;
    const matchText = itemNameLower.includes(layShort) || itemNameLower.includes(layRaw);
    if (detailsLayers ? !matchDetails : !matchText) {
      return false;
    }
  }

  // 5. Fabric Name
  if (filter.fabricName) {
    const fab = filter.fabricName.toLowerCase();
    const detailsFabric = (details.fabricName || '').toLowerCase();
    if (detailsFabric ? detailsFabric !== fab : !itemNameLower.includes(fab)) {
      return false;
    }
  }

  // 6. Fabric Color
  if (filter.fabricColor) {
    const fc = filter.fabricColor.toLowerCase();
    const detailsFc = (details.fabricColor || '').toLowerCase();
    if (detailsFc ? detailsFc !== fc : !itemNameLower.includes(fc)) {
      return false;
    }
  }

  // 7. Packing
  if (filter.packing) {
    const pck = filter.packing.toLowerCase();
    const detailsPck = (details.packing || '').toLowerCase();
    if (detailsPck && detailsPck !== pck) {
      return false;
    }
  }

  return true;
}

/**
 * Creates a new Finished Good item object from combination attributes.
 */
/**
 * Parses numeric roll size (in meters) from a packing specification string or object.
 */
export function parseRollSizeFromPacking(packing, packingsList = []) {
  if (!packing) return 50;
  if (typeof packing === 'number' && packing > 0) return packing;
  
  if (Array.isArray(packingsList)) {
    const found = packingsList.find(p => p.name === packing || p.id === packing);
    if (found && Number(found.size) > 0) {
      return Number(found.size);
    }
  }

  const str = String(packing);
  const match = str.match(/(\d+(?:\.\d+)?)\s*(?:m|mtr|meter|meters|\b)/i);
  if (match && match[1]) {
    const parsed = parseFloat(match[1]);
    if (parsed > 0) return parsed;
  }

  return 50;
}

export function createFinishedGoodFromCombo(combo = {}, stateItems = [], maskingConfig = {}, packingsConfig = [], defaultDept = '', categoryPrefixes = null) {
  const displayName = generateFGDisplayName(combo, maskingConfig);

  // Master code: SAME settled generator as every other create path
  // (Phase C Step 3) — Finished Goods continue the FG-001 series; popup
  // items never get a separate code scheme.
  const sku = nextItemCode(stateItems, 'Finished Goods', categoryPrefixes);

  const rollSize = parseRollSizeFromPacking(combo.packing, packingsConfig || DEFAULT_FG_CONFIG.packings);
  const assignedDept = combo.department || defaultDept || DEFAULT_FG_CONFIG.defaultDepartment || 'Finished Goods';
  const timestamp = Date.now();

  return {
    id: 'I' + timestamp,
    sku: sku,
    name: displayName,
    category: 'Finished Goods',
    type: 'Finished Goods',
    department: assignedDept,
    stockByDepartment: {
      [assignedDept]: 0
    },
    uom: 'Meters',
    unit: 'Meters',
    secondaryUom: 'Rolls',
    price: 0,
    stock: 0,
    rolls: 0,
    rollSize: rollSize,
    packingSize: rollSize,
    uomNumber: rollSize,
    packingName: combo.packing || '',
    specifications: `Synthetic Leather ${combo.baseItem || ''} - ${formatLayerShort(combo.layers) || ''} on ${combo.fabricName || 'Standard Backing'}`,
    status: 'Active',
    isNewFromOrder: true,
    combinationDetails: {
      paperCode: combo.paperCode || '',
      baseItem: combo.baseItem || '',
      color: combo.color || '',
      layers: formatLayerShort(combo.layers) || '',
      fabricName: combo.fabricName || '',
      fabricColor: combo.fabricColor || '',
      packing: combo.packing || '',
      department: assignedDept,
      createdAt: new Date().toISOString()
    }
  };
}


/**
 * Loads persisted FG Configuration from localStorage, or falls back to DEFAULT_FG_CONFIG.
 */
export function getInitialFGConfig() {
  try {
    const saved = localStorage.getItem('fg_combinations_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_FG_CONFIG,
          ...parsed,
          defaultDepartment: parsed.defaultDepartment || DEFAULT_FG_CONFIG.defaultDepartment,
          departments: (parsed.departments && parsed.departments.length > 0) ? parsed.departments : DEFAULT_FG_CONFIG.departments,
          masking: { ...DEFAULT_FG_CONFIG.masking, ...(parsed.masking || {}) }
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse fg_combinations_config from localStorage:', e);
  }
  return DEFAULT_FG_CONFIG;
}

/**
 * Persists updated FG Configuration to localStorage and dispatches a live broadcast event.
 */
export function saveFGConfig(newConfig) {
  try {
    localStorage.setItem('fg_combinations_config', JSON.stringify(newConfig));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fg-config-updated', { detail: newConfig }));
    }
  } catch (e) {
    console.warn('Failed to save fg_combinations_config to localStorage:', e);
  }
  return newConfig;
}
