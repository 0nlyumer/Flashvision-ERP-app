// Single source of truth for font stacks. The first 16 are Google Fonts
// loaded in index.html; the 8 "famous" fonts (Omer, 2026-10-24) are
// system fonts — no webfont download needed, with metric-compatible
// fallbacks where they exist (Carlito for Calibri).
export const FONT_STACKS = {
  inter: '"Inter", sans-serif',
  roboto: '"Roboto", sans-serif',
  outfit: '"Outfit", sans-serif',
  manrope: '"Manrope", sans-serif',
  poppins: '"Poppins", sans-serif',
  montserrat: '"Montserrat", sans-serif',
  opensans: '"Open Sans", sans-serif',
  lato: '"Lato", sans-serif',
  nunito: '"Nunito", sans-serif',
  rubik: '"Rubik", sans-serif',
  worksans: '"Work Sans", sans-serif',
  dmsans: '"DM Sans", sans-serif',
  plusjakarta: '"Plus Jakarta Sans", sans-serif',
  ibmplex: '"IBM Plex Sans", sans-serif',
  sourcesans: '"Source Sans 3", sans-serif',
  figtree: '"Figtree", sans-serif',
  calibri: '"Calibri", "Carlito", sans-serif',
  arial: 'Arial, "Helvetica Neue", sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
  tahoma: 'Tahoma, Geneva, sans-serif',
  timesnewroman: '"Times New Roman", Times, serif',
  georgia: 'Georgia, serif',
  trebuchet: '"Trebuchet MS", sans-serif',
  segoeui: '"Segoe UI", sans-serif',
};

export const FONT_SIZE_OPTIONS = [14, 15, 16, 17, 18];
export const DEFAULT_FONT_SIZE = 16;

export const resolveFontStack = (fontStyle) => FONT_STACKS[fontStyle] || FONT_STACKS.inter;

// Only the offered sizes are honoured; anything else (incl. old saved
// settings without a size) falls back to the browser default 16, so
// existing users see zero change until they pick a size.
export const resolveFontSizePx = (settings = {}) => {
  const n = Number(settings.fontSize);
  return FONT_SIZE_OPTIONS.includes(n) ? n : DEFAULT_FONT_SIZE;
};

// ─── Signature UI-Kit Themes (Omer, 2026-10-28) ─────────────────────────────
// Four full-app themes extracted from the UI-kit pictures Omer picked.
// Each kit is a complete light theme: layered pastel page background,
// its own surface ramp, accent + primary gradient, table-head tint and
// soft geometry. Selecting a kit overrides colorMode/primaryColor/border
// radius *visually* (the stored manual settings stay untouched); choosing
// "Classic" (kitTheme null) returns to the manual controls exactly.
// Persistence rides the existing per-user themeSettings path (server-side).
export const KIT_THEMES = {
  pastelglass: {
    label: 'Pastel Glass',
    desc: 'Warm cream glass, sunset gradient accents',
    background: '#f6f1e7',
    bodyBg: 'radial-gradient(52rem 34rem at 8% -6%, #f8ead0 0%, rgba(248,234,208,0) 60%), radial-gradient(46rem 32rem at 102% 12%, #f7dcc4 0%, rgba(247,220,196,0) 58%), radial-gradient(40rem 30rem at -6% 88%, #cfe9f8 0%, rgba(207,233,248,0) 60%), radial-gradient(34rem 26rem at 88% 104%, #f9e3ae 0%, rgba(249,227,174,0) 62%), linear-gradient(160deg, #faf6ee 0%, #f3eee3 100%)',
    surface: '#ffffff',
    surfaceLowest: '#fffdf9',
    surfaceLow: '#fdf8ef',
    surfaceContainer: '#f9f2e6',
    surfaceHigh: '#f2e9d8',
    surfaceHighest: '#e9dcC4',
    onSurface: '#2e2a33',
    onSurfaceVariant: '#7a7284',
    outlineVariant: 'rgba(96, 78, 55, 0.10)',
    outline: 'rgba(96, 78, 55, 0.20)',
    primary: '#7c5cf6',
    primaryGradient: 'linear-gradient(120deg, #f6b73c 0%, #f97fc0 38%, #9a6bff 72%, #5b8cff 100%)',
    primaryContainer: '#f0eafd',
    onPrimaryContainer: '#5b21b6',
    tableHead: '#f3e9d7',
    radius: { default: '0.5rem', lg: '0.9rem', xl: '1.25rem', '2xl': '1.75rem', '3xl': '2.25rem', full: '9999px' },
  },
  blossompink: {
    label: 'Blossom Pink',
    desc: 'Blush pink wash, pink-to-violet gradient cards',
    background: '#fdf0f5',
    bodyBg: 'radial-gradient(50rem 32rem at 100% -8%, #fbd9e8 0%, rgba(251,217,232,0) 58%), radial-gradient(44rem 30rem at -8% 20%, #fde7f1 0%, rgba(253,231,241,0) 60%), radial-gradient(42rem 30rem at 55% 112%, #eedcff 0%, rgba(238,220,255,0) 60%), linear-gradient(155deg, #fff5f9 0%, #fdeef5 100%)',
    surface: '#ffffff',
    surfaceLowest: '#fffcfd',
    surfaceLow: '#fff7fa',
    surfaceContainer: '#fdeef4',
    surfaceHigh: '#fadfea',
    surfaceHighest: '#f4c6da',
    onSurface: '#3d2432',
    onSurfaceVariant: '#8a5a70',
    outlineVariant: 'rgba(190, 90, 130, 0.12)',
    outline: 'rgba(190, 90, 130, 0.22)',
    primary: '#ec4899',
    primaryGradient: 'linear-gradient(120deg, #f472b6 0%, #c084fc 58%, #818cf8 100%)',
    primaryContainer: '#fce7f3',
    onPrimaryContainer: '#9d174d',
    tableHead: '#fadfea',
    radius: { default: '0.5rem', lg: '0.9rem', xl: '1.25rem', '2xl': '1.75rem', '3xl': '2.25rem', full: '9999px' },
  },
  mintaurora: {
    label: 'Mint Aurora',
    desc: 'Pale mint glass, coral-to-sky aurora gradient',
    background: '#eff7f3',
    bodyBg: 'radial-gradient(48rem 32rem at 96% -6%, #e9defc 0%, rgba(233,222,252,0) 58%), radial-gradient(44rem 30rem at -6% 10%, #d9f4e7 0%, rgba(217,244,231,0) 60%), radial-gradient(40rem 28rem at 12% 108%, #fde3ee 0%, rgba(253,227,238,0) 60%), linear-gradient(160deg, #f7fcfa 0%, #ecf6f1 100%)',
    surface: '#ffffff',
    surfaceLowest: '#fdfffe',
    surfaceLow: '#f7fcfa',
    surfaceContainer: '#edf7f1',
    surfaceHigh: '#e0f0e7',
    surfaceHighest: '#cde7d8',
    onSurface: '#232038',
    onSurfaceVariant: '#6d6a85',
    outlineVariant: 'rgba(60, 70, 90, 0.10)',
    outline: 'rgba(60, 70, 90, 0.19)',
    primary: '#6366f1',
    primaryGradient: 'linear-gradient(90deg, #fb7185 0%, #a78bfa 52%, #38bdf8 100%)',
    primaryContainer: '#e6e9ff',
    onPrimaryContainer: '#3730a3',
    tableHead: '#e2f1e8',
    radius: { default: '0.5rem', lg: '0.9rem', xl: '1.25rem', '2xl': '1.75rem', '3xl': '2.25rem', full: '9999px' },
  },
  glacierblue: {
    label: 'Glacier Blue',
    desc: 'Icy blue-white depth, strong azure actions',
    background: '#ebf3fc',
    bodyBg: 'radial-gradient(50rem 34rem at 102% -8%, #ffffff 0%, rgba(255,255,255,0) 55%), radial-gradient(46rem 32rem at -8% 16%, #d8ebfc 0%, rgba(216,235,252,0) 60%), radial-gradient(44rem 30rem at 70% 110%, #cfe4f9 0%, rgba(207,228,249,0) 62%), linear-gradient(158deg, #f4f9ff 0%, #e6f1fc 100%)',
    surface: '#ffffff',
    surfaceLowest: '#fdfeff',
    surfaceLow: '#f6fbff',
    surfaceContainer: '#eef6fd',
    surfaceHigh: '#dfedfb',
    surfaceHighest: '#c9e1f6',
    onSurface: '#17293f',
    onSurfaceVariant: '#5b7694',
    outlineVariant: 'rgba(30, 90, 160, 0.12)',
    outline: 'rgba(30, 90, 160, 0.22)',
    primary: '#1f7aec',
    primaryGradient: 'linear-gradient(120deg, #38bdf8 0%, #1d6fe0 100%)',
    primaryContainer: '#dbeafe',
    onPrimaryContainer: '#1e40af',
    tableHead: '#dfedfb',
    radius: { default: '0.375rem', lg: '0.75rem', xl: '1rem', '2xl': '1.375rem', '3xl': '1.75rem', full: '9999px' },
  },
};

export const resolveKitTheme = (settings = {}) => KIT_THEMES[settings.kitTheme] || null;

let lastAppliedKey = null;

export const applyTheme = (settings = {}) => {
  const key = JSON.stringify(settings);
  if (key === lastAppliedKey) {
    return;
  }
  lastAppliedKey = key;

  const root = document.documentElement;
  const kit = resolveKitTheme(settings);

  // 0. Signature kit themes take over the palette wholesale (light designs).
  if (kit) {
    root.classList.remove('dark');
    root.dataset.kit = settings.kitTheme;
    root.style.setProperty('--color-background', kit.background);
    root.style.setProperty('--kit-body-bg', kit.bodyBg);
    root.style.setProperty('--color-surface', kit.surface);
    root.style.setProperty('--color-surface-container-lowest', kit.surfaceLowest);
    root.style.setProperty('--color-surface-container-low', kit.surfaceLow);
    root.style.setProperty('--color-surface-container', kit.surfaceContainer);
    root.style.setProperty('--color-surface-container-high', kit.surfaceHigh);
    root.style.setProperty('--color-surface-container-highest', kit.surfaceHighest);
    root.style.setProperty('--color-on-background', kit.onSurface);
    root.style.setProperty('--color-on-surface', kit.onSurface);
    root.style.setProperty('--color-on-surface-variant', kit.onSurfaceVariant);
    root.style.setProperty('--color-outline-variant', kit.outlineVariant);
    root.style.setProperty('--color-outline', kit.outline);
    root.style.setProperty('--color-primary', kit.primary);
    root.style.setProperty('--color-on-primary', '#ffffff');
    root.style.setProperty('--color-primary-container', kit.primaryContainer);
    root.style.setProperty('--color-on-primary-container', kit.onPrimaryContainer);
    root.style.setProperty('--kit-primary-gradient', kit.primaryGradient);
    root.style.setProperty('--kit-table-head', kit.tableHead);
    const selectedFont = resolveFontStack(settings.fontStyle);
    root.style.setProperty('--font-body', selectedFont);
    root.style.setProperty('--font-headline', selectedFont);
    root.style.setProperty('font-size', resolveFontSizePx(settings) + 'px');
    root.style.setProperty('--radius-default', kit.radius.default);
    root.style.setProperty('--radius-lg', kit.radius.lg);
    root.style.setProperty('--radius-xl', kit.radius.xl);
    root.style.setProperty('--radius-2xl', kit.radius['2xl']);
    root.style.setProperty('--radius-3xl', kit.radius['3xl']);
    root.style.setProperty('--radius-full', kit.radius.full);
    return;
  }
  delete root.dataset.kit;
  root.style.removeProperty('--kit-body-bg');
  root.style.removeProperty('--kit-primary-gradient');
  root.style.removeProperty('--kit-table-head');

  // 1. Color Mode (Obsidian Ultra Glass Dark / Pure Frosted Pearl Light)
  if (settings.colorMode === 'dark') {
    root.classList.add('dark');
    // Deep Luxury Obsidian Palette
    root.style.setProperty('--color-background', '#0b0e14'); // Deep obsidian luxury canvas
    root.style.setProperty('--color-surface', '#121620');    // Frosted glass widget surface
    root.style.setProperty('--color-surface-container-lowest', '#07090e');
    root.style.setProperty('--color-surface-container-low', '#0e121a');
    root.style.setProperty('--color-surface-container', '#141924'); // Elevated glass surface
    root.style.setProperty('--color-surface-container-high', '#1a202e');
    root.style.setProperty('--color-surface-container-highest', '#222a3d');
    root.style.setProperty('--color-on-background', '#f0f3fa');
    root.style.setProperty('--color-on-surface', '#f0f3fa'); // Crisp white text
    root.style.setProperty('--color-on-surface-variant', '#94a3b8'); // Muted label text
    root.style.setProperty('--color-outline-variant', 'rgba(255, 255, 255, 0.07)'); // Soft glass micro-border
    root.style.setProperty('--color-outline', 'rgba(255, 255, 255, 0.12)');
  } else {
    root.classList.remove('dark');
    // Pure Premium White Light Mode Palette
    root.style.setProperty('--color-background', '#ffffff');
    root.style.setProperty('--color-surface', '#ffffff');
    root.style.setProperty('--color-surface-container-lowest', '#ffffff');
    root.style.setProperty('--color-surface-container-low', '#fbfbfd');
    root.style.setProperty('--color-surface-container', '#f6f8fb');
    root.style.setProperty('--color-surface-container-high', '#edf2f7');
    root.style.setProperty('--color-surface-container-highest', '#e2e8f0');
    root.style.setProperty('--color-on-background', '#0f172a');
    root.style.setProperty('--color-on-surface', '#0f172a');
    root.style.setProperty('--color-on-surface-variant', '#64748b');
    root.style.setProperty('--color-outline-variant', 'rgba(0, 0, 0, 0.05)');
    root.style.setProperty('--color-outline', 'rgba(0, 0, 0, 0.09)');
  }

  // 2. Primary & Action Color (With Adaptive Dark Mode Vibrancy)
  const isDark = settings.colorMode === 'dark';
  const colors = {
    tradingview: {
      light: { primary: '#2962ff', container: '#dbeafe', onPrimary: '#ffffff', onPrimaryContainer: '#1e40af' },
      dark: { primary: '#2962ff', container: 'rgba(41, 98, 255, 0.25)', onPrimary: '#ffffff', onPrimaryContainer: '#93c5fd' }
    },
    indigo: {
      light: { primary: '#4f46e5', container: '#e0e7ff', onPrimary: '#ffffff', onPrimaryContainer: '#3730a3' },
      dark: { primary: '#6366f1', container: 'rgba(99, 102, 241, 0.25)', onPrimary: '#ffffff', onPrimaryContainer: '#c7d2fe' }
    },
    emerald: {
      light: { primary: '#059669', container: '#d1fae5', onPrimary: '#ffffff', onPrimaryContainer: '#065f46' },
      dark: { primary: '#10b981', container: 'rgba(16, 185, 129, 0.25)', onPrimary: '#ffffff', onPrimaryContainer: '#a7f3d0' }
    },
    sky: {
      light: { primary: '#0284c7', container: '#e0f2fe', onPrimary: '#ffffff', onPrimaryContainer: '#075985' },
      dark: { primary: '#0ea5e9', container: 'rgba(14, 165, 233, 0.25)', onPrimary: '#ffffff', onPrimaryContainer: '#bae6fd' }
    },
    rose: {
      light: { primary: '#e11d48', container: '#ffe4e6', onPrimary: '#ffffff', onPrimaryContainer: '#9f1239' },
      dark: { primary: '#f43f5e', container: 'rgba(244, 63, 94, 0.25)', onPrimary: '#ffffff', onPrimaryContainer: '#fecdd3' }
    },
    amber: {
      light: { primary: '#d97706', container: '#fef3c7', onPrimary: '#ffffff', onPrimaryContainer: '#92400e' },
      dark: { primary: '#f59e0b', container: 'rgba(245, 158, 11, 0.25)', onPrimary: '#ffffff', onPrimaryContainer: '#fde68a' }
    }
  };

  const selectedPalette = colors[settings.primaryColor] || colors.tradingview;
  const activeColor = isDark ? selectedPalette.dark : selectedPalette.light;

  root.style.setProperty('--color-primary', activeColor.primary);
  root.style.setProperty('--color-on-primary', activeColor.onPrimary);
  root.style.setProperty('--color-primary-container', activeColor.container);
  root.style.setProperty('--color-on-primary-container', activeColor.onPrimaryContainer);

  // 3. Typography
  const selectedFont = resolveFontStack(settings.fontStyle);
  root.style.setProperty('--font-body', selectedFont);
  root.style.setProperty('--font-headline', selectedFont);

  // 3b. Base font size (root px; Tailwind rem sizes scale with it).
  // webScale (DisplaySettings transform scale) is a separate mechanism and
  // is never touched here. Missing/invalid size => browser default 16.
  root.style.setProperty('font-size', resolveFontSizePx(settings) + 'px');

  // 4. Border Radius
  const radius = {
    sharp: { default: '0px', lg: '0px', xl: '0px', '2xl': '0px', '3xl': '0px', full: '0px' },
    rounded: { default: '0.25rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem', full: '9999px' },
    pill: { default: '1rem', lg: '1rem', xl: '1.5rem', '2xl': '2rem', '3xl': '3rem', full: '9999px' }
  };
  const selectedRadius = radius[settings.borderRadius] || radius.rounded;
  root.style.setProperty('--radius-default', selectedRadius.default);
  root.style.setProperty('--radius-lg', selectedRadius.lg);
  root.style.setProperty('--radius-xl', selectedRadius.xl);
  root.style.setProperty('--radius-2xl', selectedRadius['2xl']);
  root.style.setProperty('--radius-3xl', selectedRadius['3xl']);
  root.style.setProperty('--radius-full', selectedRadius.full);
};
