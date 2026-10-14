/**
 * Automated Real-Time Text Contrast & Visibility Detection Engine
 * ---------------------------------------------------------------
 * Continuously detects text elements where the foreground color clashes or blends into
 * the background color (WCAG contrast ratio < 3.2:1). Automatically adapts the text color
 * to ensure 100% crystal-clear readability across all dark/light modes, cards, tables,
 * inputs, badges, and dynamic themes.
 */

// Universal color parser for hex, rgb, rgba, and named colors
function parseRgbColor(str) {
  if (!str || str === 'transparent' || str === 'inherit' || str === 'initial') return null;

  // Named basic colors
  const named = {
    white: { r: 255, g: 255, b: 255, a: 1 },
    black: { r: 0, g: 0, b: 0, a: 1 }
  };
  if (named[str.toLowerCase()]) return { ...named[str.toLowerCase()] };

  // Hex format (#fff, #ffffff, #ffffff80)
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  // rgb/rgba format: rgb(r, g, b) or rgba(r, g, b, a)
  const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: match[4] !== undefined ? parseFloat(match[4]) : 1
    };
  }

  return null;
}

// Relative luminance according to WCAG 2.1 specs
function getLuminance(r, g, b) {
  const [sR, sG, sB] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sR + 0.7152 * sG + 0.0722 * sB;
}

// Calculate contrast ratio between two relative luminance values
function calculateRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Alpha blend foreground over background
function blendOver(fg, bg) {
  const alpha = fg.a;
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
    a: 1
  };
}

// Traverse parent elements to find effective composite background color
function getEffectiveBackgroundColor(el) {
  let curr = el;
  const isDark = document.documentElement.classList.contains('dark');
  const baseCanvas = isDark ? { r: 11, g: 14, b: 20, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
  const layers = [];

  while (curr && curr !== document.documentElement && curr !== document) {
    const style = window.getComputedStyle(curr);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return null;
    }
    const bg = parseRgbColor(style.backgroundColor);
    if (bg && bg.a > 0.05) {
      layers.unshift(bg);
      if (bg.a >= 0.98) break; // Fully opaque layer reached
    }
    curr = curr.parentElement;
  }

  let finalBg = baseCanvas;
  for (const layer of layers) {
    finalBg = blendOver(layer, finalBg);
  }
  return finalBg;
}

// Categorize color hue of text to preserve intentional branding tints
function getTextColorType(rgb) {
  if (!rgb) return 'neutral';
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta < 20) return 'neutral'; // Grayscale / white / black / slate

  if (r > g && r > b) {
    return (g > b && (g - b) > 30) ? 'amber' : 'red';
  }
  if (g > r && g > b) return 'green';
  if (b > r && b > g) return 'blue';
  if (r > 120 && b > 120 && g < 100) return 'purple';
  return 'neutral';
}

// High-contrast color palettes for automatic correction
const PALETTES = {
  onDark: {
    neutral: '#f8fafc', // Crisp ultra-white
    green: '#86efac',   // Luminous pastel emerald
    amber: '#fde047',   // Luminous bright yellow-amber
    red: '#fca5a5',     // Luminous soft rose-red
    blue: '#93c5fd',    // Luminous sky-blue
    purple: '#d8b4fe'   // Luminous lavender
  },
  onLight: {
    neutral: '#0f172a', // Deep dark slate
    green: '#14532d',   // Deep readable forest green
    amber: '#854d0e',   // Deep readable amber-brown
    red: '#991b1b',     // Deep readable crimson red
    blue: '#1e3a8a',    // Deep readable navy blue
    purple: '#581c87'   // Deep readable dark purple
  }
};

// Check if an element should be inspected
function shouldInspectElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.hasAttribute('data-contrast-ignore')) return false;

  const tag = el.tagName.toLowerCase();
  if (['script', 'style', 'svg', 'path', 'canvas', 'noscript', 'iframe'].includes(tag)) return false;

  // Interactive controls or inputs always need inspection
  if (['input', 'select', 'textarea', 'button', 'option'].includes(tag)) return true;

  // Any element that contains direct text
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim().length > 0) {
      return true;
    }
  }

  // Common typography and badge classes
  if (el.classList && (
    el.classList.contains('badge') ||
    el.classList.contains('status-pill') ||
    el.matches('h1, h2, h3, h4, h5, h6, p, span, a, label, th, td')
  )) {
    return true;
  }

  return false;
}

// Core inspect & correct routine for an individual element
export function inspectAndFixElement(el) {
  if (!shouldInspectElement(el)) return;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

  const effectiveBg = getEffectiveBackgroundColor(el);
  if (!effectiveBg) return;

  const bgLum = getLuminance(effectiveBg.r, effectiveBg.g, effectiveBg.b);
  const textColor = parseRgbColor(style.color);
  if (!textColor) return;

  const textLum = getLuminance(textColor.r, textColor.g, textColor.b);
  const contrastRatio = calculateRatio(textLum, bgLum);

  // If contrast is uncomfortably low (< 3.2:1)
  if (contrastRatio < 3.2) {
    const isDarkBg = bgLum < 0.42;
    const colorType = getTextColorType(textColor);
    const targetColor = isDarkBg ? PALETTES.onDark[colorType] : PALETTES.onLight[colorType];

    el.style.setProperty('color', targetColor, 'important');
    el.setAttribute('data-contrast-fixed', isDarkBg ? 'dark-bg' : 'light-bg');

    // Subtle text shadow for dark backgrounds to maximize crispness
    if (isDarkBg) {
      el.style.setProperty('text-shadow', '0 1px 2px rgba(0, 0, 0, 0.75)', 'important');
    } else {
      el.style.removeProperty('text-shadow');
    }
  }

  // Special handling for native selects and options
  if (el.tagName.toLowerCase() === 'select') {
    const isDark = document.documentElement.classList.contains('dark');
    el.style.setProperty('color-scheme', isDark ? 'dark' : 'light');
    Array.from(el.options || []).forEach(opt => {
      opt.style.backgroundColor = isDark ? '#141924' : '#ffffff';
      opt.style.color = isDark ? '#f0f3fa' : '#0f172a';
    });
  }
}

// Scan container and all its descendants
let isScanning = false;
let queuedContainer = null;

export function scanAndFixContrast(container = document.body) {
  if (!container) return;

  // Use requestAnimationFrame to ensure layout is ready and avoid frame drops
  if (isScanning) {
    queuedContainer = container;
    return;
  }

  isScanning = true;
  window.requestAnimationFrame(() => {
    try {
      const candidates = container.querySelectorAll('*');
      const len = candidates.length;
      for (let i = 0; i < len; i++) {
        inspectAndFixElement(candidates[i]);
      }
      if (shouldInspectElement(container)) {
        inspectAndFixElement(container);
      }
    } catch (err) {
      console.warn('[AutoContrast] Error during contrast scan:', err);
    } finally {
      isScanning = false;
      if (queuedContainer) {
        const next = queuedContainer;
        queuedContainer = null;
        scanAndFixContrast(next);
      }
    }
  });
}

// Clear all fixes (used when switching theme)
export function resetContrastFixes(container = document.body) {
  if (!container) return;
  const fixed = container.querySelectorAll('[data-contrast-fixed]');
  fixed.forEach(el => {
    el.removeAttribute('data-contrast-fixed');
    el.style.removeProperty('color');
    el.style.removeProperty('text-shadow');
  });
}

// Initialize persistent real-time auto-contrast detection observer
export function initAutoContrastDetector() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__autoContrastInitialized) return;
  window.__autoContrastInitialized = true;

  // 1. Initial scan on boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanAndFixContrast();
    });
  } else {
    setTimeout(() => scanAndFixContrast(), 50);
  }

  // 2. Observer for dynamic React route switches, modal opens, table re-renders
  let debounceTimer = null;
  const observer = new MutationObserver((mutations) => {
    let hasRelevantMutation = false;
    for (const m of mutations) {
      // If class attribute on html changed (e.g. dark mode toggled)
      if (m.type === 'attributes' && m.attributeName === 'class' && m.target === document.documentElement) {
        resetContrastFixes();
        scanAndFixContrast();
        return;
      }
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        for (let j = 0; j < m.addedNodes.length; j++) {
          const node = m.addedNodes[j];
          if (node.nodeType === Node.ELEMENT_NODE && !node.hasAttribute('data-contrast-ignore')) {
            hasRelevantMutation = true;
            break;
          }
        }
      }
    }

    if (hasRelevantMutation) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        scanAndFixContrast();
      }, 60);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });

  // 3. Fallback interval pulse for any dynamic AJAX/state transitions
  setInterval(() => {
    scanAndFixContrast();
  }, 2500);

  // 4. Custom event listener for manual trigger
  window.addEventListener('theme-changed', () => {
    resetContrastFixes();
    setTimeout(() => scanAndFixContrast(), 50);
  });

  console.log('[AutoContrast] Intelligent Contrast & Visibility Detection Engine active.');
}
