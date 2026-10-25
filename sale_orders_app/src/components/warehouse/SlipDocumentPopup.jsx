import React, { useMemo } from 'react';
import PrintLayout from '../ui/PrintLayout';
import { DEFAULT_DOCUMENT_SCHEMAS, SYSTEM_DOCUMENTS } from '../../utils/printSchemaRegistry';

// SlipDocumentPopup — Files Cabinet viewer popup for the 12 slip-family
// documents (vouchers, HR forms, inventory adjustment / return). These
// documents print through the shared slip renderer (PrintLayout) — the same
// component and the same per-document layout settings the modules' own
// print popups use — so a filed slip re-prints in its current saved design
// while its content stays the frozen filing snapshot.
//
// The body is built generically from the snapshot record: the document
// schema's header fields become the detail grid, an `items` array (when the
// record carries one) becomes the lines table, and long text fields
// (reason / remarks / description) render as note blocks — exactly the
// pieces the module popups show for these document types.

const FIELD_ALIASES = {
  employeeName: ['emp_name', 'employee_name', 'name'],
  employeeId: ['emp_id', 'employee_code', 'code'],
  department: ['dept', 'departmentName'],
  requestDate: ['date', 'createdAt', 'filedAt'],
  date: ['requestDate', 'createdAt'],
  customerName: ['customer', 'partyName'],
  amount: ['totalAmount', 'netAmount', 'total'],
};

const LONG_TEXT_KEYS = ['reason', 'description', 'remarks', 'notes', 'note', 'purpose', 'details_text'];

const resolveFieldValue = (record, key) => {
  if (!record || typeof record !== 'object') return undefined;
  if (record.header && typeof record.header === 'object' && record.header[key] !== undefined) return record.header[key];
  if (record[key] !== undefined) return record[key];
  const aliases = FIELD_ALIASES[key] || [];
  for (const alias of aliases) {
    if (record[alias] !== undefined) return record[alias];
    if (record.header && typeof record.header === 'object' && record.header[alias] !== undefined) return record.header[alias];
  }
  return undefined;
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return '—';
  return String(value);
};

export default function SlipDocumentPopup({ isOpen, onClose, attachment }) {
  const docType = attachment?.docType || null;
  const record = attachment?.studioRecord || null;

  const docName = useMemo(() => {
    const sysDoc = SYSTEM_DOCUMENTS.find((d) => d.id === docType);
    return sysDoc?.name || attachment?.title || 'Document';
  }, [docType, attachment]);

  const { metaFields, itemColumns, longTexts } = useMemo(() => {
    const schema = (docType && DEFAULT_DOCUMENT_SCHEMAS[docType]) || {};
    const fields = [];
    (schema.headerFields || [])
      .filter((f) => f.enabled !== false)
      .forEach((f) => {
        const value = resolveFieldValue(record, f.key);
        if (value !== undefined && value !== null && value !== '' && typeof value !== 'object') {
          fields.push({ label: f.label || f.key, value: formatValue(value) });
        }
      });
    const columns = (schema.gridColumns || []).filter((c) => c.enabled !== false);
    const texts = [];
    LONG_TEXT_KEYS.forEach((key) => {
      const value = resolveFieldValue(record, key);
      if (typeof value === 'string' && value.trim()) {
        texts.push({ label: key.charAt(0).toUpperCase() + key.slice(1), value });
      }
    });
    return { metaFields: fields, itemColumns: columns, longTexts: texts };
  }, [docType, record]);

  if (!isOpen || !attachment) return null;

  const items = Array.isArray(record?.items) ? record.items : [];
  const filedDate = attachment.filedAt
    ? new Date(attachment.filedAt).toLocaleDateString('en-GB')
    : (attachment.date || '');

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-scaleIn">
        <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-indigo-600 dark:text-indigo-400">print</span>
            <span className="font-bold text-sm">{docName} — Filed Print</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">print</span>
              Print Document
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-900/10 dark:hover:bg-white/10 text-slate-500 dark:text-white/80 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-6 sm:p-10 bg-slate-100">
          <PrintLayout
            documentTitle={docName.toUpperCase()}
            documentId={attachment.docId || attachment.id}
            date={filedDate}
            documentType={docType}
            customerName={formatValue(resolveFieldValue(record, 'customerName') ?? resolveFieldValue(record, 'employeeName'))}
            extraMeta={metaFields.slice(0, 4)}
          >
            {metaFields.length > 0 && (
              <div className="my-6 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                {metaFields.map((f, idx) => (
                  <div key={idx} className="border-b border-dashed border-slate-300 pb-1.5">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{f.label}</div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">{f.value}</div>
                  </div>
                ))}
              </div>
            )}

            {longTexts.map((t, idx) => (
              <div key={idx} className="my-4 border border-slate-300 rounded-lg p-4 bg-white">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">{t.label}</h4>
                <p className="text-sm text-slate-900 leading-relaxed font-medium">{t.value}</p>
              </div>
            ))}

            {items.length > 0 && (
              <table className="w-full border-collapse border border-slate-300 text-xs my-4">
                <thead>
                  <tr className="bg-slate-800 text-white font-bold">
                    <th className="border border-slate-300 p-2 text-center">Sr #</th>
                    {(itemColumns.length ? itemColumns : [{ key: 'name', label: 'Description' }, { key: 'qty', label: 'Qty' }, { key: 'rate', label: 'Rate' }, { key: 'amount', label: 'Amount' }]).map((col) => (
                      <th key={col.key} className="border border-slate-300 p-2 text-left">{col.label || col.key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                      {(itemColumns.length ? itemColumns : [{ key: 'name' }, { key: 'qty' }, { key: 'rate' }, { key: 'amount' }]).map((col) => (
                        <td key={col.key} className="border border-slate-300 p-2">
                          {formatValue(item?.[col.key] ?? item?.[col.field])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {metaFields.length === 0 && longTexts.length === 0 && items.length === 0 && (
              <div className="my-6 text-center text-xs font-semibold text-slate-500">
                This filed document carries no printable detail snapshot — its registry details are shown in the cabinet book view.
              </div>
            )}
          </PrintLayout>
        </div>
      </div>
    </div>
  );
}
