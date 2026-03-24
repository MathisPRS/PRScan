import { jsPDF } from 'jspdf';
import { fileService } from './fileService';
import { generateFileName } from '../utils/format';

function fileToDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function imagesToPdf(images: (File | Blob)[], fileName?: string): Promise<string> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();   // 210mm
  const pageH = pdf.internal.pageSize.getHeight();  // 297mm
  const margin = 0;

  for (let i = 0; i < images.length; i++) {
    if (i > 0) pdf.addPage();
    const dataUrl = await fileToDataURL(images[i]);
    const img = await loadImage(dataUrl);
    const ratio = Math.min(
      (pageW - margin * 2) / img.naturalWidth,
      (pageH - margin * 2) / img.naturalHeight
    );
    const w = img.naturalWidth * ratio;
    const h = img.naturalHeight * ratio;
    const x = margin + (pageW - margin * 2 - w) / 2;
    const y = margin + (pageH - margin * 2 - h) / 2;
    const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    pdf.addImage(dataUrl, format, x, y, w, h);
  }

  const name = fileName
    ? (fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
    : `${generateFileName('scan')}.pdf`;

  const pdfBlob = pdf.output('blob');
  const saved = await fileService.saveFile(pdfBlob, name);
  return saved.id;
}

export const pdfService = { imagesToPdf };
