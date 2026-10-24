import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MODULE_STAT_WIDGETS } from './moduleWidgetDefs';

export default function ModuleStatWidget(props) {
  const { state } = useApp();
  const widgetId = props.widgetId || (props.i && props.i.startsWith('module_stat_') ? props.i.replace(/^module_stat_/, '').replace(/_\d+$/, '') : null);
  const def = MODULE_STAT_WIDGETS[widgetId];

  const data = useMemo(() => {
    if (!def || typeof def.compute !== 'function') {
      return { value: '—', sub: '' };
    }
    try {
      return def.compute(state);
    } catch {
      return { value: '—', sub: '' };
    }
  }, [state, def]);

  if (!def) {
    return (
      <div className={`w-full h-full flex items-center justify-center rounded-xl border border-dashed ${
        state?.dashboardBackground 
          ? 'bg-transparent border-outline-variant/30' 
          : 'bg-surface-container-low border-outline-variant/30'
      }`}>
        <p className="text-xs font-bold text-on-surface-variant">{widgetId || 'Unknown Widget'}</p>
      </div>
    );
  }

  return (
    <div className={`h-full w-full flex flex-col justify-between select-none ${
      state?.dashboardBackground 
        ? 'bg-transparent' 
        : 'bg-surface-container-lowest'
    }`}>
      {/* Icon in tinted rounded box top-left */}
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl">{def.icon}</span>
        </div>
      </div>

      {/* Main stat: uppercase label + text-3xl font-black value */}
      <div className="my-auto py-1">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold truncate" title={def.name}>
          {def.name}
        </p>
        <p className="text-3xl font-black text-on-surface tracking-tight mt-1 truncate" title={data?.value}>
          {data?.value}
        </p>
      </div>

      {/* Sub text small below */}
      <div className="min-h-[1.25rem] flex items-center">
        <p className="text-xs font-medium text-on-surface-variant/80 truncate" title={data?.sub}>
          {data?.sub}
        </p>
      </div>
    </div>
  );
}
