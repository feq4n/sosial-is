import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatError, MAX_HISTORY, clearHistory, loadHistory, saveHistory, sendChat, type ChatMsg } from '@/lib/chat';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
const stubFetch = (impl: (url: string, init: RequestInit) => Promise<Response>) => vi.stubGlobal('fetch', vi.fn(impl));
const msgs = [{ role: 'user' as const, content: 'Salam' }];

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('sendChat', () => {
  it('yalnız /api/chat-a role/content göndərir və cavabı ayrışdırır', async () => {
    stubFetch(async () => json({ reply: 'Salam!', sources: [{ n: 1, id: 'a', title: 'T', subject: null, pages: [2] }, { bad: true }], grounded: true }));
    const long = Array.from({ length: 14 }, (_, i) => ({ role: 'user' as const, content: `m${i}`, ts: 1, id: `${i}` }));
    const r = await sendChat(long);
    expect(r).toEqual({ reply: 'Salam!', sources: [{ n: 1, id: 'a', title: 'T', subject: null, pages: [2] }], grounded: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/chat');
    const body = JSON.parse(String(init.body));
    expect(body.messages).toHaveLength(MAX_HISTORY);
    expect(Object.keys(body.messages[0]).sort()).toEqual(['content', 'role']);
  });

  it('server xətasını kod və mesajla ChatError-a çevirir, Retry-After oxunur', async () => {
    stubFetch(async () => json({ error: { code: 'rate_limited', message: 'Çox tez-tez sorğu göndərirsiniz.' } }, 429, { 'Retry-After': '12' }));
    await expect(sendChat(msgs)).rejects.toMatchObject({ name: 'ChatError', code: 'rate_limited', message: 'Çox tez-tez sorğu göndərirsiniz.', retryAfter: 12 });
  });

  it('JSON olmayan cavab (məs. /api yoxdur) aydın "əlçatan deyil" mesajı verir', async () => {
    stubFetch(async () => new Response('<html>404</html>', { status: 404 }));
    await expect(sendChat(msgs)).rejects.toMatchObject({ code: 'unavailable', message: expect.stringContaining('əlçatan deyil') });
  });

  it('şəbəkə xətası və boş cavab idarə olunur', async () => {
    stubFetch(async () => { throw new TypeError('Failed to fetch'); });
    await expect(sendChat(msgs)).rejects.toMatchObject({ code: 'network' });
    stubFetch(async () => json({ reply: '  ' }));
    await expect(sendChat(msgs)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('35 saniyədən sonra timeout, istifadəçi ləğv etdikdə isə AbortError', async () => {
    const hang = (_: string, init: RequestInit) => new Promise<Response>((_res, rej) => init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
    vi.useFakeTimers();
    stubFetch(hang);
    const p = sendChat(msgs);
    const assertion = expect(p).rejects.toBeInstanceOf(ChatError);
    await vi.advanceTimersByTimeAsync(35_001);
    await assertion;
    await expect(p).rejects.toMatchObject({ code: 'timeout' });

    vi.useRealTimers();
    stubFetch(hang);
    const ctrl = new AbortController();
    const q = sendChat(msgs, ctrl.signal);
    ctrl.abort();
    await expect(q).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('sessiya tarixçəsi', () => {
  beforeEach(() => sessionStorage.clear());
  const m = (i: number, over: Partial<ChatMsg> = {}): ChatMsg => ({ id: `id${i}`, role: i % 2 ? 'assistant' : 'user', content: `mətn ${i}`, ts: 1000 + i, ...over });

  it('yadda saxlayır və bərpa edir; uğursuz mesajları saxlamır', () => {
    saveHistory([m(0), m(1, { sources: [{ n: 1, id: 'x', title: 'T', subject: null, pages: [] }], grounded: true }), m(2, { failed: true, error: 'x' })]);
    const back = loadHistory();
    expect(back.map((x) => x.id)).toEqual(['id0', 'id1']);
    expect(back[1].sources).toHaveLength(1);
  });

  it('boş tarixçə açarı silir, clearHistory təmizləyir', () => {
    saveHistory([m(0)]);
    clearHistory();
    expect(loadHistory()).toEqual([]);
    saveHistory([m(0)]);
    saveHistory([]);
    expect(sessionStorage.length).toBe(0);
  });

  it('korlanmış və yad məlumatı rədd edir, sayı məhdudlaşdırır', () => {
    sessionStorage.setItem('sosial-is-ai:v1', '{bad');
    expect(loadHistory()).toEqual([]);
    sessionStorage.setItem('sosial-is-ai:v1', JSON.stringify([{ id: 1 }, { id: 'a', role: 'system', content: 'x', ts: 1 }, null, 'str']));
    expect(loadHistory()).toEqual([]);
    saveHistory(Array.from({ length: 60 }, (_, i) => m(i)));
    expect(loadHistory()).toHaveLength(30);
  });

  it('storage əlçatmazdırsa xəta atmır', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => saveHistory([m(0)])).not.toThrow();
    spy.mockRestore();
  });
});
