// @vitest-environment node
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { extract, extractDocx, extractPdf } from '../scripts/rag-extract.mjs';

/** Əl ilə düzgün xref-li minimal PDF (hər səhifədə bir mətn sətri; Helvetica/ASCII). */
function buildPdf(pageTexts: string[]): Uint8Array {
  const objs: string[] = [];
  const kids = pageTexts.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageTexts.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pageTexts.forEach((t, i) => {
    const stream = `BT /F1 14 Tf 40 700 Td (${t}) Tj ET`;
    objs[4 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objs[5 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) { offsets[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

async function buildDocx(text: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: 'uint8array' });
}

describe('rag-extract', () => {
  it('PDF: hər səhifə ayrıca, düzgün səhifə nömrəsi ilə çıxarılır', async () => {
    const chunks = await extractPdf(buildPdf(['Social work ethics and confidentiality', 'Vulnerable groups and inclusion']));
    expect(chunks.map((c) => c.page)).toEqual([1, 2]);
    expect(chunks[0].content).toContain('ethics and confidentiality');
    expect(chunks[1].content).toContain('Vulnerable groups');
  });

  it('DOCX: Azərbaycan mətni oxunur, səhifə nömrəsi null', async () => {
    const chunks = await extractDocx(await buildDocx('Sosial işçinin etik prinsipləri: məxfilik və ədalət.'));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].page).toBeNull();
    expect(chunks[0].content).toBe('Sosial işçinin etik prinsipləri: məxfilik və ədalət.');
  });

  it('TXT dəstəklənir, dəstəklənməyən tiplər null qaytarır', async () => {
    const txt = await extract('txt', new TextEncoder().encode('Ədalət və hörmət.'));
    expect(txt).toEqual([{ page: null, content: 'Ədalət və hörmət.' }]);
    expect(await extract('pptx', new Uint8Array([1, 2]))).toBeNull();
    expect(await extract('zip', new Uint8Array([1, 2]))).toBeNull();
  });
});
