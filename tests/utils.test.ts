import { describe, expect, it } from 'vitest';
import { formatDate, isSafeHttpsUrl, matchesQuery, normalize } from '@/utils/format';
import { friendlyError } from '@/utils/errors';
import { jsDayToIso } from '@/utils/labels';

describe('axtarış normallaşdırması', () => {
  it('Azərbaycan hərflərinə həssas deyil', () => {
    expect(normalize('Şöbə İmtahan Çətin Ğ')).toBe(normalize('sobe imtahan cetin g'));
    expect(matchesQuery('tedris', 'Tədris materialları')).toBe(true);
    expect(matchesQuery('', 'hər şey')).toBe(true);
    expect(matchesQuery('yoxdur', 'Tədris')).toBe(false);
  });
});

describe('təhlükəsiz keçid', () => {
  it('yalnız https qəbul edilir', () => {
    expect(isSafeHttpsUrl('https://example.com/a.pdf')).toBe(true);
    expect(isSafeHttpsUrl('http://example.com')).toBe(false);
    expect(isSafeHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpsUrl('not a url')).toBe(false);
  });
});

describe('tarix və gün', () => {
  it('Azərbaycan ay adları', () => {
    expect(formatDate('2026-03-05T10:00:00')).toBe('5 mart 2026');
    expect(formatDate('')).toBe('');
  });
  it('bazar günü 7 olur', () => {
    expect(jsDayToIso(0)).toBe(7);
    expect(jsDayToIso(1)).toBe(1);
  });
});

describe('xəta mesajları', () => {
  it('texniki detalları göstərmir', () => {
    expect(friendlyError({ code: 'auth/invalid-credential', message: 'secret-internal' })).toBe('E-poçt və ya şifrə yanlışdır.');
    expect(friendlyError(new Error('stack trace internals'))).not.toMatch(/stack|internals/);
    expect(friendlyError({ code: 'permission-denied' })).toMatch(/icazəniz yoxdur/);
  });
});
