import { describe, expect, it } from 'vitest';
import { chunkPages, chunkText, normalizeText } from '../scripts/rag-chunk.mjs';

describe('rag-chunk', () => {
  it('boşluqları və idarəedici simvolları təmizləyir', () => {
    expect(normalizeText('a \u0000  b\r\n\r\n\r\n\r\nc')).toBe('a b\n\nc');
    expect(chunkText('   \n ')).toEqual([]);
  });

  it('qısa mətni bir parça kimi saxlayır', () => {
    expect(chunkText('Sosial iş insanlara kömək peşəsidir.')).toEqual(['Sosial iş insanlara kömək peşəsidir.']);
  });

  it('uzun mətni limitə yaxın parçalara bölür, üst-üstə düşmə var, Azərbaycan hərfləri qorunur', () => {
    const sentence = 'Sosial işçi həssas qruplarla işləyərkən məxfiliyə və ədalətə əməl edir.';
    const text = Array.from({ length: 60 }, () => sentence).join(' ');
    const chunks = chunkText(text, { size: 500, overlap: 80 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) { expect(c.length).toBeLessThanOrEqual(500 + 80 + 1); expect(c.length).toBeGreaterThan(0); }
    expect(chunks.join(' ')).toContain('məxfiliyə və ədalətə');
    const tailWord = chunks[0].slice(-30).split(' ').slice(-2).join(' ');
    expect(chunks[1]).toContain(tailWord.trim().split(' ')[0]);
  });

  it('bir uzun söz/cümləni sərt bölür və 4000 simvolu keçmir', () => {
    const chunks = chunkText('x'.repeat(9000), { size: 1000 });
    expect(chunks.length).toBeGreaterThanOrEqual(9);
    expect(chunks.every((c) => c.length <= 4000)).toBe(true);
  });

  it('səhifə nömrəsini hər parçada saxlayır', () => {
    const out = chunkPages([{ page: 1, text: 'Birinci səhifə mətni burada.' }, { page: 2, text: '' }, { page: 3, text: 'Üçüncü səhifə mətni burada.' }]);
    expect(out).toEqual([{ page: 1, content: 'Birinci səhifə mətni burada.' }, { page: 3, content: 'Üçüncü səhifə mətni burada.' }]);
  });
});
