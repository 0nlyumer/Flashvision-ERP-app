// Smoke test — Routing + E-Files repair (2026-10-23).
//
// Part 1: approval-ID matching logic for all four sites, using the exact
// expressions now in the source:
//   - AppContext executeNextSteps (engine id build + dedupe find)
//   - AppContext approval watcher (find by suffixed OR legacy id)
//   - DocumentRoutingCenter handleSimulateApprovalAction (update match)
//   - ChatModule getDocumentRecord (matchKey strip + task includes lookup)
//
// Part 2: LIVE write-through proof for defect A — runs the REAL
// syncEntityDiffToTable from src/utils/entityTables.js against the live
// routing_rules / routing_tasks tables: a probe rule + probe task must be
// inserted (with the dedicated NOT NULL columns populated), then removed
// again by a second diff, leaving the tables exactly at their baseline.
//
// Run: node scripts/smoke-routing-efiles.mjs   (exit 0 = all pass)

// The app sources use Vite-style extensionless relative imports; register a
// resolve hook that retries with '.js' so plain Node can load them.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); } catch (e) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.(js|mjs|json)$/.test(specifier)) {
      return next(specifier + '.js', context);
    }
    throw e;
  }
}`));

const { fetchEntityTable, syncEntityDiffToTable, recordKeyWithFallback } = await import('../src/utils/entityTables.js');
const { supabase } = await import('../src/utils/supabaseClient.js');

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
};

// ---------------------------------------------------------------- Part 1
console.log('Part 1 — approval-ID matching');

// Verbatim expressions from the four sites:
const engineApprovalId = (task) => `APP-RT-${task.id.split('-')[1]}-s${task.currentStepIndex}`;
const legacyApprovalId = (task) => `APP-RT-${task.id.split('-')[1]}`;
const watcherFind = (approvals, task) =>
  approvals.find(a => a.id === engineApprovalId(task) || a.id === legacyApprovalId(task));
const dedupeFind = watcherFind; // executeNextSteps uses the same find
const simulatorApply = (approvals, tasks, taskId, status) => {
  const task = tasks.find(t => t.id === taskId);
  const taskTs = taskId.split('-')[1];
  const suffixedId = task ? `APP-RT-${taskTs}-s${task.currentStepIndex}` : null;
  const legacyId = `APP-RT-${taskTs}`;
  return approvals.map(a => (a.id === suffixedId || a.id === legacyId)
    ? { ...a, status, completedAt: new Date().toISOString(), reasonComment: 'Simulated review action.' }
    : a);
};
const chatFindTask = (tasks, approvalId) => {
  const matchKey = approvalId.replace('APP-RT-', '').replace(/-s\d+$/, '');
  return tasks.find(t => t.id.includes(matchKey));
};

const newTask = { id: 'TASK-1792769391146-8690', currentStepIndex: 2, status: 'Waiting_Approval' };
const newApproval = { id: 'APP-RT-1792769391146-s2', status: 'Pending' };
const legacyTask1 = { id: 'TASK-1784266440257-7463', currentStepIndex: 2, status: 'Waiting_Approval' };
const legacyTask2 = { id: 'TASK-1784268385944-9869', currentStepIndex: 2, status: 'Waiting_Approval' };
const legacyApproval1 = { id: 'APP-RT-1784266440257', status: 'Pending' };
const legacyApproval2 = { id: 'APP-RT-1784268385944', status: 'Pending' };
const allTasks = [newTask, legacyTask1, legacyTask2];
const allApprovals = [newApproval, legacyApproval1, legacyApproval2];

check('engine builds suffixed id for new task', engineApprovalId(newTask) === 'APP-RT-1792769391146-s2');
check('watcher finds suffixed approval', watcherFind(allApprovals, newTask)?.id === newApproval.id);
check('watcher finds LEGACY approval for stuck task 1', watcherFind(allApprovals, legacyTask1)?.id === legacyApproval1.id);
check('watcher finds LEGACY approval for stuck task 2', watcherFind(allApprovals, legacyTask2)?.id === legacyApproval2.id);
check('dedupe reuses suffixed approval (no duplicate)', dedupeFind(allApprovals, newTask)?.id === newApproval.id);
check('dedupe reuses LEGACY approval (no duplicate)', dedupeFind(allApprovals, legacyTask1)?.id === legacyApproval1.id);
check('watcher does not cross-match other tasks', watcherFind(allApprovals, { id: 'TASK-1111111111111-0000', currentStepIndex: 2 }) === undefined);

const simNew = simulatorApply(allApprovals, allTasks, newTask.id, 'Approved');
check('simulator updates suffixed approval', simNew.find(a => a.id === newApproval.id)?.status === 'Approved');
check('simulator leaves other approvals untouched', simNew.find(a => a.id === legacyApproval1.id)?.status === 'Pending');
const simLegacy = simulatorApply(allApprovals, allTasks, legacyTask1.id, 'Rejected');
check('simulator updates LEGACY approval', simLegacy.find(a => a.id === legacyApproval1.id)?.status === 'Rejected');

check('ChatModule resolves task from suffixed approval', chatFindTask(allTasks, newApproval.id)?.id === newTask.id);
check('ChatModule resolves task from LEGACY approval', chatFindTask(allTasks, legacyApproval1.id)?.id === legacyTask1.id);
check('ChatModule matchKey strip leaves legacy key intact', 'APP-RT-1784266440257'.replace('APP-RT-', '').replace(/-s\d+$/, '') === '1784266440257');

// ---------------------------------------------------------------- Part 2
console.log('Part 2 — live routing write-through (defect A)');

const seedSnapshot = (stateKey, records) => {
  const snap = new Map(); const seen = new Map();
  (records || []).forEach(rec => {
    const k = recordKeyWithFallback(stateKey, rec, seen);
    if (k !== null) snap.set(k, JSON.stringify(rec));
  });
  return snap;
};

const baseRules = await fetchEntityTable('routing_rules');
const baseTasks = await fetchEntityTable('routing_tasks');
check('baseline rules fetched (2)', Array.isArray(baseRules) && baseRules.length === 2);
check('baseline tasks fetched (4)', Array.isArray(baseTasks) && baseTasks.length === 4);

const probeRule = {
  id: 'RUL-PROBE-SMOKE', name: 'ZZ PROBE RULE', status: 'Active',
  steps: [{ id: 'step-1', name: 'Creator Scope Filter', type: 'audience_selector', config: { selectAll: false, selectedUsers: ['only.umer'] } }],
  folders: [], trigger: 'Sales Order', targetUsers: ['only.umer'], lastExecuted: 'Never',
};
const probeTask = {
  id: 'TASK-9999999999999-0001', ruleId: 'RUL-PROBE-SMOKE', ruleName: 'ZZ PROBE RULE',
  document: { id: 'DOC-SMOKE-1', type: 'Sales Order', title: 'Smoke Doc', createdBy: 'only.umer' },
  currentStepIndex: 2, status: 'Waiting_Approval',
  steps: [
    { id: 'step-1', name: 'Creator Scope Filter', type: 'audience_selector', config: {} },
    { id: 'step-2', name: 'Trigger Event Scope', type: 'document_trigger', config: {} },
    { id: 'step-3', name: 'Conditional Approval Gate', type: 'approval_gate', config: { approvalUser: 'only.umer' } },
  ],
  history: [{ stepId: 'init', stepName: 'Trigger Automation', status: 'Success', timestamp: 'smoke', message: 'smoke' }],
};

const ruleSnap = seedSnapshot('routingRules', baseRules);
const taskSnap = seedSnapshot('routingTasks', baseTasks);

try {
  await syncEntityDiffToTable('routingRules', [...baseRules, probeRule], ruleSnap);
  await syncEntityDiffToTable('routingTasks', [...baseTasks, probeTask], taskSnap);

  const { data: ruleRow } = await supabase.from('routing_rules').select('id, rule_name, status, steps').eq('id', probeRule.id).maybeSingle();
  check('probe rule INSERTED into routing_rules', !!ruleRow);
  check('probe rule rule_name populated from record.name', ruleRow?.rule_name === 'ZZ PROBE RULE');
  check('probe rule steps populated (NOT NULL)', Array.isArray(ruleRow?.steps) && ruleRow.steps.length === 1);

  const { data: taskRow } = await supabase.from('routing_tasks').select('id, rule_id, rule_name, document, current_step_index, status, steps, history').eq('id', probeTask.id).maybeSingle();
  check('probe task INSERTED into routing_tasks', !!taskRow);
  check('probe task document populated (NOT NULL)', taskRow?.document?.id === 'DOC-SMOKE-1');
  check('probe task steps populated (NOT NULL)', Array.isArray(taskRow?.steps) && taskRow.steps.length === 3);
  check('probe task history populated (NOT NULL)', Array.isArray(taskRow?.history) && taskRow.history.length === 1);
  check('probe task rule_id/rule_name/csi/status promoted', taskRow?.rule_id === 'RUL-PROBE-SMOKE' && taskRow?.rule_name === 'ZZ PROBE RULE' && taskRow?.current_step_index === 2 && taskRow?.status === 'Waiting_Approval');

  // Update path: change the probe records and diff again
  const probeRule2 = { ...probeRule, name: 'ZZ PROBE RULE v2' };
  const probeTask2 = { ...probeTask, status: 'Completed', currentStepIndex: 3 };
  await syncEntityDiffToTable('routingRules', [...baseRules, probeRule2], ruleSnap);
  await syncEntityDiffToTable('routingTasks', [...baseTasks, probeTask2], taskSnap);
  const { data: ruleRow2 } = await supabase.from('routing_rules').select('rule_name').eq('id', probeRule.id).maybeSingle();
  const { data: taskRow2 } = await supabase.from('routing_tasks').select('status, current_step_index').eq('id', probeTask.id).maybeSingle();
  check('probe rule UPDATE flows through', ruleRow2?.rule_name === 'ZZ PROBE RULE v2');
  check('probe task UPDATE flows through (status/csi)', taskRow2?.status === 'Completed' && taskRow2?.current_step_index === 3);
} finally {
  // Cleanup: diff back to baseline (deletes the probes), with a direct
  // REST delete as a belt-and-braces fallback.
  await syncEntityDiffToTable('routingRules', baseRules, ruleSnap);
  await syncEntityDiffToTable('routingTasks', baseTasks, taskSnap);
  await supabase.from('routing_rules').delete().eq('id', probeRule.id);
  await supabase.from('routing_tasks').delete().eq('id', probeTask.id);
}

const afterRules = await fetchEntityTable('routing_rules');
const afterTasks = await fetchEntityTable('routing_tasks');
check('cleanup: rules back to baseline ids', JSON.stringify((afterRules || []).map(r => r.id).sort()) === JSON.stringify(['RUL-15E-633', 'RUL-21S-831']));
check('cleanup: tasks back to baseline ids', JSON.stringify((afterTasks || []).map(t => t.id).sort()) === JSON.stringify(['TASK-1784266440257-7463', 'TASK-1784268385944-9869', 'TASK-1791532413569-8461', 'TASK-1784270059398-1635'].sort()));

console.log(`\nSMOKE RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
