import React from 'react';
import DeliveryWidget from './widgets/DeliveryWidget';
import ShortcutsWidget from './widgets/ShortcutsWidget';
import TodoListWidget from './widgets/TodoListWidget';
import CalendarWidget from './widgets/CalendarWidget';
import ProductionTargetWidget from './ProductionTargetWidget';
import ProductionItemsWidget from './ProductionItemsWidget';
import WorkingDaysWidget from './WorkingDaysWidget';
import AppIconWidget from './widgets/AppIconWidget';
import ModuleStatWidget from './ModuleStatWidget';

import { useApp } from '../../context/AppContext';

// A placeholder for widgets we haven't built yet but are in the catalog
const PlaceholderWidget = ({ name }) => {
  const { state } = useApp();
  return (
    <div className={`w-full h-full flex items-center justify-center rounded-xl border border-dashed ${
      state.dashboardBackground 
        ? 'bg-transparent border-outline-variant/30' 
        : 'bg-surface-container-low border-outline-variant/30'
    }`}>
      <p className="text-xs font-bold text-on-surface-variant">{name}</p>
    </div>
  );
};

export const WidgetRegistry = {
  'production_target': {
    name: 'Total Target Production',
    component: ProductionTargetWidget,
    defaultWidth: 6,
    defaultHeight: 4,
    module: 'productionPlanning',
    hint: "This month's production output against the monthly target, with progress."
  },
  'production_items': {
    name: 'Total Completed Items',
    component: ProductionItemsWidget,
    defaultWidth: 3,
    defaultHeight: 4,
    module: 'productionPlanning',
    hint: "Items completed in this month's production plans."
  },
  'working_days': {
    name: 'Working Days',
    component: WorkingDaysWidget,
    defaultWidth: 3,
    defaultHeight: 4,
    module: 'productionPlanning',
    hint: "Days with production plans this month."
  },
  'delivery_kpi': {
    name: 'Delivery KPI',
    component: DeliveryWidget,
    defaultWidth: 12,
    defaultHeight: 4,
    module: 'delivery',
    hint: "Total dispatches, pending challans and completed orders in one widget."
  },
  'shortcuts': {
    name: 'Quick Shortcuts',
    component: ShortcutsWidget,
    defaultWidth: 4,
    defaultHeight: 4,
    module: 'dashboard',
    hint: "Quick links to the main modules."
  },
  'todo_list': {
    name: 'Task Board',
    component: TodoListWidget,
    defaultWidth: 4,
    defaultHeight: 6,
    module: 'dashboard',
    hint: "Your personal task board."
  },
  'calendar': {
    name: 'Calendar',
    component: CalendarWidget,
    defaultWidth: 4,
    defaultHeight: 6,
    module: 'dashboard',
    hint: "Monthly calendar view."
  },
  'bom_calculator': {
    name: 'BOM Calculator',
    component: AppIconWidget,
    defaultWidth: 2,
    defaultHeight: 2,
    module: 'dashboard',
    hint: "Shortcut tile that opens the BOM Calculator.",
    appConfig: {
      title: 'BOM Calculator',
      icon: 'calculate',
      path: '/production?tab=bom-calculator'
    }
  },
  'document_warehouse': {
    name: 'E-Files',
    component: AppIconWidget,
    defaultWidth: 2,
    defaultHeight: 2,
    module: 'dashboard',
    hint: "Shortcut tile that opens E-Files.",
    appConfig: {
      title: 'E-Files',
      icon: 'shelves',
      path: '/dashboard?tab=e-files'
    }
  },
  'app_icon': {
    name: 'App Icon Shortcut',
    component: AppIconWidget,
    defaultWidth: 2,
    defaultHeight: 2,
    module: 'dashboard',
    hint: "A single app shortcut tile."
  },
  'module_stat': {
    name: 'Module Stat',
    component: ModuleStatWidget,
    defaultWidth: 3,
    defaultHeight: 3
  }
};

export const getWidgetComponent = (type) => {
  const widget = WidgetRegistry[type];
  // Unknown widget types (e.g. removed widgets lingering in an old saved
  // layout) render NOTHING — never an "Unknown: ..." placeholder box
  // (Omer, 2026-10-25).
  return widget ? widget.component : () => null;
};

export const isKnownWidgetType = (type) => Boolean(WidgetRegistry[type]);
