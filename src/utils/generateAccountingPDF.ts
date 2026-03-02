import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumber } from '@/utils/formatNumber';

export interface AccountingEntryForPDF {
  entry_number: string;
  entry_date: string;
  code: string | null;
  description: string;
  numero_piece: string | null;
  entrees: number;
  sorties: number;
  balance: number;
}

export interface EntityForAccountingPDF {
  name: string;
  code: string;
}

export interface GenerateAccountingPDFParams {
  entries: AccountingEntryForPDF[];
  balance: number;
  entity: EntityForAccountingPDF | null;
  dateFrom?: string;
  dateTo?: string;
}

// Couleurs du design système (globals.css)
const primaryRgb: [number, number, number] = [0, 168, 150]; // #00A896
const primaryDarkRgb: [number, number, number] = [0, 137, 123]; // #00897B
const textRgb: [number, number, number] = [26, 26, 26]; // #1A1A1A
const textLightRgb: [number, number, number] = [107, 114, 128]; // #6B7280
const successRgb: [number, number, number] = [16, 185, 129]; // #10B981
const errorRgb: [number, number, number] = [239, 68, 68]; // #EF4444

function formatCurrency(value: number): string {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export async function generateAccountingPDF({
  entries,
  balance,
  entity,
  dateFrom,
  dateTo,
}: GenerateAccountingPDFParams): Promise<void> {
  const doc = new jsPDF('l', 'mm', 'a4'); // paysage pour le tableau
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let yPosition = margin;

  doc.setFont('helvetica');
  doc.setFontSize(18);
  doc.setTextColor(...primaryDarkRgb);
  doc.text('Livre de Caisse', margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setTextColor(...textLightRgb);
  const entityLabel = entity ? `${entity.name} (${entity.code})` : 'Vue consolidée - Toutes entités';
  doc.text(entityLabel, margin, yPosition);
  yPosition += 6;

  if (dateFrom || dateTo) {
    const period =
      dateFrom && dateTo
        ? `Période : ${formatDate(dateFrom)} - ${formatDate(dateTo)}`
        : dateFrom
          ? `À partir du ${formatDate(dateFrom)}`
          : dateTo
            ? `Jusqu'au ${formatDate(dateTo)}`
            : '';
    if (period) {
      doc.text(period, margin, yPosition);
      yPosition += 6;
    }
  }

  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, margin, yPosition);
  yPosition += 10;

  const tableStartY = yPosition;

  autoTable(doc, {
    startY: tableStartY,
    head: [['N°', 'Date', 'Code', 'Libellé', 'N° Pièce', 'Entrées', 'Sorties', 'Solde']],
    body: entries.map((e) => [
      e.entry_number,
      formatDate(e.entry_date),
      e.code || '-',
      e.description.length > 40 ? e.description.slice(0, 37) + '...' : e.description,
      e.numero_piece || '-',
      formatCurrency(e.entrees),
      formatCurrency(e.sorties),
      formatCurrency(e.balance),
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: primaryRgb,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: textRgb,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: margin, right: margin },
    tableWidth: 'auto',
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 18 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 22 },
      5: { cellWidth: 26, halign: 'right' },
      6: { cellWidth: 26, halign: 'right' },
      7: { cellWidth: 28, halign: 'right' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? tableStartY;
  yPosition = finalY + 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textRgb);
  doc.text('Solde total:', margin, yPosition);
  doc.setTextColor(...(balance >= 0 ? successRgb : errorRgb));
  doc.text(`${formatCurrency(balance)} $US`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textLightRgb);
  doc.text('Application sécurisée - ISIRO GROUP', pageWidth / 2, pageHeight - 10, { align: 'center' });

  const fileName = entity
    ? `Livre-de-caisse_${entity.code}_${new Date().toISOString().split('T')[0]}.pdf`
    : `Livre-de-caisse_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
