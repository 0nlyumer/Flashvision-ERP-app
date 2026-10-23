import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';

export default function ThemeSettings() {
  const { state, updateThemeSettings } = useApp();
  const currentTheme = state?.themeSettings || { colorMode: 'dark', primaryColor: 'tradingview', fontStyle: 'inter', borderRadius: 'rounded' };

  const [colorMode, setColorMode] = useState(currentTheme.colorMode || 'dark');
  const [primaryColor, setPrimaryColor] = useState(currentTheme.primaryColor || 'tradingview');
  const [fontStyle, setFontStyle] = useState(currentTheme.fontStyle || 'inter');
  const [borderRadius, setBorderRadius] = useState(currentTheme.borderRadius || 'rounded');
  const [appliedNotification, setAppliedNotification] = useState(false);

  useEffect(() => {
    if (state?.themeSettings) {
      setColorMode(state.themeSettings.colorMode || 'dark');
      setPrimaryColor(state.themeSettings.primaryColor || 'tradingview');
      setFontStyle(state.themeSettings.fontStyle || 'inter');
      setBorderRadius(state.themeSettings.borderRadius || 'rounded');
    }
  }, [state?.themeSettings]);

  const triggerMorph = () => {
    const root = document.documentElement;
    root.classList.add('theme-morphing');
    setTimeout(() => root.classList.remove('theme-morphing'), 450);
  };

  const handleApplyTheme = () => {
    triggerMorph();
    updateThemeSettings({ colorMode, primaryColor, fontStyle, borderRadius });
    setAppliedNotification(true);
    setTimeout(() => setAppliedNotification(false), 3000);
  };

  const handleColorModeChange = (mode) => {
    triggerMorph();
    setColorMode(mode);
    updateThemeSettings({ colorMode: mode, primaryColor, fontStyle, borderRadius });
  };

  const handlePrimaryColorChange = (colorId) => {
    triggerMorph();
    setPrimaryColor(colorId);
    updateThemeSettings({ colorMode, primaryColor: colorId, fontStyle, borderRadius });
  };

  const handleFontStyleChange = (fontId) => {
    setFontStyle(fontId);
    updateThemeSettings({ colorMode, primaryColor, fontStyle: fontId, borderRadius });
  };

  const handleBorderRadiusChange = (radiusId) => {
    setBorderRadius(radiusId);
    updateThemeSettings({ colorMode, primaryColor, fontStyle, borderRadius: radiusId });
  };

  const handleReset = () => {
    triggerMorph();
    const defaults = { colorMode: 'dark', primaryColor: 'tradingview', fontStyle: 'inter', borderRadius: 'rounded' };
    setColorMode(defaults.colorMode);
    setPrimaryColor(defaults.primaryColor);
    setFontStyle(defaults.fontStyle);
    setBorderRadius(defaults.borderRadius);
    updateThemeSettings(defaults);
    setAppliedNotification(true);
    setTimeout(() => setAppliedNotification(false), 3000);
  };

  const colorOptions = [
    { id: 'tradingview', hex: '#2962ff', label: 'Executive Sapphire' },
    { id: 'indigo', hex: '#6366f1', label: 'Cyber Violet' },
    { id: 'emerald', hex: '#10b981', label: 'Emerald Mint' },
    { id: 'sky', hex: '#0ea5e9', label: 'Ocean Cyan' },
    { id: 'rose', hex: '#f43f5e', label: 'Coral Rose' },
    { id: 'amber', hex: '#f59e0b', label: 'Sunset Amber' },
  ];

  const fontOptions = [
    { id: 'inter', label: 'Inter (Ultra Clean Sans)', desc: 'High-density, crisp alphanumeric clarity' },
    { id: 'outfit', label: 'Outfit (Modern Display)', desc: 'Geometric, futuristic, ultra-smooth' },
    { id: 'roboto', label: 'Roboto (Enterprise)', desc: 'Classic, dependable industrial typography' },
    { id: 'manrope', label: 'Manrope (Rounded Modern)', desc: 'Semi-rounded geometric neo-grotesque with open letters' },
    { id: 'poppins', label: 'Poppins (Geometric Clean)', desc: 'Balanced geometric circles and modern rhythm' },
    { id: 'montserrat', label: 'Montserrat (Modernist Urban)', desc: 'Bold, architectural modernist proportions' },
    { id: 'opensans', label: 'Open Sans (Neutral Reading)', desc: 'Highly legible humanist design optimized for screens' },
    { id: 'lato', label: 'Lato (Warm Corporate)', desc: 'Harmonious semi-rounded warmth with serious stability' },
    { id: 'nunito', label: 'Nunito (Friendly Rounded)', desc: 'Soft rounded terminals offering approachable warmth' },
    { id: 'rubik', label: 'Rubik (Gentle Tech)', desc: 'Subtly rounded corners designed for smooth digital UI' },
    { id: 'worksans', label: 'Work Sans (Editorial Utility)', desc: 'Optimized for screen readability and clean data tables' },
    { id: 'dmsans', label: 'DM Sans (Minimal Precision)', desc: 'Low-contrast geometric sans for sleek interfaces' },
    { id: 'plusjakarta', label: 'Plus Jakarta Sans (Modern Executive)', desc: 'Refined contemporary sans with distinctive cut angles' },
    { id: 'ibmplex', label: 'IBM Plex Sans (Industrial Tech)', desc: 'Engineered corporate neutrality with sharp clarity' },
    { id: 'sourcesans', label: 'Source Sans 3 (Classic UI)', desc: 'Adobe-designed workhorse for enterprise interfaces' },
    { id: 'figtree', label: 'Figtree (Friendly Clean)', desc: 'Lighthearted, clear contemporary geometric sans' },
  ];

  const radiusOptions = [
    { id: 'sharp', label: 'Sharp (Modern Edge)', radiusClass: 'rounded-none' },
    { id: 'rounded', label: 'Rounded (Smooth Glass)', radiusClass: 'rounded-xl' },
    { id: 'pill', label: 'Pill (Curved Floating)', radiusClass: 'rounded-full' },
  ];

  return (
    <Layout subNavigation={
        <div className="flex flex-col gap-2">
            <div className="px-2 pb-2 mb-2 border-b border-outline-variant/10">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Settings</p>
            </div>
            <div className="w-full flex items-center gap-3 p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 backdrop-blur-md">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>palette</span>
                <span className="text-sm font-bold">Theme & Appearance</span>
            </div>
            <div className="w-full flex items-center gap-3 p-3 rounded-2xl text-on-surface-variant hover:bg-surface-container-low cursor-pointer transition-colors">
                <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                <span className="text-sm font-medium">User Profile</span>
            </div>
            <div className="w-full flex items-center gap-3 p-3 rounded-2xl text-on-surface-variant hover:bg-surface-container-low cursor-pointer transition-colors">
                <span className="material-symbols-outlined text-[20px]">shield</span>
                <span className="text-sm font-medium">Security</span>
            </div>
        </div>
    }>
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/10 pb-6">
            <div>
                <h1 className="text-3xl font-black text-on-surface tracking-tight font-headline flex items-center gap-3">
                  Theme & Appearance
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 backdrop-blur-md">
                    Pure Glass
                  </span>
                </h1>
                <p className="text-xs text-on-surface-variant mt-1.5 font-medium max-w-xl leading-relaxed">
                  Ultra Frosted Obsidian Dark Architecture with pure glassmorphic depth, sleek micro-interactions, and adaptive accents.
                </p>
            </div>

            {appliedNotification && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold animate-slide-up backdrop-blur-md">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Theme preferences applied live
                </div>
            )}
        </div>

        {/* Customization Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column */}
            <div className="space-y-6">
                
                {/* Interface Mode */}
                <div className="bg-surface-container-low/40 backdrop-blur-xl rounded-[28px] border border-outline-variant/20 p-7 shadow-lg shadow-black/5">
                    <h2 className="text-base font-bold text-on-surface mb-1.5 flex items-center gap-2 font-headline">
                        <span className="material-symbols-outlined text-primary text-[20px]">contrast</span>
                        Interface Mode
                    </h2>
                    <p className="text-xs text-on-surface-variant mb-5">Choose between Obsidian Ultra Glass Dark Theme or Frosted Pearl Light Mode.</p>
                    
                    <div className="flex gap-4">
                        <button 
                            type="button"
                            onClick={() => handleColorModeChange('dark')}
                            className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all cursor-pointer ${colorMode === 'dark' ? 'border-primary/80 bg-primary/10 shadow-[0_0_24px_rgba(41,98,255,0.2)] ring-1 ring-primary/40' : 'border-outline-variant/20 hover:border-outline-variant/40 bg-surface-container-low/50'}`}
                        >
                            <div className="w-13 h-13 rounded-full bg-[#0f0f0f] border border-white/10 flex items-center justify-center shadow-lg">
                                <span className="material-symbols-outlined text-[#2962ff] text-[24px]">dark_mode</span>
                            </div>
                            <div className="text-center">
                              <span className={`text-sm font-black block ${colorMode === 'dark' ? 'text-primary' : 'text-on-surface'}`}>Pure Black OLED</span>
                              <span className="text-[10px] text-on-surface-variant">Obsidian Pure Dark</span>
                            </div>
                        </button>

                        <button 
                            type="button"
                            onClick={() => handleColorModeChange('light')}
                            className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all cursor-pointer ${colorMode === 'light' ? 'border-primary/80 bg-primary/10 shadow-[0_0_24px_rgba(41,98,255,0.2)] ring-1 ring-primary/40' : 'border-outline-variant/20 hover:border-outline-variant/40 bg-surface-container-low/50'}`}
                        >
                            <div className="w-13 h-13 rounded-full bg-[#f8fafc] border border-black/10 flex items-center justify-center shadow-md">
                                <span className="material-symbols-outlined text-amber-500 text-[24px]">light_mode</span>
                            </div>
                            <div className="text-center">
                              <span className={`text-sm font-black block ${colorMode === 'light' ? 'text-primary' : 'text-on-surface'}`}>Crisp Light Mode</span>
                              <span className="text-[10px] text-on-surface-variant">Frosted Daylight Theme</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* System Palette */}
                <div className="bg-surface-container-low/40 backdrop-blur-xl rounded-[28px] border border-outline-variant/20 p-7 shadow-lg shadow-black/5">
                    <h2 className="text-base font-bold text-on-surface mb-1.5 flex items-center gap-2 font-headline">
                        <span className="material-symbols-outlined text-primary text-[20px]">palette</span>
                        Accent Color & Buttons
                    </h2>
                    <p className="text-xs text-on-surface-variant mb-5">Interactive button vibrancy, highlights, and badge accents.</p>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        {colorOptions.map(color => (
                            <button
                                key={color.id}
                                type="button"
                                onClick={() => handlePrimaryColorChange(color.id)}
                                title={color.label}
                                className={`h-12 rounded-xl flex flex-col items-center justify-center transition-all relative cursor-pointer ${primaryColor === color.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 shadow-lg' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                                style={{ backgroundColor: color.hex }}
                            >
                                {primaryColor === color.id && <span className="material-symbols-outlined text-white text-[20px] drop-shadow-md" style={{ fontVariationSettings: "'wght' 700" }}>check</span>}
                            </button>
                        ))}
                    </div>
                </div>

            </div>

            {/* Right Column */}
            <div className="space-y-6">
                
                {/* Typography */}
                <div className="bg-surface-container-low/40 backdrop-blur-xl rounded-[28px] border border-outline-variant/20 p-7 shadow-lg shadow-black/5">
                    <h2 className="text-base font-bold text-on-surface mb-1.5 flex items-center gap-2 font-headline">
                        <span className="material-symbols-outlined text-primary text-[20px]">font_download</span>
                        Typography Architecture
                    </h2>
                    <p className="text-xs text-on-surface-variant mb-5">High-performance font stack for data tables, metrics, and menus.</p>
                    
                    <div className="flex flex-col gap-2.5">
                        {fontOptions.map(font => (
                            <button
                                key={font.id}
                                type="button"
                                onClick={() => handleFontStyleChange(font.id)}
                                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left cursor-pointer ${fontStyle === font.id ? 'border-primary/80 bg-primary/10 shadow-sm' : 'border-outline-variant/20 hover:border-outline-variant/40 bg-surface-container-low/50'}`}
                            >
                                <div>
                                  <span className={`text-sm font-bold block ${fontStyle === font.id ? 'text-primary' : 'text-on-surface'}`}>{font.label}</span>
                                  <span className="text-[11px] text-on-surface-variant">{font.desc}</span>
                                </div>
                                {fontStyle === font.id && <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Component Geometry */}
                <div className="bg-surface-container-low/40 backdrop-blur-xl rounded-[28px] border border-outline-variant/20 p-7 shadow-lg shadow-black/5">
                    <h2 className="text-base font-bold text-on-surface mb-1.5 flex items-center gap-2 font-headline">
                        <span className="material-symbols-outlined text-primary text-[20px]">rounded_corner</span>
                        Component Geometry
                    </h2>
                    <p className="text-xs text-on-surface-variant mb-5">Corner curves for cards, inputs, dialogs, and navigation pills.</p>
                    
                    <div className="grid grid-cols-3 gap-3">
                        {radiusOptions.map(radius => (
                            <button
                                key={radius.id}
                                type="button"
                                onClick={() => handleBorderRadiusChange(radius.id)}
                                className={`flex flex-col items-center gap-2.5 p-3.5 rounded-xl border transition-all cursor-pointer ${borderRadius === radius.id ? 'border-primary/80 bg-primary/10' : 'border-outline-variant/20 hover:border-outline-variant/40 bg-surface-container-low/50'}`}
                            >
                                <div className={`w-full h-7 border border-outline-variant/30 bg-surface-container ${radius.radiusClass}`}></div>
                                <span className={`text-xs font-bold ${borderRadius === radius.id ? 'text-primary' : 'text-on-surface-variant'}`}>{radius.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

            </div>
        </div>

        {/* Action Bar */}
        <div className="mt-8 flex justify-end gap-3.5 pb-12">
            <button 
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-low font-bold text-xs transition-colors cursor-pointer"
            >
                Reset to Factory Default
            </button>
            <button 
                type="button"
                onClick={handleApplyTheme}
                className="px-7 py-2.5 rounded-xl bg-primary text-white font-bold text-xs transition-all hover:-translate-y-0.5 shadow-[0_0_20px_rgba(41,98,255,0.35)] cursor-pointer"
            >
                Save Theme Preference
            </button>
        </div>

      </div>
    </Layout>
  );
}
