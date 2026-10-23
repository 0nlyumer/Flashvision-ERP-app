let lastAppliedKey = null;

export const applyTheme = (settings = {}) => {
  const key = JSON.stringify(settings);
  if (key === lastAppliedKey) {
    return;
  }
  lastAppliedKey = key;

  const root = document.documentElement;

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
  const fonts = {
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
  };
  const selectedFont = fonts[settings.fontStyle] || fonts.inter;
  root.style.setProperty('--font-body', selectedFont);
  root.style.setProperty('--font-headline', selectedFont);

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
