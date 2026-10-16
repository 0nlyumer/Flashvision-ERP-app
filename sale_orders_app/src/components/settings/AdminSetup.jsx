import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import CustomSelect from '../ui/CustomSelect';

export default function AdminSetup() {
  const { state, updateAdminSetup } = useApp();
  
  const [formData, setFormData] = useState({
    companyName: '',
    registrationNumber: '',
    fbaRegisteredId: '',
    logo: '',
    baseCurrency: 'PKR (Rs)',
    timezone: 'UTC (Universal)',
    companyOwner: {
      name: '',
      email: '',
      phone: ''
    }
  });

  useEffect(() => {
    if (state.adminSetup) {
      setFormData({
        ...state.adminSetup,
        companyOwner: state.adminSetup.companyOwner || { name: '', email: '', phone: '' }
      });
    }
  }, [state.adminSetup]);

  const handleInputChange = (field, value, isOwnerField = false) => {
    if (isOwnerField) {
      setFormData(prev => ({
        ...prev,
        companyOwner: { ...prev.companyOwner, [field]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSave = () => {
    updateAdminSetup(formData);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative pb-10">
      
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
        <div>
          <h2 className="text-xl font-bold font-headline text-on-surface mb-2">Administrative Setup</h2>
          <p className="text-sm font-body text-on-surface-variant max-w-2xl">
            Manage global system parameters, organizational details, and operational defaults.
          </p>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-2xl overflow-hidden shadow-sm">
        
        {/* ======================= SETUP FORM ======================= */}
        <div className="p-4 sm:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Group 1: Org Profile */}
            <div className="space-y-6">
              <div className="border-b border-outline-variant/20 pb-2 mb-4">
                <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">domain</span>
                  Organization Profile
                </h3>
              </div>

              {/* Company Logo Upload */}
              <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
                <div className="w-20 h-20 rounded-xl bg-surface border-2 border-outline-variant/30 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                  {formData.logo ? (
                    <img src={formData.logo} alt="Company Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="material-symbols-outlined text-3xl text-outline-variant">image</span>
                  )}
                </div>
                <div className="text-center sm:text-left">
                  <label className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-block mb-2 shadow-sm">
                    Upload Logo
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files[0];
                      if(file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          handleInputChange('logo', reader.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Recommended: PNG or SVG, Max 500KB</p>
                </div>
              </div>

              <div className="relative group">
                <input 
                  type="text" 
                  value={formData.companyName} 
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all" 
                />
                <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold text-primary uppercase tracking-wider">Company Name</label>
              </div>

              <div className="relative group">
                <input 
                  type="text" 
                  value={formData.registrationNumber}
                  onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all font-mono" 
                />
                <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold text-primary uppercase tracking-wider">Registration Number</label>
              </div>

              <div className="relative group">
                <input 
                  type="text" 
                  value={formData.fbaRegisteredId || ''}
                  onChange={(e) => handleInputChange('fbaRegisteredId', e.target.value)}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all font-mono" 
                />
                <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold text-primary uppercase tracking-wider">FBA Registered ID</label>
              </div>
            </div>

            {/* Group 2: App Preferences */}
            <div className="space-y-6">
              <div className="border-b border-outline-variant/20 pb-2 mb-4">
                <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
                  System Preferences
                </h3>
              </div>

              <div className="relative group">
                <CustomSelect
                  name="baseCurrency"
                  value={formData.baseCurrency}
                  onChange={(e) => handleInputChange('baseCurrency', e.target.value)}
                  options={[
                    { label: 'USD ($)', value: 'USD ($)' },
                    { label: 'EUR (€)', value: 'EUR (€)' },
                    { label: 'PKR (Rs)', value: 'PKR (Rs)' },
                    { label: 'INR (₹)', value: 'INR (₹)' },
                    { label: 'GBP (£)', value: 'GBP (£)' },
                    { label: 'AED (Dhs)', value: 'AED (Dhs)' },
                    { label: 'CAD (C$)', value: 'CAD (C$)' },
                    { label: 'AUD (A$)', value: 'AUD (A$)' }
                  ]}
                  label="Base Currency"
                />
              </div>

              <div className="relative group">
                <CustomSelect
                  name="timezone"
                  value={formData.timezone}
                  onChange={(e) => handleInputChange('timezone', e.target.value)}
                  options={[
                    { label: 'UTC (Universal)', value: 'UTC (Universal)' },
                    { label: 'EST (Eastern Time)', value: 'EST (Eastern Time)' },
                    { label: 'PKT (Pakistan Standard Time)', value: 'PKT (Pakistan Standard Time)' }
                  ]}
                  label="Timezone"
                />
              </div>
            </div>

            {/* Group 3: Company Owner Details */}
            <div className="space-y-6 md:col-span-2 pt-4 border-t border-outline-variant/10">
              <div className="border-b border-outline-variant/20 pb-2 mb-4">
                <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">admin_panel_settings</span>
                  Company Owner Profile
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="relative group">
                  <input 
                    type="text" 
                    value={formData.companyOwner.name}
                    onChange={(e) => handleInputChange('name', e.target.value, true)}
                    className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all" 
                  />
                  <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold text-primary uppercase tracking-wider">Owner Name</label>
                </div>

                <div className="relative group">
                  <input 
                    type="email" 
                    value={formData.companyOwner.email}
                    onChange={(e) => handleInputChange('email', e.target.value, true)}
                    className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all" 
                  />
                  <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold text-primary uppercase tracking-wider">Owner Email</label>
                </div>

                <div className="relative group">
                  <input 
                    type="text" 
                    value={formData.companyOwner.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value, true)}
                    className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all" 
                  />
                  <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold text-primary uppercase tracking-wider">Owner Phone</label>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-8 pt-6 border-t border-outline-variant/20 flex justify-end gap-4">
            <button 
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-primary to-primary-container shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 relative overflow-hidden group"
            >
              <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
              <span className="relative flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">save</span>
                Save Parameters
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
