import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { fileService } from './fileService';

/**
 * Convert an array of image URIs (file paths or base64) into a single PDF.
 * The PDF is saved to the PRScan documents directory.
 */
async function imagesToPdf(imageUris: string[], fileName: string): Promise<string> {
  // Build HTML with one image per page
  const pages = await Promise.all(
    imageUris.map(async (uri) => {
      // If it's a file URI, read as base64 so WebKit can render it
      let src = uri;
      if (uri.startsWith('file://') || (uri.startsWith('/') && !uri.startsWith('//'))) {
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          src = `data:image/jpeg;base64,${base64}`;
        } catch {
          src = uri;
        }
      }

      return `
        <div style="
          width: 210mm;
          height: 297mm;
          display: flex;
          align-items: center;
          justify-content: center;
          page-break-after: always;
          background: #fff;
          margin: 0;
          padding: 0;
        ">
          <img
            src="${src}"
            style="
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
              display: block;
            "
          />
        </div>
      `;
    }),
  );

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 210mm; background: #fff; }
          @page { size: A4; margin: 0; }
        </style>
      </head>
      <body>
        ${pages.join('')}
      </body>
    </html>
  `;

  // Generate PDF using expo-print
  const { uri: tempUri } = await Print.printToFileAsync({
    html,
    base64: false,
    width: 595,  // A4 width in points
    height: 842, // A4 height in points
  });

  const pdfFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const saved = await fileService.saveFile(tempUri, pdfFileName);

  // Clean up temp file
  try {
    await FileSystem.deleteAsync(tempUri, { idempotent: true });
  } catch {}

  return saved.path;
}

export const pdfService = {
  imagesToPdf,
};
