// Mətni RAG üçün parçalara bölən sadə, asılılıqsız köməkçi (scripts/ingest-materials.mjs və testlər istifadə edir).

const SENTENCE_END = /(?<=[.!?…])\s+/;

/** Boşluqları sakitləşdirir, abzas sərhədlərini (boş sətir) saxlayır. */
export function normalizeText(input) {
  return String(input ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hardSplit(text, size) {
  const out = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf(' ', size);
    if (cut < size * 0.5) cut = size;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** Abzas və cümlə sərhədlərinə hörmət edərək ~size simvolluq, overlap simvol üst-üstə düşən parçalar qaytarır. */
export function chunkText(text, { size = 1000, overlap = 150, min = 40 } = {}) {
  const clean = normalizeText(text);
  if (!clean) return [];

  const units = [];
  for (const para of clean.split(/\n{2,}/)) {
    const p = para.replace(/\n/g, ' ').trim();
    if (!p) continue;
    if (p.length <= size) { units.push(p); continue; }
    for (const s of p.split(SENTENCE_END)) units.push(...(s.length > size ? hardSplit(s, size) : [s]));
  }

  const chunks = [];
  let cur = '';
  for (const u of units) {
    if (cur && cur.length + u.length + 1 > size) {
      chunks.push(cur);
      const tail = overlap > 0 ? cur.slice(-overlap) : '';
      const cutAt = tail.indexOf(' ');
      cur = cutAt >= 0 && tail.length === overlap ? `${tail.slice(cutAt + 1)} ${u}` : u;
    } else {
      cur = cur ? `${cur} ${u}` : u;
    }
  }
  if (cur) chunks.push(cur);

  // Çox qısa son parçanı əvvəlkinə birləşdir
  if (chunks.length > 1 && chunks[chunks.length - 1].length < min) {
    const tail = chunks.pop();
    chunks[chunks.length - 1] += ` ${tail}`;
  }
  return chunks.map((c) => c.slice(0, 4000)).filter((c) => c.length > 0);
}

/** [{ page, text }] → [{ page, content }]; hər səhifə ayrıca bölünür ki, istinad dəqiq olsun. */
export function chunkPages(pages, opts) {
  const out = [];
  for (const { page, text } of pages) for (const content of chunkText(text, opts)) out.push({ page, content });
  return out;
}
