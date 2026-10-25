import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import { stripPhaseFromItems } from '../../utils/phaseStrip';

export default function RawMaterialConfig() {
    const { state, setCollection } = useApp();
    const { appConfirm, appAlert } = useDialog();
    const [selectedDept, setSelectedDept] = useState(() => {
        return state.departments?.[0]?.value || '';
    });

    const activeDepartments = useMemo(() => {
        return state.departments || [];
    }, [state.departments]);

    // Raw materials filtered by category/type and selected department
    const rawMaterials = useMemo(() => {
        const rMs = (state.items || []).filter(i => i.category === 'Raw Material' || i.type === 'Raw Material');
        if (!selectedDept) return rMs;
        return rMs.filter(item => {
            const depts = (item.department || '').split(',').map(d => d.trim().toLowerCase());
            return depts.includes(selectedDept.toLowerCase());
        });
    }, [state.items, selectedDept]);

    const handleTogglePhase = (itemId, phaseId) => {
        const updatedItems = (state.items || []).map(item => {
            if (item.id === itemId) {
                const phases = item.consumptionPhases || [];
                const newPhases = phases.includes(phaseId)
                    ? phases.filter(p => p !== phaseId)
                    : [...phases, phaseId];
                return { ...item, consumptionPhases: newPhases };
            }
            return item;
        });
        setCollection('items', updatedItems);
    };

    const handleToggleProductionAllowed = (itemId) => {
        const updatedItems = (state.items || []).map(item => {
            if (item.id === itemId) {
                return { ...item, productionAllowed: !item.productionAllowed };
            }
            return item;
        });
        setCollection('items', updatedItems);
    };

    // Round 4 (Omer, 2026-10-25): delete a Finished-Good phase GLOBALLY from
    // this screen — removes it from the global finishedGoodPhases list AND
    // strips its tick from every material's phase mapping (same phase-strip
    // principle as the RM-side delete in RawMaterialProduction). Saved plans'
    // consumptions and BOMs' phaseConfig are historical snapshots and are
    // NOT rewritten. RM-production phase columns have no delete here — they
    // stay managed in Raw Material Production.
    const handleDeleteFgPhase = async (phaseId, phaseTitle) => {
        const confirmDelete = await appConfirm(
            `Are you sure you want to delete the phase "${phaseTitle}"?\nThis will remove it globally from all raw material configurations, and its ticks will be removed from every material's phase mapping.`,
            "Delete Phase", "Delete", "Cancel"
        );
        if (!confirmDelete) return;

        const nextPhases = fgPhases.filter(p => p.id !== phaseId);
        setCollection('finishedGoodPhases', nextPhases);

        const cleanedItems = stripPhaseFromItems(state.items || [], phaseId);
        if (cleanedItems !== (state.items || [])) {
            setCollection('items', cleanedItems);
        }
        appAlert(`Phase "${phaseTitle}" removed.`, 'info');
    };

    const fgPhases = state.finishedGoodPhases || [
        { id: 'top', title: 'TOP Phase', label: 'TOP Phase' },
        { id: 'foam', title: 'FOAM Phase', label: 'FOAM Phase' },
        { id: 'adhesive', title: 'ADHESIVE Phase', label: 'ADHESIVE Phase' },
        { id: 'packing', title: 'Packing Specs', label: 'Packing Specs' }
    ];

    const rmPhases = state.rawMaterialPhases || [
        { id: 'rm_top', title: 'TOP Phase', label: 'TOP Phase' },
        { id: 'rm_foam', title: 'FOAM Phase', label: 'FOAM Phase' },
        { id: 'rm_adhesive', title: 'ADHESIVE Phase', label: 'ADHESIVE Phase' },
        { id: 'rm_packing', title: 'Packing Specs', label: 'Packing Specs' }
    ];

    return (
        <div className="animate-in fade-in duration-500 w-full max-w-full relative pb-10">
            {/* Header / Config Bar */}
            <div className="bg-surface-container-low p-6 rounded-2xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-none">
                <div>
                    <h2 className="text-xl font-manrope font-extrabold text-on-surface">Raw Material Configuration</h2>
                    <p className="text-xs text-on-surface-variant mt-1">Map raw materials to Finished Good consumption phases and Raw Material production phases.</p>
                </div>
                <div className="flex items-center gap-3 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/15 w-full md:w-80">
                    <span className="material-symbols-outlined text-outline text-lg pl-2">corporate_fare</span>
                    <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="bg-transparent border-none text-sm font-semibold focus:ring-0 w-full text-on-surface focus:outline-none"
                    >
                        <option value="">Select Department</option>
                        {activeDepartments.map(d => (
                            <option key={d.value} value={d.value}>{d.label || d.value}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Catalog List */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] overflow-hidden border border-outline-variant/10">
                <div className="overflow-x-auto w-full">
                    {rawMaterials.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                                <tr>
                                    <th rowSpan={2} className="py-4 px-6 border-b border-outline-variant/10 align-middle">Material Code</th>
                                    <th rowSpan={2} className="py-4 px-6 border-b border-outline-variant/10 align-middle">Material Name</th>
                                    {fgPhases.length > 0 && (
                                        <th colSpan={fgPhases.length} className="py-2 px-4 border-b border-outline-variant/15 text-center border-r border-outline-variant/15 bg-primary/5 text-primary text-[10px] tracking-widest font-extrabold uppercase">Finished Good Consumption Phases</th>
                                    )}
                                    {rmPhases.length > 0 && (
                                        <th colSpan={rmPhases.length} className="py-2 px-4 border-b border-outline-variant/15 text-center bg-secondary/5 text-secondary text-[10px] tracking-widest font-extrabold uppercase">Raw Material Production Phases</th>
                                    )}
                                    <th rowSpan={2} className="py-4 px-6 border-b border-outline-variant/10 text-center align-middle">Allow Production</th>
                                </tr>
                                <tr>
                                    {fgPhases.map((p, idx) => (
                                        <th key={p.id} className={`py-2 px-4 border-b border-outline-variant/10 text-center font-bold text-[9px] text-on-surface-variant ${idx === fgPhases.length - 1 ? 'border-r border-outline-variant/15' : ''}`}>
                                            <span className="inline-flex items-center gap-1">
                                                <span>{p.title || p.label}</span>
                                                <button
                                                    type="button"
                                                    data-fg-phase-delete={p.id}
                                                    onClick={() => handleDeleteFgPhase(p.id, p.title || p.label)}
                                                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-on-surface-variant/60 hover:text-error hover:bg-error/10 transition-colors"
                                                    title={`Delete phase "${p.title || p.label}" globally`}
                                                    aria-label={`Delete phase ${p.title || p.label}`}
                                                >
                                                    <span className="material-symbols-outlined text-[13px] leading-none">close</span>
                                                </button>
                                            </span>
                                        </th>
                                    ))}
                                    {rmPhases.map(p => (
                                        <th key={p.id} className="py-2 px-4 border-b border-outline-variant/10 text-center font-bold text-[9px] text-on-surface-variant">{p.title || p.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-container/50">
                                {rawMaterials.map(item => (
                                    <tr key={item.id} className="hover:bg-surface-container-low/30 transition-colors group">
                                        <td className="py-4 px-6 font-mono text-xs font-semibold text-on-surface-variant align-middle">{item.sku || '-'}</td>
                                        <td className="py-4 px-6 text-sm font-bold text-on-surface align-middle">{item.name}</td>
                                        
                                        {/* Finished Good Phases checkboxes */}
                                        {fgPhases.map((p, idx) => {
                                            const isChecked = item.consumptionPhases?.includes(p.id) || false;
                                            return (
                                                <td key={p.id} className={`py-4 px-4 text-center align-middle ${idx === fgPhases.length - 1 ? 'border-r border-outline-variant/15' : ''}`}>
                                                    <label className="inline-flex items-center justify-center p-2 rounded-full cursor-pointer hover:bg-surface-container-high transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => handleTogglePhase(item.id, p.id)}
                                                            className="rounded border-outline-variant/40 text-primary focus:ring-primary/20 bg-transparent w-4 h-4 cursor-pointer"
                                                        />
                                                    </label>
                                                </td>
                                            );
                                        })}

                                        {/* Raw Material Phases checkboxes */}
                                        {rmPhases.map(p => {
                                            const isChecked = item.consumptionPhases?.includes(p.id) || false;
                                            return (
                                                <td key={p.id} className="py-4 px-4 text-center align-middle">
                                                    <label className="inline-flex items-center justify-center p-2 rounded-full cursor-pointer hover:bg-surface-container-high transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => handleTogglePhase(item.id, p.id)}
                                                            className="rounded border-outline-variant/40 text-secondary focus:ring-secondary/20 bg-transparent w-4 h-4 cursor-pointer"
                                                        />
                                                    </label>
                                                </td>
                                            );
                                        })}

                                        <td className="py-4 px-6 text-center align-middle">
                                            <label className="inline-flex items-center justify-center p-2 rounded-full cursor-pointer hover:bg-surface-container-high transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={item.productionAllowed || false}
                                                    onChange={() => handleToggleProductionAllowed(item.id)}
                                                    className="rounded border-outline-variant/40 text-secondary focus:ring-secondary/20 bg-transparent w-4 h-4 cursor-pointer"
                                                />
                                            </label>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-12 text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-4xl text-outline mb-2">inventory_2</span>
                          <p className="font-semibold text-sm">No raw materials found for the selected department.</p>
                          <p className="text-xs text-outline mt-1">Ensure materials have the chosen department mapped in Settings.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
