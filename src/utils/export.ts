import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

/**
 * CSV and Report export utilities & Bulletproof Client-Side PDF Generation
 */

export function exportToCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows || !rows.length) {
    console.warn('No data available to export.');
    return;
  }
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(header => {
          let val = row[header];
          if (val === null || val === undefined) val = '';
          const strVal = String(val).replace(/"/g, '""');
          return `"${strVal}"`;
        })
        .join(',')
    ),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Shows a temporary floating notification banner for printing status or sandbox notes
 */
export function showPrintNotification(message: string, type: 'info' | 'warn' | 'success' = 'info') {
  if (typeof document === 'undefined') return;

  const existingNotification = document.getElementById('__applet_print_toast__');
  if (existingNotification) {
    existingNotification.remove();
  }

  const toast = document.createElement('div');
  toast.id = '__applet_print_toast__';
  toast.className = `fixed bottom-5 right-5 z-[99999] max-w-md p-4 rounded-xl shadow-2xl border text-xs font-medium flex items-start gap-3 transition-all duration-300 no-print ${
    type === 'warn'
      ? 'bg-amber-50 text-amber-900 border-amber-300'
      : type === 'success'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
      : 'bg-slate-900 text-white border-slate-700'
  }`;

  toast.innerHTML = `
    <div class="mt-0.5 shrink-0">
      <svg class="w-4 h-4 ${type === 'warn' ? 'text-amber-600' : type === 'success' ? 'text-emerald-500' : 'text-slate-300'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <div class="flex-1 leading-relaxed">
      ${message}
    </div>
    <button onclick="this.parentElement.remove()" class="text-current opacity-60 hover:opacity-100 p-0.5 ml-2 cursor-pointer font-bold">
      ✕
    </button>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 400);
    }
  }, 6000);
}

/**
 * Standalone HTML document generator for printable records when iframe sandbox blocks direct window.print()
 */
export function downloadPrintableHtml(element: HTMLElement, title: string = 'Charity_Document') {
  try {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
      margin: 0;
      padding: 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print, button, nav, aside { display: none !important; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; }
    th, td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
    th { background: #f8fafc; text-align: left; font-weight: 600; }
    .border-b-2 { border-bottom: 2px solid #0f172a; }
    .font-bold { font-weight: 700; }
    .font-mono { font-family: monospace; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-xs { font-size: 11px; }
    .text-sm { font-size: 13px; }
    .text-lg { font-size: 18px; }
    .text-xl { font-size: 20px; }
    .text-2xl { font-size: 24px; }
    .text-emerald-700 { color: #047857; }
    .text-slate-500 { color: #64748b; }
    .text-slate-900 { color: #0f172a; }
    .bg-slate-50 { background-color: #f8fafc; }
    .bg-emerald-50 { background-color: #ecfdf5; }
    .rounded-lg { border-radius: 8px; }
    .rounded-xl { border-radius: 12px; }
    .p-4 { padding: 16px; }
    .p-6 { padding: 24px; }
    .p-8 { padding: 32px; }
    .mt-4 { margin-top: 16px; }
    .mb-4 { margin-bottom: 16px; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .gap-4 { gap: 16px; }
    .document-watermark-container, .printable-content, .printable-area { position: relative !important; }
    .document-watermark {
      position: absolute !important;
      inset: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      pointer-events: none !important;
      user-select: none !important;
      z-index: 0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .document-watermark img {
      display: block !important;
      max-width: 44% !important;
      object-fit: contain !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 300);
    });
  </script>
</head>
<body>
  ${element.outerHTML}
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Printable.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to download printable HTML:', err);
  }
}

/**
 * Client-Side PDF Generation Engine using jsPDF & html2canvas
 * Generates crisp A4 PDF documents with professional organization header, exact currency symbols, tables, and signatures.
 */
export async function exportElementToPdf(
  targetOrEvent?: string | HTMLElement | unknown,
  fileName: string = 'Document.pdf',
  options?: {
    orientation?: 'portrait' | 'landscape';
    title?: string;
  }
): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Safely resolve target element
  let targetElement: HTMLElement | null = null;
  if (typeof targetOrEvent === 'string' && targetOrEvent.trim().length > 0) {
    try {
      targetElement = (
        document.getElementById(targetOrEvent) ||
        document.querySelector(targetOrEvent)
      ) as HTMLElement | null;
    } catch {
      targetElement = null;
    }
  } else if (targetOrEvent instanceof HTMLElement) {
    targetElement = targetOrEvent;
  }

  // Fallback to active modal or printable container
  if (!targetElement) {
    targetElement = (
      document.getElementById('printable-voucher-body') ||
      document.getElementById('printable-receipt') ||
      document.getElementById('printable-payment-voucher') ||
      document.getElementById('printable-transaction-voucher') ||
      document.getElementById('member-ledger-container') ||
      document.getElementById('case-ledger-container') ||
      document.querySelector('.printable-area') ||
      document.querySelector('.printable-content')
    ) as HTMLElement | null;
  }

  if (!targetElement) {
    showPrintNotification('Could not find printable content to export to PDF.', 'warn');
    return;
  }

  // 2. Prepare clean file name
  let cleanName = fileName.trim();
  if (!cleanName.toLowerCase().endsWith('.pdf')) {
    cleanName = `${cleanName}.pdf`;
  }
  cleanName = cleanName.replace(/[/\\?%*:|"<>]/g, '_');

  showPrintNotification('Generating PDF document, please wait a moment...', 'info');

  try {
    // 3. Render element to high-res canvas (scale: 2 for sharp vector-like text)
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: targetElement.scrollWidth || 1100,
      onclone: (_clonedDoc, clonedElement) => {
        // Ensure clean white printable canvas without shadows or clipping
        clonedElement.style.backgroundColor = '#ffffff';
        clonedElement.style.overflow = 'visible';
        clonedElement.style.maxHeight = 'none';
        clonedElement.style.height = 'auto';
        clonedElement.style.boxShadow = 'none';

        // Expand any inner scroll containers
        const scrollables = clonedElement.querySelectorAll('*');
        scrollables.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style) {
            const overflow = htmlEl.style.overflow || '';
            const overflowY = htmlEl.style.overflowY || '';
            if (overflow.includes('auto') || overflow.includes('scroll') || overflowY.includes('auto') || overflowY.includes('scroll')) {
              htmlEl.style.overflow = 'visible';
              htmlEl.style.overflowY = 'visible';
            }
          }
        });
      },
      ignoreElements: (el) => {
        return (
          el.classList.contains('no-print') ||
          el.classList.contains('no-pdf') ||
          el.getAttribute('data-no-print') === 'true'
        );
      },
    });

    const isLandscape =
      options?.orientation === 'landscape' ||
      (options?.orientation !== 'portrait' && canvas.width > canvas.height * 1.25);

    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = isLandscape ? 297 : 210;
    const pdfHeight = isLandscape ? 210 : 297;
    const margin = 8; // 8mm margin
    const contentWidth = pdfWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;
    const usableHeight = pdfHeight - margin * 2;

    const imgData = canvas.toDataURL('image/png', 0.95);

    if (contentHeight <= usableHeight) {
      // Single page document (Receipts, Vouchers, Statements)
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
    } else {
      // Multi-page document (Full Registers, Multi-month Ledgers)
      let heightLeft = contentHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
      heightLeft -= usableHeight;

      while (heightLeft > 0) {
        position = position - usableHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
        heightLeft -= usableHeight;
      }
    }

    pdf.save(cleanName);
    showPrintNotification(`Downloaded PDF: ${cleanName}`, 'success');
  } catch (err) {
    console.error('PDF generation error:', err);
    // If canvas generation fails, fallback to jsPDF direct generation - NEVER download HTML when PDF is requested!
    try {
      const fallbackPdf = new jsPDF({
        orientation: options?.orientation || 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      fallbackPdf.setFontSize(16);
      fallbackPdf.text(options?.title || cleanName.replace('.pdf', ''), 14, 20);
      fallbackPdf.setFontSize(10);
      fallbackPdf.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 28);

      const rawText = targetElement.innerText || targetElement.textContent || '';
      const lines = fallbackPdf.splitTextToSize(rawText.trim(), 180);
      fallbackPdf.text(lines, 14, 38);
      fallbackPdf.save(cleanName);
      showPrintNotification(`Downloaded PDF: ${cleanName}`, 'success');
    } catch (fallbackErr) {
      console.error('Fallback PDF generation failed:', fallbackErr);
      showPrintNotification('Could not generate PDF document. Please try again.', 'warn');
    }
  }
}

/**
 * Backward-compatible trigger that routes directly to client-side PDF generation
 */
export function triggerPrint(
  targetOrEvent?: string | HTMLElement | unknown,
  documentTitle?: string
) {
  const docName = documentTitle ? `${documentTitle}.pdf` : 'Charity_Document.pdf';
  exportElementToPdf(targetOrEvent, docName);
}
