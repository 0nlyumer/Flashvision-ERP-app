import React, { useMemo } from 'react';
import SlipDocumentPopup from '../warehouse/SlipDocumentPopup';

// HRRequestPrintPopup — the shared print popup for the four HR request
// forms (Leave / Overtime / Loan / Advance), finalized 2026-10-26 on
// Omer's order. It renders through the SAME SlipDocumentPopup the Files
// Cabinet viewer uses for filed slips, fed with a studio-shaped record
// built by src/utils/hrPrintRecords.js — so the in-module print and the
// filed print are one document, in the design Print Settings governs for
// that document type (PrintLayout slip header).
//
// `record` must be a builder output (header/items/totals + long texts).
export default function HRRequestPrintPopup({ isOpen, onClose, docType, record, sourceRecord }) {
  const attachment = useMemo(() => {
    if (!isOpen || !record) return null;
    return {
      docType,
      docId: sourceRecord?.id || record?.header?.leave_id || record?.header?.request_id || record?.header?.ot_id || '',
      studioRecord: record,
      filedAt: sourceRecord?.createdAt || sourceRecord?.dateApplied || sourceRecord?.date || null,
      viewSource: null // no Live/Filed pill — this is the module's own print
    };
  }, [isOpen, docType, record, sourceRecord]);

  if (!isOpen || !attachment) return null;
  return (
    <SlipDocumentPopup
      isOpen={isOpen}
      onClose={onClose}
      attachment={attachment}
      titleSuffix="Print"
    />
  );
}
