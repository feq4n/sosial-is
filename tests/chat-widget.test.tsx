import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatWidget from '@/components/chat/ChatWidget';

const SRC = { n: 1, id: '11111111-1111-4111-8111-111111111111', title: 'Sosial iş nəzəriyyəsi', subject: 'Sosial iş', pages: [12] };
const ok = (reply: string, sources: unknown[] = [], grounded = sources.length > 0) => new Response(JSON.stringify({ reply, sources, grounded }), { status: 200 });
const err = (code: string, message: string, status = 503) => new Response(JSON.stringify({ error: { code, message } }), { status });

type Impl = (init: RequestInit) => Promise<Response>;
let impl: Impl;
const fetchMock = () => vi.mocked(fetch);
const sentBodies = () => fetchMock().mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)));

/** Abort-a cavab verən, əl ilə həll edilən sorğu */
function pending() {
  let resolve!: (r: Response) => void;
  const promise = (init: RequestInit) => new Promise<Response>((res, rej) => {
    resolve = res;
    init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
  });
  return { promise, resolve: (r: Response) => resolve(r) };
}

const renderChat = (path = '/') => render(<MemoryRouter initialEntries={[path]}><ChatWidget /></MemoryRouter>);
const openChat = async (u: ReturnType<typeof userEvent.setup>) => { await u.click(screen.getByRole('button', { name: 'Sosial İş AI söhbətini aç' })); return screen.findByRole('dialog', { name: 'Sosial İş AI söhbəti' }); };
const box = () => screen.getByRole('textbox', { name: 'Mesajınız' }) as HTMLTextAreaElement;

beforeEach(() => {
  sessionStorage.clear();
  impl = async () => ok('Salam! Necə kömək edə bilərəm?');
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => impl(init)));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('Sosial İş AI çat pəncərəsi', () => {
  it('düymə ilə açılır: salamlaşma və 4 nümunə sual göstərilir; Escape bağlayır və fokusu düyməyə qaytarır', async () => {
    const u = userEvent.setup();
    renderChat();
    const launcher = screen.getByRole('button', { name: 'Sosial İş AI söhbətini aç' });
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    const dialog = await openChat(u);
    expect(within(dialog).getByText(/Salam! Mən Sosial İş AI/)).toBeInTheDocument();
    const chips = within(within(dialog).getByRole('list', { name: 'Nümunə suallar' })).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual([
      'Sosial iş nədir?', 'Sosial işçinin etik prinsipləri hansılardır?', 'Bu mövzunu sadə dildə izah et.', 'İmtahana hazırlaşmaq üçün mənə suallar hazırla.',
    ]);
    await waitFor(() => expect(box()).toHaveFocus());
    expect(within(dialog).getByText(/Şəxsi məlumat yazmayın/)).toBeInTheDocument();

    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(launcher).toHaveFocus();
  });

  it('nümunə suala klik göndərir; yazır göstəricisi, sonra Markdown cavab, mənbə, vaxt və kopyalama görünür', async () => {
    const u = userEvent.setup();
    const p = pending();
    impl = p.promise;
    renderChat();
    await openChat(u);
    await u.click(screen.getByRole('button', { name: 'Sosial iş nədir?' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Sosial İş AI yazır');
    expect(sentBodies()[0]).toEqual({ messages: [{ role: 'user', content: 'Sosial iş nədir?' }] });
    expect(screen.queryByRole('list', { name: 'Nümunə suallar' })).toBeNull();

    p.resolve(ok('**Sosial iş** peşədir [1].\n\n- birinci\n- ikinci', [SRC]));
    expect(await screen.findByText('Sosial iş', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    const link = screen.getByRole('link', { name: /\[1\] Sosial iş nəzəriyyəsi/ });
    expect(link).toHaveAttribute('href', `/materials/${SRC.id}`);
    expect(screen.getByText('(səh. 12)')).toBeInTheDocument();
    expect(screen.getAllByText(/^\d{2}:\d{2}$/).length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(screen.queryByText('Sosial İş AI yazır…')).toBeNull());

    await u.click(screen.getByRole('button', { name: 'Cavabı kopyala' }));
    expect(await navigator.clipboard.readText()).toContain('**Sosial iş** peşədir [1].');
    expect(await screen.findByRole('button', { name: 'Kopyalandı' })).toBeInTheDocument();
  });

  it('Enter göndərir, Shift+Enter yeni sətir yaradır', async () => {
    const u = userEvent.setup();
    renderChat();
    await openChat(u);
    await u.type(box(), 'birinci{Shift>}{Enter}{/Shift}ikinci');
    expect(box().value).toBe('birinci\nikinci');
    expect(fetchMock()).not.toHaveBeenCalled();
    await u.keyboard('{Enter}');
    await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1));
    expect(sentBodies()[0].messages[0].content).toBe('birinci\nikinci');
    expect(box().value).toBe('');
    expect(await screen.findByText('Salam! Necə kömək edə bilərəm?')).toBeInTheDocument();
  });

  it('cavab gözlənilərkən paralel sorğu göndərilmir və Göndər düyməsi bağlıdır', async () => {
    const u = userEvent.setup();
    const p = pending();
    impl = p.promise;
    renderChat();
    await openChat(u);
    await u.type(box(), 'sual 1{Enter}');
    await screen.findByRole('status');
    await u.type(box(), 'sual 2{Enter}');
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Göndər' })).toBeDisabled();
    p.resolve(ok('cavab'));
    await screen.findByText('cavab');
  });

  it('xəta aydın göstərilir, "Yenidən göndər" eyni mesajı təkrar yollayır', async () => {
    const u = userEvent.setup();
    impl = async () => err('upstream_error', 'Cavab almaq mümkün olmadı. Bir az sonra yenidən cəhd edin.', 502);
    renderChat();
    await openChat(u);
    await u.type(box(), 'Salam{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Cavab almaq mümkün olmadı');
    expect(alert).not.toHaveTextContent(/gsk_|stack|GROQ/);

    impl = async () => ok('Bu dəfə alındı');
    await u.click(within(alert).getByRole('button', { name: /Yenidən göndər/ }));
    expect(await screen.findByText('Bu dəfə alındı')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(sentBodies()[1].messages).toEqual([{ role: 'user', content: 'Salam' }]);
  });

  it('son cavabı yenidən yaratmaq olar', async () => {
    const u = userEvent.setup();
    let n = 0;
    impl = async () => ok(`cavab ${++n}`);
    renderChat();
    await openChat(u);
    await u.type(box(), 'sual{Enter}');
    await screen.findByText('cavab 1');
    await u.click(screen.getByRole('button', { name: 'Cavabı yenidən yarat' }));
    expect(await screen.findByText('cavab 2')).toBeInTheDocument();
    expect(screen.queryByText('cavab 1')).toBeNull();
    expect(sentBodies()[1].messages).toEqual([{ role: 'user', content: 'sual' }]);
  });

  it('mənbə tapılmadıqda bunu açıq bildirir', async () => {
    const u = userEvent.setup();
    impl = async () => ok('Ümumi cavab', [], false);
    renderChat();
    await openChat(u);
    await u.type(box(), 'sual{Enter}');
    expect(await screen.findByText(/mənbə tapılmadı/)).toBeInTheDocument();
  });

  it('tarixçə sessiyada saxlanılır, səhifə yenilənəndə bərpa olunur; təmizlə/yeni söhbət silir', async () => {
    const u = userEvent.setup();
    const first = renderChat();
    await openChat(u);
    await u.type(box(), 'Salam{Enter}');
    await screen.findByText('Salam! Necə kömək edə bilərəm?');
    first.unmount();

    renderChat();
    await openChat(u);
    expect(screen.getByText('Salam')).toBeInTheDocument();
    expect(screen.getByText('Salam! Necə kömək edə bilərəm?')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Söhbəti təmizlə' }));
    expect(screen.queryByText('Salam')).toBeNull();
    expect(screen.getByRole('list', { name: 'Nümunə suallar' })).toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
  });

  it('"Yeni söhbət" davam edən sorğunu ləğv edir və yazı sahəsini sıfırlayıb fokuslayır', async () => {
    const u = userEvent.setup();
    const p = pending();
    impl = p.promise;
    renderChat();
    await openChat(u);
    await u.type(box(), 'uzun sual{Enter}');
    await screen.findByRole('status');
    await u.type(box(), 'yarımçıq');
    await u.click(screen.getByRole('button', { name: 'Yeni söhbət' }));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(box().value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull(); // ləğv xəta kimi göstərilmir
    await waitFor(() => expect(box()).toHaveFocus());
    impl = async () => ok('yeni cavab');
    await u.type(box(), 'yeni{Enter}');
    expect(await screen.findByText('yeni cavab')).toBeInTheDocument();
  });

  it('yazı sahəsində uzunluq limiti var', async () => {
    const u = userEvent.setup();
    renderChat();
    await openChat(u);
    expect(box()).toHaveAttribute('maxlength', '2000');
    expect(screen.getByRole('button', { name: 'Göndər' })).toBeDisabled();
  });

  it('admin, giriş və form səhifələrində göstərilmir; digərlərində göstərilir', () => {
    for (const path of ['/admin/materials', '/login', '/register', '/f/abc123']) {
      const { unmount } = renderChat(path);
      expect(screen.queryByRole('button', { name: /Sosial İş AI söhbətini/ })).toBeNull();
      unmount();
    }
    for (const path of ['/', '/materials', '/dashboard']) {
      const { unmount } = renderChat(path);
      expect(screen.getByRole('button', { name: 'Sosial İş AI söhbətini aç' })).toBeInTheDocument();
      unmount();
    }
  });
});
