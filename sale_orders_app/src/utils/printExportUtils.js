import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * High-definition PDF Export Engine (using jsPDF + html2canvas)
 * Renders multi-page documents seamlessly.
 */
export async function exportDocumentToPdf(elementOrSelector, filename = 'document.pdf', options = {}) {
  try {
    const rootEl = typeof elementOrSelector === 'string'
      ? document.querySelector(elementOrSelector)
      : elementOrSelector;

    if (!rootEl) {
      console.error('exportDocumentToPdf: Element not found', elementOrSelector);
      return false;
    }

    const pages = rootEl.querySelectorAll('.print-preview-page');
    const paperSize = (options.paperSize || 'a4').toLowerCase();
    const orientation = (options.orientation || 'portrait').toLowerCase();

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: paperSize === 'thermal' ? [80, 200] : paperSize
    });

    if (pages.length > 0) {
      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
    } else {
      const canvas = await html2canvas(rootEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }

    pdf.save(filename);
    return true;
  } catch (err) {
    console.error('Failed to export PDF:', err);
    return false;
  }
}

/**
 * Ultra High-Resolution Image Export Engine (PNG 2.5x scale)
 */
export async function exportDocumentToImage(elementOrSelector, filename = 'document.png') {
  try {
    const rootEl = typeof elementOrSelector === 'string'
      ? document.querySelector(elementOrSelector)
      : elementOrSelector;

    if (!rootEl) {
      console.error('exportDocumentToImage: Element not found', elementOrSelector);
      return false;
    }

    // Target the first page or the root container
    const targetEl = rootEl.querySelector('.print-preview-page') || rootEl;

    const canvas = await html2canvas(targetEl, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return true;
  } catch (err) {
    console.error('Failed to export Image:', err);
    return false;
  }
}

/**
 * PDF Blob builder — same rendering as exportDocumentToPdf but returns a
 * Blob (used by the Telegram SEND flow in print popups, 2026-10-24).
 */
export async function buildDocumentPdfBlob(elementOrSelector, options = {}) {
  const rootEl = typeof elementOrSelector === 'string'
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
  if (!rootEl) return null;

  const pages = rootEl.querySelectorAll('.print-preview-page');
  const paperSize = (options.paperSize || 'a4').toLowerCase();
  const orientation = (options.orientation || 'portrait').toLowerCase();

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: paperSize === 'thermal' ? [80, 200] : paperSize
  });

  if (pages.length > 0) {
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }
  } else {
    const canvas = await html2canvas(rootEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  }

  return pdf.output('blob');
}

/**
 * High-quality PNG Blob builder — renders at 3x scale by default
 * (~300 dpi equivalent for A4) so the image stays crisp when zoomed,
 * as required for the Telegram SEND flow (Omer, 2026-10-24).
 * Multi-page documents are stacked vertically into one tall image.
 */
export async function buildDocumentPngBlob(elementOrSelector, scale = 3) {
  const rootEl = typeof elementOrSelector === 'string'
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
  if (!rootEl) return null;

  const pages = rootEl.querySelectorAll('.print-preview-page');
  const targets = pages.length > 0 ? [...pages] : [rootEl];

  const canvases = [];
  for (const el of targets) {
    canvases.push(await html2canvas(el, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    }));
  }
  if (canvases.length === 1) {
    return new Promise((resolve) => canvases[0].toBlob(resolve, 'image/png'));
  }
  const width = Math.max(...canvases.map((c) => c.width));
  const height = canvases.reduce((acc, c) => acc + c.height, 0);
  const merged = document.createElement('canvas');
  merged.width = width;
  merged.height = height;
  const ctx = merged.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  canvases.forEach((c) => { ctx.drawImage(c, 0, y); y += c.height; });
  return new Promise((resolve) => merged.toBlob(resolve, 'image/png'));
}

/**
 * CSV Blob builder (same content as exportDocumentToCsv, as a Blob for
 * the Telegram SEND flow).
 */
export function buildCsvBlob(columns = [], rows = []) {
  const activeCols = columns.filter((c) => c.enabled !== false);
  if (activeCols.length === 0 || rows.length === 0) return null;
  const headerLine = activeCols.map((c) => `"${(c.label || c.key).replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map((row, idx) => {
    return activeCols
      .map((c) => {
        let val = row[c.key];
        if (val === undefined || val === null) {
          if (c.key === 'serial_no' || c.key === 'sr' || c.key === 'sr_no') val = idx + 1;
          else val = '';
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(',');
  });
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Universal CSV Export Engine for Line Items & Data Grids
 */
export function exportDocumentToCsv(columns = [], rows = [], filename = 'document.csv') {
  try {
    const activeCols = columns.filter((c) => c.enabled !== false);
    if (activeCols.length === 0 || rows.length === 0) {
      console.warn('exportDocumentToCsv: No active columns or rows');
      return false;
    }

    const headerLine = activeCols.map((c) => `"${(c.label || c.key).replace(/"/g, '""')}"`).join(',');
    const rowLines = rows.map((row, idx) => {
      return activeCols
        .map((c) => {
          let val = row[c.key];
          if (val === undefined || val === null) {
            if (c.key === 'serial_no' || c.key === 'sr') val = idx + 1;
            else val = '';
          }
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',');
    });

    const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed to export CSV:', err);
    return false;
  }
}
