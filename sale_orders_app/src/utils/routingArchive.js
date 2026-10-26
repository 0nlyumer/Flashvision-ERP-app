// Routing archive-step filing helpers (Files fix, 2026-10-26).
//
// Background: on 2026-10-26 the live check caught the routing engine
// recording "Saved and attached document inside selected binders: X" for
// leave LVR-1792956775880 while the document never persisted in the
// binder. The step's success was decided purely by an in-memory push into
// a deep-copied binder list inside the engine's setState updater — no
// code verified, after the state commit or the table write-through, that
// the document was actually in the binder, so a competing write that
// restored the pre-filing binder list discarded the filing silently and
// the success entry stood as fact.
//
// These pure helpers are the single implementation of (a) filing a
// document into the binders an archive step targets and (b) verifying
// claimed filings against the committed binder state. AppContext uses
// them in the engine and in the reconciliation effect; the regression
// smoke (scripts/smoke-routing-archive-filing.mjs) tests these exact
// functions.

export const ARCHIVE_SUCCESS_PREFIX = 'Saved and attached document inside selected binders';

// The filed-document record stored inside a binder. One builder for the
// engine and the reconciliation path so a recovered filing is identical
// to an original one.
export function buildArchiveEntry(task, docType, studioRecord, filedAt = new Date().toISOString()) {
  return {
    id: task.document.id,
    title: task.document.title,
    date: new Date().toLocaleDateString(),
    filedAt,
    docType,
    docId: task.document.id,
    studioRecord,
    details: [
      { label: 'Document ID', value: task.document.id },
      { label: 'Document Type', value: task.document.type },
      { label: 'Creator Entity', value: task.document.createdBy },
      { label: 'Status', value: 'Archived via Routing' },
      { label: 'Workflow Rule', value: task.ruleName }
    ]
  };
}

// A binder is targeted when the step attaches to all binders, or the
// step's selection carries the binder's ID (new rules) or NAME (legacy).
export function binderMatchesStep(binder, step) {
  const cfg = step?.config || {};
  if (cfg.selectAll) return true;
  const sel = cfg.selectedBinders || [];
  return sel.includes(binder.id) || sel.includes(binder.name);
}

export function binderAlreadyHasDoc(binder, docId) {
  return Array.isArray(binder?.documents)
    && binder.documents.some(d => (d.docId || d.id) === docId);
}

// Push the entry into every binder the step targets. Mutates the binder
// objects passed in (callers pass copies they own). Idempotent: a binder
// that already holds the document counts as filed and is never given a
// duplicate. Returns the names/ids of the binders the document is
// verifiably in afterwards — an empty result means NOT filed.
export function applyFilingToBinders(binders, step, entry) {
  const filedNames = [];
  const filedIds = [];
  if (!Array.isArray(binders)) return { filedNames, filedIds };
  binders.forEach(binder => {
    if (!binderMatchesStep(binder, step)) return;
    if (!Array.isArray(binder.documents)) binder.documents = [];
    if (!binderAlreadyHasDoc(binder, entry.docId)) {
      binder.documents.push(entry);
    }
    filedNames.push(binder.name);
    filedIds.push(binder.id);
  });
  return { filedNames, filedIds };
}

// Every archive filing a task's history CLAIMS succeeded (the original
// "Saved and attached…" success entries — recovery annotations use a
// different prefix and are not claims).
export function getClaimedArchiveFilings(task) {
  const claims = [];
  (task?.history || []).forEach(h => {
    if (h?.status === 'Success' && typeof h.message === 'string' && h.message.startsWith(ARCHIVE_SUCCESS_PREFIX)) {
      const step = (task.steps || []).find(s => s.id === h.stepId);
      if (step && step.type === 'archive_binder') {
        claims.push({ taskId: task.id, stepId: step.id, docId: task.document?.id, step });
      }
    }
  });
  return claims;
}

// Claimed filings whose document is NOT in any still-existing target
// binder — the lost-filing shape. If every target binder has since been
// deleted, the filing is unverifiable and deliberately skipped: the
// documents went away with the binder, on purpose.
export function findUnverifiedFilings(tasks, binders) {
  const missing = [];
  if (!Array.isArray(tasks) || !Array.isArray(binders)) return missing;
  tasks.forEach(task => {
    getClaimedArchiveFilings(task).forEach(claim => {
      if (!claim.docId) return;
      const targets = binders.filter(b => binderMatchesStep(b, claim.step));
      if (targets.length === 0) return;
      const present = targets.some(b => binderAlreadyHasDoc(b, claim.docId));
      if (!present) {
        missing.push({
          taskId: task.id,
          stepId: claim.stepId,
          docId: claim.docId,
          targetBinderIds: targets.map(b => b.id)
        });
      }
    });
  });
  return missing;
}

// File an entry into specific binders by id (reconciliation path).
// Idempotent, same contract as applyFilingToBinders.
export function fileEntryIntoBindersById(binders, binderIds, entry) {
  const filedNames = [];
  const filedIds = [];
  if (!Array.isArray(binders)) return { filedNames, filedIds };
  binders.forEach(binder => {
    if (!binderIds.includes(binder.id)) return;
    if (!Array.isArray(binder.documents)) binder.documents = [];
    if (!binderAlreadyHasDoc(binder, entry.docId)) {
      binder.documents.push(entry);
    }
    filedNames.push(binder.name);
    filedIds.push(binder.id);
  });
  return { filedNames, filedIds };
}
