import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumber } from '@/utils/formatNumber';

interface Entity {
  name: string;
  code: string;
  logo_url?: string | null;
  header_url?: string | null;
  watermark_url?: string | null;
  footer_text?: string | null;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  invoice_number: string;
  client_name: string;
  client_phone: string | null;
  client_address: string | null;
  issue_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string | null;
  notes: string | null;
  additional_taxes?: Array<{ name: string; rate: number }> | null;
}

interface GenerateInvoicePDFParams {
  invoice: Invoice;
  items: InvoiceItem[];
  entity: Entity;
}

/**
 * Charge une image depuis une URL (base64 ou URL publique) et retourne un Promise avec dataURL et dimensions
 */
async function loadImage(src: string): Promise<{ dataURL: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve({
          dataURL: canvas.toDataURL('image/png'),
          width: img.width,
          height: img.height,
        });
      } else {
        reject(new Error('Impossible de charger le contexte canvas'));
      }
    };
    
    img.onerror = () => {
      reject(new Error(`Impossible de charger l'image: ${src}`));
    };
    
    img.src = src;
  });
}

/**
 * Charge une image avec opacité pour créer un filigrane transparent
 * Crée un effet de transparence en mélangeant l'image avec un fond blanc
 */
async function loadImageWithOpacity(src: string, opacity: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Créer un canvas temporaire pour l'image originale
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
          // Dessiner l'image originale sur le canvas temporaire
          tempCtx.drawImage(img, 0, 0);
          const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
          const data = imageData.data;
          
          // Mélanger chaque pixel avec du blanc selon l'opacité
          // Pour simuler l'opacité, on mélange la couleur avec du blanc
          // Opacité de 0.08 signifie que l'image est à 8% et le fond blanc à 92%
          for (let i = 0; i < data.length; i += 4) {
            // R, G, B, A
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Mélanger avec du blanc (255, 255, 255)
            data[i] = Math.round(r * opacity + 255 * (1 - opacity));
            data[i + 1] = Math.round(g * opacity + 255 * (1 - opacity));
            data[i + 2] = Math.round(b * opacity + 255 * (1 - opacity));
            // Alpha reste à 255 (opaque) car on a déjà mélangé avec le blanc
          }
          
          // Dessiner l'image modifiée sur le canvas final
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          reject(new Error('Impossible de charger le contexte canvas'));
        }
      } else {
        reject(new Error('Impossible de charger le contexte canvas'));
      }
    };
    
    img.onerror = () => {
      reject(new Error(`Impossible de charger l'image: ${src}`));
    };
    
    img.src = src;
  });
}

export async function generateInvoicePDF({
  invoice,
  items,
  entity,
}: GenerateInvoicePDFParams): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Couleurs
  const primaryColor: [number, number, number] = [14, 165, 233]; // #0ea5e9 (primary)
  const darkColor: [number, number, number] = [8, 120, 163]; // #0878a3 (primary-dark)
  const lightGray: [number, number, number] = [240, 240, 240];
  const textColor: [number, number, number] = [51, 51, 51];

  // === FILIGRANE (WATERMARK) - AJOUTÉ EN TOUT PREMIER POUR ÊTRE EN ARRIÈRE-PLAN ===
  // Le filigrane doit être ajouté AVANT tout autre contenu pour garantir qu'il soit en arrière-plan
  let watermarkData: { image: string; x: number; y: number; width: number; height: number } | null = null;
  if (entity.watermark_url) {
    try {
      // Charger l'image pour obtenir ses dimensions réelles
      const watermarkImageData = await loadImage(entity.watermark_url);
      // Opacité réduite à 2% pour s'assurer qu'il reste en arrière-plan
      const watermarkImage = await loadImageWithOpacity(entity.watermark_url, 0.02);
      
      // Réduction de 60% puis agrandissement de 25% = 0.4 * 1.25 = 0.5, en préservant le ratio d'aspect
      const originalAspectRatio = watermarkImageData.width / watermarkImageData.height;
      const maxWatermarkSize = 150 * 0.4 * 1.25; // Réduction de 60% puis +25% = 75mm (au lieu de 150mm)
      
      // Calculer les dimensions en préservant le ratio d'aspect
      let imgWidth: number;
      let imgHeight: number;
      
      // Si l'image est plus large que haute (ratio > 1), utiliser la largeur comme référence
      if (originalAspectRatio >= 1) {
        imgWidth = maxWatermarkSize;
        imgHeight = imgWidth / originalAspectRatio;
      } else {
        // Si l'image est plus haute que large (ratio < 1), utiliser la hauteur comme référence
        imgHeight = maxWatermarkSize;
        imgWidth = imgHeight * originalAspectRatio;
      }
      
      const centerX = (pageWidth - imgWidth) / 2;
      const centerY = (pageHeight - imgHeight) / 2;
      watermarkData = { image: watermarkImage, x: centerX, y: centerY, width: imgWidth, height: imgHeight };
      
      // Ajouter le filigrane EN TOUT PREMIER pour garantir qu'il soit en arrière-plan
      doc.addImage(
        watermarkImage,
        'PNG',
        centerX,
        centerY,
        imgWidth,
        imgHeight,
        undefined,
        'FAST'
      );
    } catch (error) {
      console.warn('Impossible de charger le filigrane:', error);
    }
  }

  try {
    // === LOGO CENTRÉ (EN-TÊTE) - RÉDUIT DE 60% ===
    let headerHeight = 0;
    yPosition = 20; // Commencer un peu plus bas pour éviter les marges
    
    if (entity.header_url) {
      // Si un header personnalisé existe, l'utiliser (réduit de 60%)
      try {
        const headerImage = await loadImage(entity.header_url);
        // Réduction de 60% puis agrandissement de 25% puis +50% = 0.4 * 1.25 * 1.5 = 0.75, en préservant le ratio d'aspect
        const originalAspectRatio = headerImage.width / headerImage.height;
        const headerHeight_px = 35 * 0.4 * 1.25 * 1.5; // Hauteur réduite de 60% puis +25% puis +50% = 26.25mm
        const headerWidth_px = headerHeight_px * originalAspectRatio;
        const headerX = (pageWidth - headerWidth_px) / 2; // Centré horizontalement
        doc.addImage(headerImage.dataURL, 'PNG', headerX, yPosition, headerWidth_px, headerHeight_px);
        headerHeight = headerHeight_px + 10;
      } catch (error) {
        console.warn('Impossible de charger le header, utilisation du logo:', error);
        // Fallback sur logo
        if (entity.logo_url) {
          try {
            const logoImage = await loadImage(entity.logo_url);
            // Réduction de 60% puis agrandissement de 25% puis +50% = 0.4 * 1.25 * 1.5 = 0.75, en préservant le ratio d'aspect
            const originalAspectRatio = logoImage.width / logoImage.height;
            const maxDimension = 35 * 0.4 * 1.25 * 1.5; // Réduction de 60% puis +25% puis +50% = 26.25mm (au lieu de 35mm)
            
            // Calculer les dimensions en préservant le ratio d'aspect
            let logoWidth: number;
            let logoHeight: number;
            
            // Si l'image est plus large que haute (ratio > 1), utiliser la largeur comme référence
            if (originalAspectRatio >= 1) {
              logoWidth = maxDimension;
              logoHeight = logoWidth / originalAspectRatio;
            } else {
              // Si l'image est plus haute que large (ratio < 1), utiliser la hauteur comme référence
              logoHeight = maxDimension;
              logoWidth = logoHeight * originalAspectRatio;
            }
            
            const logoX = (pageWidth - logoWidth) / 2; // Centré horizontalement
            doc.addImage(logoImage.dataURL, 'PNG', logoX, yPosition, logoWidth, logoHeight);
            
            // Nom de l'entité centré sous le logo - Plus visible
            doc.setFontSize(13);
            doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(entity.name, pageWidth / 2, yPosition + logoHeight + 6, { align: 'center' });
            
            // Code de l'entité centré - Plus visible
            doc.setFontSize(9);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFont('helvetica', 'normal');
            doc.text(`Code: ${entity.code}`, pageWidth / 2, yPosition + logoHeight + 12, { align: 'center' });
            
            headerHeight = logoHeight + 22; // Plus d'espace pour que les textes soient bien visibles
          } catch (logoError) {
            console.warn('Impossible de charger le logo:', logoError);
            headerHeight = 20;
          }
        } else {
          headerHeight = 15;
        }
      }
    } else if (entity.logo_url) {
      // Pas de header mais un logo (réduit de 60% en préservant le ratio d'aspect)
      try {
        const logoImage = await loadImage(entity.logo_url);
        // Réduction de 60% puis agrandissement de 25% puis +50% = 0.4 * 1.25 * 1.5 = 0.75, en préservant le ratio d'aspect
        const originalAspectRatio = logoImage.width / logoImage.height;
        const maxDimension = 35 * 0.4 * 1.25 * 1.5; // Réduction de 60% puis +25% puis +50% = 26.25mm (au lieu de 35mm)
        
        // Calculer les dimensions en préservant le ratio d'aspect
        let logoWidth: number;
        let logoHeight: number;
        
        // Si l'image est plus large que haute (ratio > 1), utiliser la largeur comme référence
        if (originalAspectRatio >= 1) {
          logoWidth = maxDimension;
          logoHeight = logoWidth / originalAspectRatio;
        } else {
          // Si l'image est plus haute que large (ratio < 1), utiliser la hauteur comme référence
          logoHeight = maxDimension;
          logoWidth = logoHeight * originalAspectRatio;
        }
        
        const logoX = (pageWidth - logoWidth) / 2; // Centré horizontalement
        doc.addImage(logoImage.dataURL, 'PNG', logoX, yPosition, logoWidth, logoHeight);
        
        // Nom de l'entité centré sous le logo - Plus visible
        doc.setFontSize(13);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(entity.name, pageWidth / 2, yPosition + logoHeight + 6, { align: 'center' });
        
        // Code de l'entité centré - Plus visible
        doc.setFontSize(9);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(`Code: ${entity.code}`, pageWidth / 2, yPosition + logoHeight + 12, { align: 'center' });
        
        headerHeight = logoHeight + 22; // Plus d'espace pour que les textes soient bien visibles
      } catch (error) {
        console.warn('Impossible de charger le logo:', error);
        headerHeight = 15;
      }
    } else {
      // Pas de logo ni header, juste le nom
      doc.setFontSize(14);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(entity.name, pageWidth / 2, yPosition + 5, { align: 'center' });
      doc.setFontSize(9);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(`Code: ${entity.code}`, pageWidth / 2, yPosition + 12, { align: 'center' });
      headerHeight = 20;
    }

    yPosition = margin + headerHeight + 8; // Plus d'espace après le logo pour que les textes soient visibles

    // Séparateur
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 12; // Plus d'espace après le séparateur

    // === TITRE FACTURE ET NUMÉRO (À DROITE) - RECULÉ DE 25MM POUR MEILLEURE VISIBILITÉ ===
    const invoiceInfoX = pageWidth - margin - 25; // Position X reculée de 25mm vers la gauche pour meilleure visibilité
    
    // Titre "FACTURE" - Plus visible
    doc.setFontSize(20);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', invoiceInfoX, yPosition, { align: 'right' });
    yPosition += 8;

    // Numéro de facture - Format complet et visible
    doc.setFontSize(10.5);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont('helvetica', 'bold');
    // Afficher le numéro de facture tel quel pour préserver tous les formats (ex: "BIG SARLU 2026-001")
    // Ne nettoyer que les espaces multiples consécutifs
    const cleanInvoiceNumber = invoice.invoice_number.replace(/\s{2,}/g, ' ').trim();
    // Calculer la largeur disponible pour le numéro de facture (moitié de la page moins le recul de 25mm)
    const invoiceNumberWidth = ((pageWidth - 2 * margin) / 2) - 5; // Largeur ajustée pour visibilité
    // S'assurer que le numéro de facture peut être affiché sur plusieurs lignes si nécessaire
    const invoiceNumberText = `N° ${cleanInvoiceNumber}`;
    const invoiceNumberLines = doc.splitTextToSize(invoiceNumberText, invoiceNumberWidth);
    
    // Afficher chaque ligne alignée à droite avec un style visible
    let currentY = yPosition;
    invoiceNumberLines.forEach((line: string, index: number) => {
      doc.text(line, invoiceInfoX, currentY, { align: 'right' });
      if (index < invoiceNumberLines.length - 1) {
        currentY += 5.5; // Espacement entre les lignes ajusté
      }
    });
    yPosition = Math.max(currentY + 12, yPosition + 15); // Position finale après le numéro de facture avec plus d'espace

    // === INFORMATIONS CLIENT ET FACTURE ===
    const infoStartY = yPosition;

    // Informations client (gauche) - Libellé complet et visible (avec plus d'espace)
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    // S'assurer que le texte "FACTURÉ À :" est visible en entier
    doc.text('FACTURÉ À :', margin, infoStartY);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(10);
    let clientY = infoStartY + 7;
    doc.text(invoice.client_name, margin, clientY);
    clientY += 6;
    
    if (invoice.client_phone) {
      doc.text(`Tél: ${invoice.client_phone}`, margin, clientY);
      clientY += 6;
    }
    
    if (invoice.client_address) {
      // Augmenter la largeur disponible pour l'adresse pour qu'elle soit visible en entier
      const addressMaxWidth = (pageWidth / 2) - margin - 5;
      const addressLines = doc.splitTextToSize(invoice.client_address, addressMaxWidth);
      doc.text(addressLines, margin, clientY);
      clientY += addressLines.length * 6;
    }

    // Informations facture (droite)
    const infoRightX = pageWidth - margin - 70;
    let infoRightY = infoStartY + 7;
    
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Date d'émission: ${new Date(invoice.issue_date).toLocaleDateString('fr-FR')}`, infoRightX, infoRightY);
    infoRightY += 6;
    
    doc.text(`Date d'échéance: ${new Date(invoice.due_date).toLocaleDateString('fr-FR')}`, infoRightX, infoRightY);
    // Le statut n'est plus affiché dans le PDF comme demandé

    yPosition = Math.max(clientY, infoRightY + 10) + 8;

    // === TABLEAU DES ITEMS ===
    const tableStartY = yPosition;
    
    autoTable(doc, {
      startY: tableStartY,
      head: [['Description', 'Qté', 'Prix unit.', 'Total']],
      body: items.map((item) => {
        const currency = invoice.currency || 'USD';
        const unitPrice = formatNumber(item.unit_price);
        const total = formatNumber(item.total);
        return [
          item.description,
          item.quantity.toString(),
          `${unitPrice} ${currency}`,
          `${total} ${currency}`,
        ];
      }),
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor as [number, number, number],
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        textColor: textColor,
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: lightGray as [number, number, number],
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 25 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'right', cellWidth: 40 },
      },
      margin: { left: margin, right: margin },
    });

    // Récupérer la position Y après le tableau
    const finalY = (doc as any).lastAutoTable.finalY || yPosition + 50;
    
    // === RÉSUMÉ (TOTAUX) - LABELS ALIGNÉS AVEC COLONNE DESCRIPTION, MONTANTS AVEC COLONNE TOTAL ===
    const summaryStartY = finalY + 10;
    
    // Calculer précisément les positions X des colonnes du tableau
    // Le tableau a 4 colonnes : Description (auto), Qté (25mm), Prix unit. (40mm), Total (40mm)
    // Largeur totale utilisable : pageWidth - 2*margin = 210 - 40 = 170mm
    // Colonnes fixes : 25 + 40 + 40 = 105mm
    // Description prend : 170 - 105 = 65mm (autoTable peut ajuster légèrement)
    
    // Positions réelles des colonnes :
    // - Description: de margin (20mm) à ~85mm (largeur ~65mm)
    // - Qté: de ~85mm à ~110mm (largeur 25mm)
    // - Prix unit.: de ~110mm à ~150mm (largeur 40mm)
    // - Total: de ~150mm à 190mm (largeur 40mm, halign: 'right', fin à pageWidth - margin = 190mm)
    
    // Pour aligner avec la colonne Total (halign: 'right'), le texte est aligné à droite dans la cellule
    // Avec jsPDF text() et align: 'right', le point X spécifié est le point de fin du texte
    // La colonne Total va jusqu'à pageWidth - margin (190mm)
    // Avec le padding autoTable par défaut (~3.5mm), le texte aligné à droite est environ à 190mm - 3.5mm = 186.5mm
    // Utilisons la fin de la colonne Total avec un ajustement pour le padding
    const tableDescriptionColumnX = margin; // Position X de la colonne Description (début = 20mm)
    // Position de fin de la colonne Total, alignée avec le texte aligné à droite (190mm - padding ~3.5mm)
    const tableTotalColumnX = pageWidth - margin - 3.5; // Position X de fin de la colonne Total (~186.5mm)
    let summaryY = summaryStartY;

    const formatAmount = (amount: number): string => formatNumber(amount);

    // Sous-total - Labels alignés avec colonne DESCRIPTION, montants avec colonne TOTAL
    const currency = invoice.currency || 'USD';
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('Sous-total:', tableDescriptionColumnX, summaryY);
    const subtotalStr = formatAmount(invoice.subtotal);
    doc.text(`${subtotalStr} ${currency}`, tableTotalColumnX, summaryY, { align: 'right' });
    summaryY += 7;

    // TVA - Labels alignés avec colonne DESCRIPTION, montants avec colonne TOTAL
    doc.text(`TVA (${invoice.tax_rate}%):`, tableDescriptionColumnX, summaryY);
    const taxAmountStr = formatAmount(invoice.tax_amount);
    doc.text(`${taxAmountStr} ${currency}`, tableTotalColumnX, summaryY, { align: 'right' });
    summaryY += 7;

    // Autres taxes - Labels alignés avec colonne DESCRIPTION, montants avec colonne TOTAL
    if (invoice.additional_taxes && invoice.additional_taxes.length > 0) {
      invoice.additional_taxes.forEach((tax) => {
        // Recalculer la taxe pour s'assurer qu'elle est correcte
        const taxAmount = (invoice.subtotal * tax.rate) / 100;
        doc.text(`${tax.name} (${tax.rate}%):`, tableDescriptionColumnX, summaryY);
        const taxAmountStr = formatAmount(taxAmount);
        doc.text(`${taxAmountStr} ${currency}`, tableTotalColumnX, summaryY, { align: 'right' });
        summaryY += 7;
      });
    }

    // Total (en gras et couleur) - Labels alignés avec colonne DESCRIPTION, montants avec colonne TOTAL
    summaryY += 3;
    doc.setDrawColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setLineWidth(1);
    // Ligne de séparation alignée de la colonne DESCRIPTION à la colonne TOTAL
    doc.line(tableDescriptionColumnX, summaryY, tableTotalColumnX, summaryY);
    summaryY += 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('TOTAL:', tableDescriptionColumnX, summaryY);
    const totalStr = formatAmount(invoice.total);
    doc.text(`${totalStr} ${currency}`, tableTotalColumnX, summaryY, { align: 'right' });

    // === NOTES ===
    if (invoice.notes) {
      const notesStartY = summaryY + 15;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text('Notes:', margin, notesStartY);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - 2 * margin);
      doc.text(notesLines, margin, notesStartY + 7);
    }

    // Le filigrane a déjà été ajouté avant le tableau pour être en arrière-plan
    // Si de nouvelles pages ont été créées par autoTable, on doit ajouter le filigrane sur ces pages aussi
    if (watermarkData && doc.getNumberOfPages() > 1) {
      const pageCount = doc.getNumberOfPages();
      for (let i = 2; i <= pageCount; i++) {
        doc.setPage(i);
        // Ajouter le filigrane sur chaque page supplémentaire
        doc.addImage(
          watermarkData.image,
          'PNG',
          watermarkData.x,
          watermarkData.y,
          watermarkData.width,
          watermarkData.height,
          undefined,
          'FAST'
        );
      }
    }

    // === FOOTER (Pied de page) - CENTRÉ ET BIEN VISIBLE ===
    // Position du footer ajustée pour être bien visible en bas de page (inspiré de la capture 2)
    const footerY = pageHeight - 35; // Un peu plus haut pour meilleure visibilité
    
    // Ligne de séparation bleue
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY, pageWidth - margin, footerY);
    
    // Texte du footer CENTRÉ avec meilleur espacement et visibilité
    if (entity.footer_text) {
      doc.setFontSize(8);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'normal');
      // Largeur maximale pour le footer (85% de la page pour meilleure lisibilité)
      const footerMaxWidth = (pageWidth - 2 * margin) * 0.85;
      const footerLines = doc.splitTextToSize(entity.footer_text, footerMaxWidth);
      let footerTextY = footerY + 7;
      footerLines.forEach((line: string, index: number) => {
        doc.text(line, pageWidth / 2, footerTextY, { align: 'center' });
        footerTextY += 4; // Espacement entre les lignes amélioré pour meilleure lisibilité
      });
    } else {
      // Footer par défaut avec nom de l'entité
      doc.setFontSize(8);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(
        entity.name,
        pageWidth / 2,
        footerY + 7,
        { align: 'center' }
      );
    }

    // Numéro de page CENTRÉ en bas
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${i} / ${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    }

    // Télécharger le PDF
    doc.save(`Facture_${invoice.invoice_number}_${entity.code}.pdf`);
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    throw error;
  }
}
