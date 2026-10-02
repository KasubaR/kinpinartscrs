import { defaults } from './business';
import { logoImage, borderImage } from './document-branding';

type DocumentRecord = Record<string, any>;
let fontFiles: Promise<string[]> | undefined;
function loadPdfFonts() {
  fontFiles ??= Promise.all(['Regular', 'Bold'].map(async weight => {
    const response = await fetch(`/fonts/Poppins-${weight}.ttf`);
    if (!response.ok) throw new Error('Could not load the PDF font. Please try again.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  })).catch(error => { fontFiles = undefined; throw error; });
  return fontFiles;
}

export function documentTotals(document: DocumentRecord) {
  const sub = (document.items || []).reduce((sum: number, item: DocumentRecord) => sum + Math.round(item.qty * item.price * 100) / 100, 0);
  const discount = Math.round(sub * (document.discount || 0)) / 100;
  const tax = Math.round((sub - discount) * (document.tax || 0)) / 100;
  return { sub, discount, tax, total: Math.round((sub - discount + tax) * 100) / 100 };
}

export function documentFilename(document: DocumentRecord) {
  const type = document.kind === 'invoice' ? 'Invoice' : 'Quotation';
  const number = document.docNumber || `${document.kind === 'invoice' ? 'INV' : 'QUO'}-${String(document.id).padStart(5, '0')}`;
  return `${type} - ${number}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-') + '.pdf';
}

export async function createDocumentPdf(document: DocumentRecord, settings: DocumentRecord = defaults) {
  if (!['quote', 'invoice'].includes(document.kind) || !document.items?.length) throw new Error('Choose a saved quotation or invoice to download.');
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const [regularFont, boldFont] = await loadPdfFonts();
  pdf.addFileToVFS('Poppins-Regular.ttf', regularFont);
  pdf.addFont('Poppins-Regular.ttf', 'Poppins', 'normal');
  pdf.addFileToVFS('Poppins-Bold.ttf', boldFont);
  pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold');
  const invoice = document.kind === 'invoice';
  const label = invoice ? 'Invoice' : 'Quotation';
  const number = document.docNumber || `${invoice ? 'INV' : 'QUO'}-${String(document.id).padStart(5, '0')}`;
  const currency = document.currency || settings.currency || defaults.currency;
  const totals = documentTotals(document);
  const money = (value: number) => new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  const detail = (key: string) => String(document[key] ?? settings[key] ?? (defaults as DocumentRecord)[key] ?? '');
  const ink = [41, 28, 42] as const;
  pdf.setProperties({ title: `${label} ${number}`, author: detail('business'), subject: `${label} for ${document.customerName || ''}` });

  function header(first: boolean) {
    pdf.addImage(logoImage, 'PNG', 15, 16, 54, 26);
    pdf.setTextColor(...ink);
    pdf.setFont('Poppins', 'bold');
    pdf.setFontSize(first ? 32 : 24);
    pdf.text(label, 195, 28, { align: 'right' });
    pdf.setFont('Poppins', 'normal');
    pdf.setFontSize(10);
    pdf.text(`TPIN : ${detail('tpin')}`, 195, 37, { align: 'right' });
    if (!first) pdf.text(`${number} - continued`, 195, 44, { align: 'right' });
  }
  function nextPage() { pdf.addPage(); header(false); return 55; }

  header(true);
  pdf.setFontSize(10);
  pdf.text('Prepared for :', 18, 76);
  pdf.setFont('Poppins', 'bold');
  const customerLines = pdf.splitTextToSize(String(document.customerName || ''), 94);
  pdf.text(customerLines, 18, 83);
  pdf.setFont('Poppins', 'normal');
  const date = new Date(document.date + 'T12:00:00');
  pdf.text(Number.isNaN(date.getTime()) ? String(document.date || '') : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 195, 76, { align: 'right' });
  pdf.text(`${label} Number:`, 195, 83, { align: 'right' });
  pdf.setTextColor(235, 35, 35);
  pdf.setFontSize(9);
  const numberLines: string[] = pdf.splitTextToSize(number, 76);
  pdf.text(numberLines, 195, 89, { align: 'right' });
  pdf.setTextColor(...ink);
  pdf.setFontSize(8);
  const dueY = 89 + numberLines.length * 4.5;
  pdf.text(`${invoice ? 'Due' : 'Valid until'}: ${document.due || ''}`, 195, dueY, { align: 'right' });
  let startY = Math.max(dueY + 10, 87 + customerLines.length * 4.5);
  if (document.customerAddress) {
    const addressLines = pdf.splitTextToSize(String(document.customerAddress), 94);
    pdf.text(addressLines, 18, 85 + customerLines.length * 4.5);
    startY = Math.max(startY, 91 + (customerLines.length + addressLines.length) * 4.5);
  }

  autoTable(pdf, {
    startY,
    margin: { top: 54, right: 15, bottom: 20, left: 15 },
    head: [['Item', 'Description', 'Qty', `Unit price\n(${currency})`, `Total (${currency})`]],
    body: document.items.map((item: DocumentRecord, index: number) => [String(index + 1), `${item.description}${item.details ? '\n' + item.details : ''}`, String(item.qty).padStart(2, '0'), money(item.price), money(Math.round(item.qty * item.price * 100) / 100)]),
    theme: 'plain',
    styles: { font: 'Poppins', fontSize: 9, textColor: [...ink], cellPadding: 3, overflow: 'linebreak', fillColor: [233, 233, 233], valign: 'top' },
    headStyles: { fillColor: [147, 145, 147], textColor: [...ink], fontStyle: 'normal', valign: 'middle' },
    columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 85 }, 2: { cellWidth: 14, halign: 'center' }, 3: { cellWidth: 33, halign: 'right' }, 4: { cellWidth: 33, halign: 'right' } },
    rowPageBreak: 'avoid',
    didDrawPage: (data) => { if (data.pageNumber > 1) header(false); },
  });
  let y = (pdf as any).lastAutoTable.finalY as number;
  if (pdf.getNumberOfPages() === 1 && y < startY + 65) {
    pdf.setFillColor(233, 233, 233);
    pdf.rect(15, y, 180, startY + 65 - y, 'F');
    y = startY + 65;
  }
  pdf.setDrawColor(...ink);
  pdf.setLineWidth(0.3);
  pdf.line(15, y, 195, y);
  const summary: [string, number, boolean][] = [];
  if (invoice || totals.discount > 0 || totals.tax > 0) summary.push(['Sub-Total', totals.sub, false]);
  if (totals.discount > 0) summary.push(['Discount', totals.discount, false]);
  if (totals.tax > 0) summary.push(['Tax', totals.tax, false]);
  summary.push(['Total', totals.total, true]);
  if (invoice && document.paid > 0) summary.push(['Paid', document.paid, false], ['Balance', Math.max(0, totals.total - document.paid), true]);
  if (y + summary.length * 7 > 266) y = nextPage();
  for (const [name, value, bold] of summary) {
    y += 7;
    pdf.setFont('Poppins', bold ? 'bold' : 'normal');
    pdf.setFontSize(10);
    pdf.text(`${name} (${currency})`, 163, y, { align: 'right' });
    pdf.text(money(value), 193, y, { align: 'right' });
    pdf.setLineWidth(0.2);
    pdf.line(167, y + 2, 195, y + 2);
  }
  y += 15;
  const notes = invoice ? detail('paymentDetails') : String(document.notes || '');
  pdf.setFont('Poppins', 'normal');
  pdf.setFontSize(8.5);
  const lines: string[] = pdf.splitTextToSize(notes, invoice ? 94 : 180);
  const needed = Math.min(lines.length * 4 + 20, 200);
  if (y + needed > 264) y = nextPage();
  pdf.setFontSize(9);
  pdf.text(`Prepared by: ${detail('preparedBy')}`, 195, y, { align: 'right' });
  if (!invoice) { pdf.setFont('Poppins', 'bold'); pdf.text('Terms', 18, y); y += 6; }
  pdf.setFont('Poppins', 'normal');
  pdf.setFontSize(8.5);
  for (const line of lines) {
    if (y > 265) y = nextPage();
    pdf.setFont('Poppins', 'normal'); pdf.setFontSize(8.5);
    pdf.text(line, 18, y);
    y += 4;
  }
  if (invoice && document.notes) {
    y += 5;
    for (const line of pdf.splitTextToSize(String(document.notes), 177)) {
      if (y > 265) y = nextPage();
      pdf.setFontSize(8.5); pdf.text(line, 18, y); y += 4;
    }
  }
  y += 8;
  const contactLines: string[] = pdf.splitTextToSize(`WhatsApp : ${detail('whatsapp')}\nCall on : ${detail('phone')}\nEmail : ${detail('businessEmail') || detail('email')}`, 106);
  const contactHeight = contactLines.length * 4.5 + 6;
  if (y + contactHeight > 274) y = nextPage();
  pdf.setDrawColor(...ink);
  if (invoice) pdf.setFillColor(...ink); else pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(invoice ? 79 : 15, y, 116, contactHeight, 3, 3, 'FD');
  if (invoice) pdf.setTextColor(255, 255, 255); else pdf.setTextColor(...ink);
  pdf.setFontSize(9);
  pdf.text(contactLines, invoice ? 83 : 19, y + 6, { lineHeightFactor: 1.42 });
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.addImage(borderImage, 'PNG', 0, 289, 210, 8);
    if (pdf.getNumberOfPages() > 1) { pdf.setFontSize(8); pdf.setTextColor(...ink); pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 195, 285, { align: 'right' }); }
  }
  return pdf;
}

export async function downloadDocumentPdf(document: DocumentRecord, settings: DocumentRecord) {
  const pdf = await createDocumentPdf(document, settings);
  const url = URL.createObjectURL(pdf.output('blob'));
  const link = window.document.createElement('a');
  link.href = url;
  link.download = documentFilename(document);
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
