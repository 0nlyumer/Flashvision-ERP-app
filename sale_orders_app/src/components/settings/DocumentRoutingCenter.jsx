import React, { useState, useEffect } from 'react';
import { useDialog } from '../../context/DialogContext';
import { useApp } from '../../context/AppContext';

export default function DocumentRoutingCenter() {
  const { appAlert } = useDialog();
  const { state, setCollection, startRoutingWorkflow } = useApp();

  // Core States
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [historyRule, setHistoryRule] = useState(null);
  const [rulesList, setRulesList] = useState([]);
  const [activeEditingRule, setActiveEditingRule] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('workflows'); // 'workflows' | 'simulator'

  // Builder States
  const [ruleName, setRuleName] = useState('New Document Workflow');
  const [steps, setSteps] = useState([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState(null);

  // Inspector States (Form search filters)
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [binderSearchTerm, setBinderSearchTerm] = useState('');

  // Simulator States
  const [simDocTitle, setSimDocTitle] = useState('New Test Document');
  const [simDocType, setSimDocType] = useState('Onboarding Document');
  const [simDocCreator, setSimDocCreator] = useState('admin');
  const [simDocDetails, setSimDocDetails] = useState('Auto-generated test document payload.');
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Predefined Document Types
  const documentTypes = [
    'Onboarding Document',
    'Overtime Request',
    'Leave Request',
    'Loan Request',
    'Advance Request',
    'Salary Sheet',
    'Contract Renewal',
    'Vendor Invoice',
    'Sales Order',
    'GRN Log',
    'Inventory Audit'
  ];

  // Predefined Binders fallback
  const fallbackBinders = [
    { name: 'FINANCIAL_REPORTS', icon: 'receipt_long' },
    { name: 'SALES_INVOICES', icon: 'receipt_long' },
    { name: 'VENDOR_LEDGERS', icon: 'receipt_long' },
    { name: 'HR_ONBOARDING_PROFILES', icon: 'assignment_ind' },
    { name: 'EMPLOYEE_ROSTER', icon: 'assignment_ind' },
    { name: 'OFFICIAL_RECORDS', icon: 'assignment_ind' },
    { name: 'PRODUCTION_BOM_RECORDS', icon: 'category' },
    { name: 'INVENTORY_GOODS', icon: 'category' },
    { name: 'STOCK_LEVEL_LOGS', icon: 'category' }
  ];

  const getBindersList = () => {
    return state.documentWarehouseBinders || fallbackBinders;
  };

  const users = state.users || [
    { id: 1, name: 'Admin', username: 'admin', role: 'Super Admin', status: 'Active' }
  ];

  // Load rules on mount - NO DUMMY RULES seeded
  useEffect(() => {
    const savedRules = localStorage.getItem('hr_routing_rules_config');
    if (savedRules) {
      try {
        setRulesList(JSON.parse(savedRules));
      } catch (e) {
        setRulesList([]);
      }
    } else {
      setRulesList([]);
    }
  }, []);

  const saveRulesToLocalStorage = (updated) => {
    setRulesList(updated);
    localStorage.setItem('hr_routing_rules_config', JSON.stringify(updated));
    setCollection('routingRules', updated);
  };

  useEffect(() => {
    if (state.routingRules && Array.isArray(state.routingRules)) {
      setRulesList(state.routingRules);
      localStorage.setItem('hr_routing_rules_config', JSON.stringify(state.routingRules));
    }
  }, [state.routingRules]);

  // Filter Group list based on Module 1 (Creator Scope Filter) selected users
  const getFilteredGroups = () => {
    const allChats = state.chats || [];
    const groupChats = allChats.filter(c => c.isGroup);

    // Default mock groups if none exist
    const finalGroups = groupChats.length > 0 ? groupChats : [
      { id: 'group_hr', name: 'HR Team Hub', isGroup: true, members: ['admin', 'sales_rep'] },
      { id: 'group_finance', name: 'Finance Committee', isGroup: true, members: ['admin'] },
      { id: 'group_production', name: 'Factory Production Floor', isGroup: true, members: ['sales_rep'] }
    ];

    // Find users selected in audience_selector steps
    const audienceSteps = steps.filter(s => s.type === 'audience_selector');
    let selectedAudienceUsers = [];
    audienceSteps.forEach(step => {
      if (step.config?.selectAll) {
        selectedAudienceUsers = [...selectedAudienceUsers, ...users.map(u => u.username)];
      } else if (step.config?.selectedUsers) {
        selectedAudienceUsers = [...selectedAudienceUsers, ...step.config.selectedUsers];
      }
    });

    if (selectedAudienceUsers.length === 0) {
      return []; // Return empty as no creator selector is configured
    }

    return finalGroups.filter(g =>
      g.members && g.members.some(member => selectedAudienceUsers.includes(member))
    );
  };

  // Action Handlers
  const handleCreateNewRule = () => {
    setActiveEditingRule(null);
    setRuleName('New Document Workflow');
    setSteps([
      {
        id: `step-${Date.now()}-1`,
        type: 'audience_selector',
        name: 'Creator Scope Filter',
        config: { selectedUsers: ['admin'], selectAll: false }
      },
      {
        id: `step-${Date.now()}-2`,
        type: 'document_trigger',
        name: 'Trigger Event Scope',
        config: { selectedDocTypes: ['Onboarding Document'], selectAll: false }
      }
    ]);
    setSelectedStepIndex(0);
    setIsBuilderOpen(true);
  };

  const handleEditRule = (rule) => {
    setActiveEditingRule(rule);
    setRuleName(rule.name);
    setSteps(rule.steps || []);
    setSelectedStepIndex(rule.steps?.length > 0 ? 0 : null);
    setIsBuilderOpen(true);
  };

  const handleDeleteRule = (id) => {
    const updated = rulesList.filter(r => r.id !== id);
    saveRulesToLocalStorage(updated);
    appAlert('Rule deleted successfully!');
  };

  const handleCloneRule = (rule) => {
    const cloned = {
      ...rule,
      id: `RUL-${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      name: `${rule.name} (Copy)`,
      lastExecuted: 'Never'
    };
    const updated = [...rulesList, cloned];
    saveRulesToLocalStorage(updated);
    appAlert('Rule cloned successfully!');
  };

  const handleToggleRuleStatus = (rule) => {
    const updated = rulesList.map(r => {
      if (r.id === rule.id) {
        return { ...r, status: r.status === 'Active' ? 'Paused' : 'Active' };
      }
      return r;
    });
    saveRulesToLocalStorage(updated);
    appAlert(`Rule is now ${rule.status === 'Active' ? 'Paused' : 'Active'}!`);
  };

  // Load template demo workflow for testing/verification
  const handleLoadDemoTemplate = () => {
    const demoRule = {
      id: 'RUL-DEMO-01',
      name: 'Onboarding Approval & Archive Workflow',
      status: 'Active',
      lastExecuted: 'Never',
      trigger: 'Onboarding Document',
      folders: ['HR_ONBOARDING_PROFILES'],
      targetUsers: '@admin',
      steps: [
        {
          id: 'step-demo-1',
          type: 'audience_selector',
          name: 'Creator Scope Filter',
          config: { selectedUsers: ['admin'], selectAll: false }
        },
        {
          id: 'step-demo-2',
          type: 'document_trigger',
          name: 'Trigger Event Scope',
          config: { selectedDocTypes: ['Onboarding Document'], selectAll: false }
        },
        {
          id: 'step-demo-3',
          type: 'approval_gate',
          name: 'Conditional Approval Gate',
          config: { approvalUser: 'admin', onReject: 'close' }
        },
        {
          id: 'step-demo-4',
          type: 'chat_dispatcher',
          name: 'Instant Chat Dispatcher',
          config: { selectedUsers: ['admin'], selectedGroups: [], selectAllUsers: false, selectAllGroups: false }
        },
        {
          id: 'step-demo-5',
          type: 'archive_binder',
          name: 'Folder Storage Archiver',
          config: { selectedBinders: ['HR_ONBOARDING_PROFILES'], selectAll: false }
        }
      ]
    };
    const updated = [...rulesList, demoRule];
    saveRulesToLocalStorage(updated);
    appAlert('Demo Automation Rule loaded successfully!');
  };

  // Step manipulations
  const addStep = (type) => {
    let name = 'New Step';
    let config = {};

    if (type === 'audience_selector') {
      name = 'Creator Scope Filter';
      config = { selectedUsers: [], selectAll: false };
    } else if (type === 'document_trigger') {
      name = 'Trigger Event Scope';
      config = { selectedDocTypes: [], selectAll: false };
    } else if (type === 'approval_gate') {
      name = 'Conditional Approval Gate';
      config = { approvalUser: 'admin', onReject: 'close' };
    } else if (type === 'chat_dispatcher') {
      name = 'Instant Chat Dispatcher';
      config = { selectedUsers: [], selectedGroups: [], selectAllUsers: false, selectAllGroups: false };
    } else if (type === 'archive_binder') {
      name = 'Folder Storage Archiver';
      config = { selectedBinders: [], selectAll: false };
    }

    const newStep = {
      id: `step-${Date.now()}-${steps.length + 1}`,
      type,
      name,
      config
    };

    setSteps([...steps, newStep]);
    setSelectedStepIndex(steps.length);
  };

  const deleteStep = (index) => {
    const updated = steps.filter((_, idx) => idx !== index);
    setSteps(updated);
    if (selectedStepIndex === index) {
      setSelectedStepIndex(updated.length > 0 ? 0 : null);
    } else if (selectedStepIndex > index) {
      setSelectedStepIndex(selectedStepIndex - 1);
    }
  };

  const moveStep = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === steps.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...steps];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;

    setSteps(updated);
    setSelectedStepIndex(newIndex);
  };

  // Step configs updates
  const updateStepConfig = (updatedConfig) => {
    const updated = steps.map((s, idx) => {
      if (idx === selectedStepIndex) {
        return { ...s, config: { ...s.config, ...updatedConfig } };
      }
      return s;
    });
    setSteps(updated);
  };

  const handleDeployRule = () => {
    if (!ruleName.trim()) {
      appAlert('Specify a valid rule name!');
      return;
    }
    if (steps.length === 0) {
      appAlert('Add at least one step to the rule workflow!');
      return;
    }

    // Compat flat variables for listing
    const audienceStep = steps.find(s => s.type === 'audience_selector');
    const triggerStep = steps.find(s => s.type === 'document_trigger');
    const binderStep = steps.find(s => s.type === 'archive_binder');

    const flatUsers = audienceStep?.config?.selectAll 
      ? 'All Users' 
      : audienceStep?.config?.selectedUsers?.map(u => `@${u}`).join(', ') || 'Any';

    const flatTrigger = triggerStep?.config?.selectAll
      ? 'All Documents'
      : triggerStep?.config?.selectedDocTypes?.join(', ') || 'Any';

    const flatBinders = binderStep?.config?.selectAll
      ? ['All Binders']
      : binderStep?.config?.selectedBinders || [];

    const updatedRule = {
      id: activeEditingRule?.id || `RUL-${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      name: ruleName,
      status: activeEditingRule?.status || 'Active',
      lastExecuted: activeEditingRule?.lastExecuted || 'Never',
      trigger: flatTrigger,
      folders: flatBinders,
      targetUsers: flatUsers,
      steps: steps
    };

    let updatedList = [];
    if (activeEditingRule) {
      updatedList = rulesList.map(r => r.id === activeEditingRule.id ? updatedRule : r);
    } else {
      updatedList = [...rulesList, updatedRule];
    }

    saveRulesToLocalStorage(updatedList);
    appAlert('Routing Workflow successfully saved and published!', 'success');
    setIsBuilderOpen(false);
  };

  // Simulation handlers
  const handleLaunchSimulation = () => {
    const activeRules = rulesList.filter(r => r.status === 'Active');
    if (activeRules.length === 0) {
      appAlert('Create and activate at least one routing rule first!');
      return;
    }

    const testDoc = {
      id: `DOC-SIM-${Date.now().toString().slice(-4)}`,
      title: simDocTitle,
      type: simDocType,
      createdBy: simDocCreator,
      details: simDocDetails
    };

    // Run rules matching logic
    startRoutingWorkflow(testDoc);
    appAlert('Simulated Document uploaded. Check execution log below!', 'success');
  };

  // Simulate Actions for Waiting_Approval Tasks directly from simulator
  const handleSimulateApprovalAction = (taskId, status) => {
    const approvalId = `APP-RT-${taskId.split('-')[1]}`;
    
    // Update state.approvals through AppContext setCollection
    setCollection('approvals', prev => {
      const approvalsList = prev || [];
      return approvalsList.map(a => {
        if (a.id === approvalId) {
          return { ...a, status: status, completedAt: new Date().toISOString(), reasonComment: 'Simulated review action.' };
        }
        return a;
      });
    });

    appAlert(`Simulated decision: ${status}`);
  };

  // Search filter for workflows
  const filteredWorkflows = rulesList.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeTasks = state.routingTasks || [];
  const selectedTask = activeTasks.find(t => t.id === selectedTaskId) || activeTasks[activeTasks.length - 1];

  return (
    <div className="w-full flex flex-col min-h-[600px]">
      <style>{`
        .grid-pattern {
          background-size: 20px 20px;
          background-image: 
            linear-gradient(to right, rgba(114, 119, 130, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(114, 119, 130, 0.05) 1px, transparent 1px);
        }
        .btn-gradient {
          background: linear-gradient(135deg, #0f172a, #1e293b);
        }
      `}</style>

      {!isBuilderOpen ? (
        /* ==================== WORKSPACE / MAIN VIEW ==================== */
        <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
          {/* Header section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-on-surface tracking-tight font-headline flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">account_tree</span>
                Document Routing Center
              </h2>
              <p className="text-on-surface-variant text-sm mt-1">
                Establish ordered automation workflows. Documents travel step-by-step through rules based on criteria.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCreateNewRule}
                className="btn-gradient text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all hover:opacity-90 active:scale-95 shadow-sm"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                Create New Rule
              </button>
            </div>
          </div>

          {/* Tabs Menu */}
          <div className="flex border-b border-outline-variant/20 gap-6">
            <button
              onClick={() => setActiveTab('workflows')}
              className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'workflows' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">settings_suggest</span>
              Automation Rules ({rulesList.length})
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'simulator' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">precision_manufacturing</span>
              Live Simulator & Logs ({activeTasks.length})
            </button>
          </div>

          {/* TAB CONTENTS */}
          {activeTab === 'workflows' ? (
            <div className="flex flex-col gap-6">
              {/* Rules List table */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between border-b border-surface-container-highest bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <h3 className="font-headline text-base font-bold text-on-surface">Active Rules definitions</h3>
                    <div className="relative w-64">
                      <span className="material-symbols-outlined absolute left-2 top-2 text-slate-400 text-sm">search</span>
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1 bg-surface-container-low border border-outline-variant/20 rounded-lg text-xs outline-none"
                        placeholder="Search rules..."
                      />
                    </div>
                  </div>
                  {rulesList.length === 0 && (
                    <button
                      onClick={handleLoadDemoTemplate}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">download</span>
                      Load Demo Template
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-slate-50/30 border-b border-surface-container-highest">
                        <th className="px-6 py-3">Rule Name & ID</th>
                        <th className="px-6 py-3">Creator targeted</th>
                        <th className="px-6 py-3">Document trigger</th>
                        <th className="px-6 py-3">DMS binders</th>
                        <th className="px-6 py-3">Steps</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-medium text-on-surface divide-y divide-surface-container-highest/35">
                      {filteredWorkflows.length > 0 ? (
                        filteredWorkflows.map((rule) => (
                          <tr key={rule.id} className="hover:bg-slate-50/40 transition-colors group">
                            <td className="px-6 py-4">
                              <div>
                                <p className="font-bold text-slate-800">{rule.name}</p>
                                <p className="text-[9px] text-slate-450 font-mono tracking-wider font-bold">{rule.id}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-650 max-w-[150px] truncate block">
                                {rule.targetUsers || 'Any'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-[10px] font-bold text-blue-700 max-w-[150px] truncate block">
                                {rule.trigger || 'Any'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700 max-w-[150px] truncate block">
                                {rule.folders?.join(', ') || 'None'}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-slate-600">
                              {rule.steps?.length || 0} steps
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => handleToggleRuleStatus(rule)}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                  rule.status === 'Active' 
                                    ? 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10' 
                                    : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${rule.status === 'Active' ? 'bg-primary animate-pulse' : 'bg-slate-450'}`} />
                                {rule.status}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setHistoryRule(rule)}
                                  className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg"
                                  title="Execution History"
                                >
                                  <span className="material-symbols-outlined text-[16px]">history</span>
                                </button>
                                <button
                                  onClick={() => handleEditRule(rule)}
                                  className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg"
                                  title="Edit"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button
                                  onClick={() => handleCloneRule(rule)}
                                  className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg"
                                  title="Clone"
                                >
                                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteRule(rule.id)}
                                  className="p-1.5 text-slate-500 hover:text-error hover:bg-error/10 rounded-lg"
                                  title="Delete"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-semibold italic">
                            No active rules configured. Click "Create New Rule" or "Load Demo Template" to start.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* ==================== SIMULATOR TAB ==================== */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
              
              {/* Simulator launcher form */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10">
                  <h3 className="font-headline font-bold text-sm text-slate-800 mb-4 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">publish</span>
                    Simulate Document Upload
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Document Title</label>
                      <input 
                        type="text" 
                        value={simDocTitle}
                        onChange={(e) => setSimDocTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary focus:bg-white transition-colors font-medium text-slate-700"
                        placeholder="e.g. intern contract"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Document Type</label>
                        <select 
                          value={simDocType}
                          onChange={(e) => setSimDocType(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none cursor-pointer focus:bg-white text-slate-700 font-bold"
                        >
                          {documentTypes.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Creator Account</label>
                        <select 
                          value={simDocCreator}
                          onChange={(e) => setSimDocCreator(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none cursor-pointer focus:bg-white text-slate-700 font-bold"
                        >
                          {users.map(u => (
                            <option key={u.id} value={u.username}>@{u.username} ({u.role})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Details Payload</label>
                      <textarea 
                        rows="2"
                        value={simDocDetails}
                        onChange={(e) => setSimDocDetails(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary focus:bg-white transition-colors font-medium text-slate-650"
                        placeholder="Details..."
                      />
                    </div>

                    <button 
                      onClick={handleLaunchSimulation}
                      className="w-full py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-xl font-headline font-bold text-xs shadow transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                      Submit simulated document
                    </button>
                  </div>
                </div>

                {/* Execution task queue */}
                <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 flex-grow">
                  <h3 className="font-headline font-bold text-sm text-slate-800 mb-3">Recent Execution Queue</h3>
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {activeTasks.length > 0 ? (
                      [...activeTasks].reverse().map(task => {
                        const isSelected = selectedTask && selectedTask.id === task.id;
                        return (
                          <div 
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                              isSelected 
                                ? 'bg-primary/5 border-primary shadow-sm' 
                                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-mono font-bold text-slate-400">{task.id}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                task.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                task.status === 'Failed' ? 'bg-error/10 text-error' :
                                task.status === 'Waiting_Approval' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {task.status.replace('_', ' ')}
                              </span>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-700 truncate">{task.document.title}</h4>
                              <p className="text-[9px] text-slate-400 mt-0.5">Workflow: {task.ruleName}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs font-bold text-slate-400 italic text-center py-8">
                        No simulations have been run yet.
                      </p>
                    )}
                  </div>
                </div>

              </div>

              {/* Detail history execution logs viewer */}
              <div className="lg:col-span-7">
                <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 h-full min-h-[500px] flex flex-col">
                  {selectedTask ? (
                    <div className="flex-1 flex flex-col gap-6">
                      
                      {/* Log Header */}
                      <div className="border-b border-outline-variant/10 pb-4 flex justify-between items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-extrabold text-slate-800">{selectedTask.document.title}</h3>
                            <span className="text-[9px] font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold text-slate-500">{selectedTask.id}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 font-bold">
                            Workflow: <span className="text-slate-650">{selectedTask.ruleName}</span> | Creator: <span className="text-slate-650 font-mono">@{selectedTask.document.createdBy}</span>
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                          selectedTask.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                          selectedTask.status === 'Failed' ? 'bg-error/10 text-error' :
                          selectedTask.status === 'Waiting_Approval' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {selectedTask.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Approval Pending action card in simulator */}
                      {selectedTask.status === 'Waiting_Approval' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 animate-bounce flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">pending_actions</span>
                              Decision required (Simulated Approval Gate)
                            </h4>
                            <p className="text-[10px] text-amber-700 mt-1 font-semibold">
                              Awaiting authorization from approver user: <span className="font-bold underline">@{selectedTask.steps[selectedTask.currentStepIndex]?.config?.approvalUser}</span>.
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleSimulateApprovalAction(selectedTask.id, 'Rejected')}
                              className="px-3 py-1.5 bg-white border border-error/20 hover:bg-error/5 text-error rounded-xl font-bold text-[10px] transition-all cursor-pointer"
                            >
                              Simulate Reject
                            </button>
                            <button
                              onClick={() => handleSimulateApprovalAction(selectedTask.id, 'Approved')}
                              className="px-3 py-1.5 bg-primary text-on-primary hover:shadow rounded-xl font-bold text-[10px] transition-all cursor-pointer"
                            >
                              Simulate Approve
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Timeline Steps logs list */}
                      <div className="flex-1 flex flex-col gap-4">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Workflow Travel History Log</h4>
                        
                        <div className="relative pl-6 border-l border-slate-200 space-y-6 flex-1 max-h-[350px] overflow-y-auto py-1">
                          {selectedTask.history.map((log, index) => {
                            const isSuccess = log.status === 'Success';
                            const isFailed = log.status === 'Failed';
                            const isEscalated = log.status === 'Escalated';
                            
                            return (
                              <div key={index} className="relative group">
                                {/* Dot indicator */}
                                <div className={`absolute left-[-29px] top-0 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center z-10 ${
                                  isSuccess ? 'border-emerald-500 text-emerald-500' :
                                  isFailed ? 'border-error text-error' :
                                  isEscalated ? 'border-orange-500 text-orange-500' :
                                  'border-amber-500 text-amber-500 animate-pulse'
                                }`}>
                                  <span className="material-symbols-outlined text-[8px] font-black">
                                    {isSuccess ? 'check' : isFailed ? 'close' : 'pending'}
                                  </span>
                                </div>

                                <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <h5 className="text-xs font-bold text-slate-800 leading-tight">{log.stepName}</h5>
                                    <p className="text-[10px] text-slate-500 mt-1 font-medium">{log.message}</p>
                                  </div>
                                  <span className="text-[9px] font-mono text-slate-400 font-bold shrink-0">{log.timestamp}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-slate-400 py-12">
                      <span className="material-symbols-outlined text-4xl mb-2 text-slate-350">account_tree</span>
                      <p className="text-xs font-bold">Select a simulated execution to view history log details</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      ) : (
        /* ==================== SEQUENTIAL WORKFLOW BUILDER ==================== */
        <div className="flex flex-col flex-grow bg-slate-50 border border-outline-variant/15 rounded-3xl overflow-hidden relative shadow-lg animate-in fade-in duration-300">
          
          {/* Top Panel Controls */}
          <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsBuilderOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                title="Back to List"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
              </button>
              <div className="w-px h-6 bg-slate-200"></div>
              <div>
                <input 
                  type="text" 
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="bg-transparent border-b border-transparent hover:border-slate-350 focus:border-primary focus:outline-none text-base font-extrabold text-on-surface px-1 font-headline leading-none py-0.5"
                  placeholder="Rule Name..."
                />
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 font-body">
                  {activeEditingRule ? `Editing Rule: ${activeEditingRule.id}` : 'Creating New Workflow Draft'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setIsBuilderOpen(false)}
                className="px-4 py-2 rounded-xl bg-white text-slate-700 font-headline font-bold text-xs border border-outline-variant/20 hover:bg-slate-100 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeployRule}
                className="px-5 py-2 rounded-xl btn-gradient text-white font-headline font-bold text-xs shadow-md hover:opacity-95 transition-opacity flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-xs">publish</span>
                Save &amp; Publish Rule
              </button>
            </div>
          </div>

          {/* Builder workspace grids */}
          <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[550px]">
            
            {/* Step list canvas */}
            <div className="lg:col-span-7 flex flex-col p-6 grid-pattern overflow-y-auto border-r border-slate-200 custom-scrollbar justify-between">
              
              <div className="flex flex-col gap-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Workflow Step Sequence Pipeline</h4>
                
                <div className="flex flex-col gap-3">
                  {steps.map((step, idx) => {
                    const isSelected = selectedStepIndex === idx;
                    
                    let stepSummary = 'Unconfigured';
                    if (step.type === 'audience_selector') {
                      stepSummary = step.config?.selectAll ? 'Apply to All active users' : `Target users: ${step.config?.selectedUsers?.length || 0} selected`;
                    } else if (step.type === 'document_trigger') {
                      stepSummary = step.config?.selectAll ? 'Triggers on All document types' : `Document types: ${step.config?.selectedDocTypes?.length || 0} selected`;
                    } else if (step.type === 'approval_gate') {
                      stepSummary = `Awaiting Review & Approval from @${step.config?.approvalUser || 'admin'}`;
                    } else if (step.type === 'chat_dispatcher') {
                      stepSummary = `Dispatch chat to: ${step.config?.selectedUsers?.length || 0} users, ${step.config?.selectedGroups?.length || 0} groups`;
                    } else if (step.type === 'archive_binder') {
                      stepSummary = step.config?.selectAll ? 'Attach to All binders' : `Save inside binders: ${step.config?.selectedBinders?.length || 0} selected`;
                    }

                    return (
                      <React.Fragment key={step.id}>
                        {idx > 0 && (
                          <div className="flex justify-center my-[-4px]">
                            <span className="material-symbols-outlined text-slate-355 text-sm font-bold animate-pulse">arrow_downward</span>
                          </div>
                        )}
                        <div 
                          onClick={() => { setSelectedStepIndex(idx); }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                            isSelected 
                              ? 'bg-white border-primary shadow-md ring-2 ring-primary/5' 
                              : 'bg-white/95 border-slate-200 hover:border-slate-350 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              step.type === 'audience_selector' ? 'bg-blue-100 text-blue-700' :
                              step.type === 'document_trigger' ? 'bg-teal-100 text-teal-700' :
                              step.type === 'approval_gate' ? 'bg-amber-100 text-amber-700' :
                              step.type === 'chat_dispatcher' ? 'bg-indigo-100 text-indigo-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              <span className="material-symbols-outlined text-sm font-bold">
                                {step.type === 'audience_selector' ? 'groups' :
                                 step.type === 'document_trigger' ? 'bolt' :
                                 step.type === 'approval_gate' ? 'lock_person' :
                                 step.type === 'chat_dispatcher' ? 'chat' :
                                 'inventory_2'}
                              </span>
                            </div>
                            <div>
                              <h5 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                                Step {idx + 1}: {step.name}
                              </h5>
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5 leading-none">{stepSummary}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => moveStep(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 hover:bg-slate-100 rounded text-slate-450 hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
                              title="Move Up"
                            >
                              <span className="material-symbols-outlined text-sm font-bold">arrow_upward</span>
                            </button>
                            <button
                              onClick={() => moveStep(idx, 'down')}
                              disabled={idx === steps.length - 1}
                              className="p-1 hover:bg-slate-100 rounded text-slate-450 hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
                              title="Move Down"
                            >
                              <span className="material-symbols-outlined text-sm font-bold">arrow_downward</span>
                            </button>
                            <button
                              onClick={() => deleteStep(idx)}
                              className="p-1 hover:bg-error/5 rounded text-slate-450 hover:text-error"
                              title="Delete Step"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Steps creation toolbar */}
              <div className="bg-white/80 backdrop-blur border border-outline-variant/10 p-3 rounded-2xl mt-8">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center mb-2.5">
                  Click to add module step to workflow
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button 
                    onClick={() => addStep('audience_selector')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-50 text-[10px] font-extrabold transition-all"
                  >
                    <span className="material-symbols-outlined text-xs">groups</span>
                    + Target Audience
                  </button>
                  <button 
                    onClick={() => addStep('document_trigger')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 text-teal-700 bg-teal-50/50 hover:bg-teal-50 text-[10px] font-extrabold transition-all"
                  >
                    <span className="material-symbols-outlined text-xs">bolt</span>
                    + Document Trigger
                  </button>
                  <button 
                    onClick={() => addStep('approval_gate')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-50 text-[10px] font-extrabold transition-all"
                  >
                    <span className="material-symbols-outlined text-xs">lock_person</span>
                    + Approval Gate
                  </button>
                  <button 
                    onClick={() => addStep('chat_dispatcher')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 text-[10px] font-extrabold transition-all"
                  >
                    <span className="material-symbols-outlined text-xs">chat</span>
                    + Chat Dispatcher
                  </button>
                  <button 
                    onClick={() => addStep('archive_binder')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 text-[10px] font-extrabold transition-all"
                  >
                    <span className="material-symbols-outlined text-xs">inventory_2</span>
                    + Folder Storage
                  </button>
                </div>
              </div>

            </div>

            {/* Config Inspector Panel */}
            <div className="lg:col-span-5 bg-white p-6 overflow-y-auto custom-scrollbar flex flex-col">
              
              {selectedStepIndex !== null && steps[selectedStepIndex] ? (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="border-b border-slate-100 pb-4">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Step Configuration Inspector
                    </span>
                    <h4 className="text-sm font-black text-slate-800">
                      {steps[selectedStepIndex].name}
                    </h4>
                  </div>

                  {/* 1. Creator Scope Filter Config Form */}
                  {steps[selectedStepIndex].type === 'audience_selector' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <label className="text-xs font-bold text-slate-700 cursor-pointer" htmlFor="selectAllAudience">
                          Apply to All Active Users
                        </label>
                        <input
                          id="selectAllAudience"
                          type="checkbox"
                          checked={steps[selectedStepIndex].config?.selectAll || false}
                          onChange={(e) => updateStepConfig({ selectAll: e.target.checked })}
                          className="w-4 h-4 text-primary rounded outline-none accent-primary cursor-pointer"
                        />
                      </div>

                      {!steps[selectedStepIndex].config?.selectAll && (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase">
                            Select targeted Creator accounts
                          </label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-2 top-2 text-slate-400 text-sm">search</span>
                            <input 
                              type="text" 
                              value={userSearchTerm}
                              onChange={(e) => setUserSearchTerm(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs outline-none focus:bg-white"
                              placeholder="Filter users..."
                            />
                          </div>

                          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <input 
                              id="selectAllUsersCheck"
                              type="checkbox"
                              checked={users.length > 0 && (steps[selectedStepIndex].config?.selectedUsers || []).length === users.length}
                              onChange={(e) => {
                                updateStepConfig({
                                  selectedUsers: e.target.checked ? users.map(u => u.username) : []
                                });
                              }}
                              className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                            />
                            <label htmlFor="selectAllUsersCheck" className="text-[10px] font-bold text-slate-500 cursor-pointer">
                              Select All/Deselect All
                            </label>
                          </div>

                          <div className="flex flex-col border border-slate-200 rounded-xl max-h-[220px] overflow-y-auto divide-y divide-slate-100">
                            {users
                              .filter(u => u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.username.toLowerCase().includes(userSearchTerm.toLowerCase()))
                              .map(user => {
                                const isChecked = (steps[selectedStepIndex].config?.selectedUsers || []).includes(user.username);
                                return (
                                  <label key={user.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        const curList = steps[selectedStepIndex].config?.selectedUsers || [];
                                        const nextList = isChecked ? curList.filter(u => u !== user.username) : [...curList, user.username];
                                        updateStepConfig({ selectedUsers: nextList });
                                      }}
                                      className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                                    />
                                    <div>
                                      <p className="text-xs font-bold text-slate-700 leading-none">@{user.username}</p>
                                      <p className="text-[9px] text-slate-450 mt-0.5">{user.name} ({user.role})</p>
                                    </div>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Trigger Event Scope Config Form */}
                  {steps[selectedStepIndex].type === 'document_trigger' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <label className="text-xs font-bold text-slate-700 cursor-pointer" htmlFor="selectAllTriggers">
                          Trigger on All Document Types
                        </label>
                        <input
                          id="selectAllTriggers"
                          type="checkbox"
                          checked={steps[selectedStepIndex].config?.selectAll || false}
                          onChange={(e) => updateStepConfig({ selectAll: e.target.checked })}
                          className="w-4 h-4 text-primary rounded outline-none accent-primary cursor-pointer"
                        />
                      </div>

                      {!steps[selectedStepIndex].config?.selectAll && (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase">
                            Select trigger Document Types
                          </label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-2 top-2 text-slate-400 text-sm">search</span>
                            <input 
                              type="text" 
                              value={docSearchTerm}
                              onChange={(e) => setDocSearchTerm(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs outline-none focus:bg-white"
                              placeholder="Filter document types..."
                            />
                          </div>

                          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <input 
                              id="selectAllDocsCheck"
                              type="checkbox"
                              checked={documentTypes.length > 0 && (steps[selectedStepIndex].config?.selectedDocTypes || []).length === documentTypes.length}
                              onChange={(e) => {
                                updateStepConfig({
                                  selectedDocTypes: e.target.checked ? [...documentTypes] : []
                                });
                              }}
                              className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                            />
                            <label htmlFor="selectAllDocsCheck" className="text-[10px] font-bold text-slate-500 cursor-pointer">
                              Select All/Deselect All
                            </label>
                          </div>

                          <div className="flex flex-col border border-slate-200 rounded-xl max-h-[220px] overflow-y-auto divide-y divide-slate-100">
                            {documentTypes
                              .filter(t => t.toLowerCase().includes(docSearchTerm.toLowerCase()))
                              .map(type => {
                                const isChecked = (steps[selectedStepIndex].config?.selectedDocTypes || []).includes(type);
                                return (
                                  <label key={type} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        const curList = steps[selectedStepIndex].config?.selectedDocTypes || [];
                                        const nextList = isChecked ? curList.filter(t => t !== type) : [...curList, type];
                                        updateStepConfig({ selectedDocTypes: nextList });
                                      }}
                                      className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700">{type}</span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Conditional Approval Gate Config Form */}
                  {steps[selectedStepIndex].type === 'approval_gate' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                          Authority Approver User
                        </label>
                        <select
                          value={steps[selectedStepIndex].config?.approvalUser || 'admin'}
                          onChange={(e) => updateStepConfig({ approvalUser: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs outline-none cursor-pointer focus:bg-white font-bold text-slate-700"
                        >
                          {users.map(u => (
                            <option key={u.id} value={u.username}>@{u.username} ({u.role})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                          Action if Approved
                        </label>
                        <select
                          disabled
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs outline-none font-bold text-slate-400"
                        >
                          <option>Proceed to next step in automation pipeline</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                          Action if Rejected
                        </label>
                        <select
                          value={steps[selectedStepIndex].config?.onReject || 'close'}
                          onChange={(e) => updateStepConfig({ onReject: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs outline-none cursor-pointer focus:bg-white font-bold text-slate-700"
                        >
                          <option value="close">Close Request &amp; Terminate Workflow</option>
                          <option value="next">Proceed to next step anyway</option>
                          <option value="escalate">Escalate &amp; Reroute to Admin</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* 4. Instant Chat Dispatcher Config Form */}
                  {steps[selectedStepIndex].type === 'chat_dispatcher' && (
                    <div className="space-y-6">
                      
                      {/* Users selection */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-450 uppercase">
                            Share in Personal Chats (Users)
                          </label>
                          <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={steps[selectedStepIndex].config?.selectAllUsers || false}
                              onChange={(e) => updateStepConfig({ selectAllUsers: e.target.checked })}
                              className="w-3 h-3 accent-primary"
                            />
                            Select All
                          </label>
                        </div>

                        {!steps[selectedStepIndex].config?.selectAllUsers && (
                          <>
                            <div className="relative">
                              <span className="material-symbols-outlined absolute left-2 top-2 text-slate-400 text-xs font-bold">search</span>
                              <input 
                                type="text" 
                                value={userSearchTerm}
                                onChange={(e) => setUserSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1 pl-7 pr-3 text-[11px] outline-none focus:bg-white"
                                placeholder="Search users..."
                              />
                            </div>

                            <div className="flex flex-col border border-slate-200 rounded-xl max-h-[140px] overflow-y-auto divide-y divide-slate-100">
                              {users
                                .filter(u => u.username.toLowerCase().includes(userSearchTerm.toLowerCase()))
                                .map(user => {
                                  const isChecked = (steps[selectedStepIndex].config?.selectedUsers || []).includes(user.username);
                                  return (
                                    <label key={user.id} className="flex items-center gap-2.5 p-2 hover:bg-slate-50 cursor-pointer">
                                      <input 
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          const curList = steps[selectedStepIndex].config?.selectedUsers || [];
                                          const nextList = isChecked ? curList.filter(u => u !== user.username) : [...curList, user.username];
                                          updateStepConfig({ selectedUsers: nextList });
                                        }}
                                        className="w-3.5 h-3.5 rounded accent-primary"
                                      />
                                      <span className="text-xs font-bold text-slate-700">@{user.username}</span>
                                    </label>
                                  );
                                })}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Filtered groups selection */}
                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-450 uppercase">
                            Share in Group Chats
                          </label>
                          <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={steps[selectedStepIndex].config?.selectAllGroups || false}
                              onChange={(e) => updateStepConfig({ selectAllGroups: e.target.checked })}
                              className="w-3 h-3 accent-primary"
                            />
                            Select All
                          </label>
                        </div>

                        {!steps[selectedStepIndex].config?.selectAllGroups && (
                          <>
                            {getFilteredGroups().length > 0 ? (
                              <>
                                <div className="relative">
                                  <span className="material-symbols-outlined absolute left-2 top-2 text-slate-400 text-xs font-bold">search</span>
                                  <input 
                                    type="text" 
                                    value={groupSearchTerm}
                                    onChange={(e) => setGroupSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1 pl-7 pr-3 text-[11px] outline-none focus:bg-white"
                                    placeholder="Search groups..."
                                  />
                                </div>

                                <div className="flex flex-col border border-slate-200 rounded-xl max-h-[140px] overflow-y-auto divide-y divide-slate-100">
                                  {getFilteredGroups()
                                    .filter(g => g.name.toLowerCase().includes(groupSearchTerm.toLowerCase()))
                                    .map(group => {
                                      const isChecked = (steps[selectedStepIndex].config?.selectedGroups || []).includes(group.id);
                                      return (
                                        <label key={group.id} className="flex items-center gap-2.5 p-2 hover:bg-slate-50 cursor-pointer">
                                          <input 
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                              const curList = steps[selectedStepIndex].config?.selectedGroups || [];
                                              const nextList = isChecked ? curList.filter(g => g !== group.id) : [...curList, group.id];
                                              updateStepConfig({ selectedGroups: nextList });
                                            }}
                                            className="w-3.5 h-3.5 rounded accent-primary"
                                          />
                                          <span className="text-xs font-bold text-slate-700">{group.name}</span>
                                        </label>
                                      );
                                    })}
                                </div>
                              </>
                            ) : (
                              <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-3.5 text-center">
                                <span className="material-symbols-outlined text-amber-600 text-lg mb-1 block">warning</span>
                                <p className="text-[10px] text-amber-800 font-bold leading-normal">
                                  No eligible groups found.
                                </p>
                                <p className="text-[9px] text-slate-450 font-semibold mt-1 leading-normal">
                                  Please add a "Creator Scope Filter" step first and select targeted users. Only groups containing those users will be listed here.
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                    </div>
                  )}

                  {/* 5. Folder Storage Archiver Config Form */}
                  {steps[selectedStepIndex].type === 'archive_binder' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <label className="text-xs font-bold text-slate-700 cursor-pointer" htmlFor="selectAllBinders">
                          Attach to All Binders
                        </label>
                        <input
                          id="selectAllBinders"
                          type="checkbox"
                          checked={steps[selectedStepIndex].config?.selectAll || false}
                          onChange={(e) => updateStepConfig({ selectAll: e.target.checked })}
                          className="w-4 h-4 text-primary rounded outline-none accent-primary cursor-pointer"
                        />
                      </div>

                      {!steps[selectedStepIndex].config?.selectAll && (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase">
                            Select target Cabinet Binders
                          </label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-2 top-2 text-slate-400 text-sm">search</span>
                            <input 
                              type="text" 
                              value={binderSearchTerm}
                              onChange={(e) => setBinderSearchTerm(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs outline-none focus:bg-white"
                              placeholder="Filter binders..."
                            />
                          </div>

                          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <input 
                              id="selectAllBindersCheck"
                              type="checkbox"
                              checked={getBindersList().length > 0 && (steps[selectedStepIndex].config?.selectedBinders || []).length === getBindersList().length}
                              onChange={(e) => {
                                updateStepConfig({
                                  selectedBinders: e.target.checked ? getBindersList().map(b => b.name) : []
                                });
                              }}
                              className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                            />
                            <label htmlFor="selectAllBindersCheck" className="text-[10px] font-bold text-slate-500 cursor-pointer">
                              Select All/Deselect All
                            </label>
                          </div>

                          <div className="flex flex-col border border-slate-200 rounded-xl max-h-[220px] overflow-y-auto divide-y divide-slate-100">
                            {getBindersList()
                              .filter(b => b.name.toLowerCase().includes(binderSearchTerm.toLowerCase()))
                              .map(binder => {
                                const isChecked = (steps[selectedStepIndex].config?.selectedBinders || []).includes(binder.name);
                                return (
                                  <label key={binder.name} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        const curList = steps[selectedStepIndex].config?.selectedBinders || [];
                                        const nextList = isChecked ? curList.filter(b => b !== binder.name) : [...curList, binder.name];
                                        updateStepConfig({ selectedBinders: nextList });
                                      }}
                                      className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                                    />
                                    <div>
                                      <p className="text-xs font-bold text-slate-700 leading-none">{binder.name}</p>
                                      <p className="text-[9px] text-slate-450 mt-0.5 uppercase tracking-wider font-semibold">Binder folder</p>
                                    </div>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-slate-400 py-12">
                  <span className="material-symbols-outlined text-3xl mb-2 text-slate-350">tune</span>
                  <p className="text-xs font-bold">Select a workflow step in the pipeline to edit its parameters.</p>
                </div>
              )}

            </div>

          </div>

        </div>
      )}
      
      {/* Rule Execution History Modal */}
      {historyRule && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-fadeIn">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col w-full max-w-4xl h-[75vh] border border-slate-200 animate-scaleUp text-left"
          >
            {/* Header */}
            <div className="bg-slate-100 dark:bg-slate-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-2xl font-bold">history</span>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white leading-none">Execution History: {historyRule.name}</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Rule ID: {historyRule.id} • Dynamic Run Log</p>
                </div>
              </div>
              <button 
                onClick={() => setHistoryRule(null)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg font-bold">close</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-grow p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex flex-col gap-4">
              {(() => {
                const ruleTasks = (state.routingTasks || []).filter(t => t.ruleId === historyRule.id);
                if (ruleTasks.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
                      <span className="material-symbols-outlined text-4xl mb-2 text-slate-350">history_toggle_off</span>
                      <p className="text-xs font-bold text-slate-700">No execution logs found for this automation rule.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Logs will appear here once a document triggers this rule.</p>
                    </div>
                  );
                }

                return ruleTasks.map((task) => (
                  <div key={task.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    {/* Task Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800">Doc: {task.document.title}</span>
                          <span className="text-[10px] font-mono bg-slate-100 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold">{task.document.id}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 font-semibold">Type: {task.document.type} • Triggered by: @{task.document.createdBy}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-slate-450">{task.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          task.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                          task.status === 'Failed' ? 'bg-red-100 text-red-800' :
                          task.status === 'Waiting_Approval' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {task.status === 'Waiting_Approval' ? 'Waiting Approval' : task.status}
                        </span>
                      </div>
                    </div>

                    {/* Step Timeline */}
                    <div className="space-y-4 relative pl-5 border-l-2 border-slate-200 ml-2">
                      {task.history.map((hist, idx) => (
                        <div key={idx} className="relative text-left">
                          {/* Dot marker */}
                          <span className={`absolute -left-[26px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${
                            hist.status === 'Success' ? 'bg-emerald-500' :
                            hist.status === 'Failed' ? 'bg-red-500' :
                            hist.status === 'Waiting' ? 'bg-amber-500' : 'bg-blue-500'
                          }`} />
                          
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-700">{hist.stepName}</span>
                              <span className="text-[9px] text-slate-400">{hist.timestamp}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">{hist.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
