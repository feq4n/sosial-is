// PDF / DOCX / TXT fayllarından mətn çıxarıb RAG parçalarına çevirir (scripts/ingest-materials.mjs və testlər istifadə edir).
import { chunkPages, chunkText } from './rag-chunk.mjs';

export const MAX_PAGES = 400;
export const MAX_CHARS = 1_500_000;

/** @returns {Promise<{page:number|null, content:string}[]>} */
export async function extractPdf(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
  const pages = [];
  let total = 0;
  for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES) && total < MAX_CHARS; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let text = '';
    for (const it of tc.items) { if ('str' in it) text += it.str + (it.hasEOL ? '\n' : ' '); }
    total += text.length;
    pages.push({ page: i, text });
  }
  return chunkPages(pages);
}

export async function extractDocx(bytes) {
  const mammoth = (await import('mammoth')).default;
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return chunkText(value.slice(0, MAX_CHARS)).map((content) => ({ page: null, content }));
}

/** Dəstəklənməyən tip üçün null qaytarır. */
export async function extract(ext, bytes) {
  if (ext === 'pdf') return extractPdf(bytes);
  if (ext === 'docx') return extractDocx(bytes);
  if (ext === 'txt') return chunkText(new TextDecoder('utf-8').decode(bytes).slice(0, MAX_CHARS)).map((content) => ({ page: null, content }));
  return null;
}
