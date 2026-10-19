/**
 * Sosial İş AI: müştəri tərəfi köməkçi kitabxana.
 * Bütün sorğular yalnız öz domenimizdəki /api/chat endpoint-inə gedir; Groq açarı brauzerdə yoxdur.
 */

// Limitlər api/chat.ts ilə uyğun saxlanılmalıdır
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_HISTORY = 10;
export const REQUEST_TIMEOUT_MS = 35_000;

const STORAGE_KEY = 'sosial-is-ai:v1';
const MAX_STORED = 30;

export type ChatRole = 'user' | 'assistant';

export interface ChatSource { n: number; id: string; title: string; subject: string | null; pages: number[] }

export interface ChatMsg {
  id: string;
  role: ChatRole;
  content: string;
  ts: number;
  sources?: ChatSource[];
  grounded?: boolean;
  /** Yalnız istifadəçi mesajı üçün: göndərmə uğursuz oldu */
  failed?: boolean;
  error?: string;
}

export interface ChatReply { reply: string; sources: ChatSource[]; grounded: boolean }

export class ChatError extends Error {
  code: string;
  retryAfter?: number;
  constructor(code: string, message: string, retryAfter?: number) {
    super(message);
    this.name = 'ChatError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const FALLBACK_MESSAGES: Record<string, string> = {
  network: 'Bağlantı qurulmadı. İnternetinizi yoxlayıb yenidən cəhd edin.',
  timeout: 'Cavab gecikdi. Yenidən cəhd edin.',
  unavailable: 'Süni intellekt xidməti hazırda əlçatan deyil.',
  invalid_response: 'Gözlənilməz cavab alındı. Yenidən cəhd edin.',
  rate_limited: 'Çox tez-tez sorğu göndərirsiniz. Bir az gözləyib yenidən cəhd edin.',
};

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function isSource(s: unknown): s is ChatSource {
  const o = s as ChatSource;
  return !!o && typeof o.id === 'string' && typeof o.title === 'string' && typeof o.n === 'number' && Array.isArray(o.pages);
}

/** Serverə yalnız son MAX_HISTORY mesaj və yalnız role/content göndərilir. */
export async function sendChat(messages: Pick<ChatMsg, 'role' | 'content'>[], signal?: AbortSignal): Promise<ChatReply> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, REQUEST_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal?.aborted) ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    let res: Response;
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content })) }),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (timedOut) throw new ChatError('timeout', FALLBACK_MESSAGES.timeout);
      if ((e as { name?: string })?.name === 'AbortError') throw e; // istifadəçi ləğv etdi
      throw new ChatError('network', FALLBACK_MESSAGES.network);
    }

    let data: unknown = null;
    try { data = await res.json(); } catch { /* JSON deyil (məs. dev serverdə /api yoxdur) */ }

    if (!res.ok) {
      const err = (data as { error?: { code?: unknown; message?: unknown } } | null)?.error;
      const code = typeof err?.code === 'string' ? err.code : 'unavailable';
      const message = typeof err?.message === 'string' && err.message ? err.message : FALLBACK_MESSAGES[code] ?? FALLBACK_MESSAGES.unavailable;
      const retry = Number(res.headers.get('Retry-After'));
      throw new ChatError(code, message, Number.isFinite(retry) && retry > 0 ? retry : undefined);
    }

    const d = data as { reply?: unknown; sources?: unknown; grounded?: unknown } | null;
    if (!d || typeof d.reply !== 'string' || !d.reply.trim()) throw new ChatError('invalid_response', FALLBACK_MESSAGES.invalid_response);
    return {
      reply: d.reply,
      sources: Array.isArray(d.sources) ? d.sources.filter(isSource) : [],
      grounded: d.grounded === true,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// ---------------------------------------------------------------------------
// Tarixçə: yalnız bu brauzer sessiyasında (sessionStorage). Serverdə və ya Supabase-də saxlanılmır;
// tab bağlananda silinir. Uğursuz mesajlar saxlanılmır.
// ---------------------------------------------------------------------------
export function loadHistory(): ChatMsg[] {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: ChatMsg[] = [];
    for (const m of parsed) {
      if (!m || typeof m !== 'object') continue;
      const { id, role, content, ts, sources, grounded } = m as Partial<ChatMsg>;
      if (typeof id !== 'string' || (role !== 'user' && role !== 'assistant') || typeof content !== 'string' || typeof ts !== 'number') continue;
      out.push({
        id, role, content: content.slice(0, 6000), ts,
        ...(role === 'assistant' ? { sources: Array.isArray(sources) ? sources.filter(isSource) : [], grounded: grounded === true } : {}),
      });
    }
    return out.slice(-MAX_STORED);
  } catch {
    return [];
  }
}

export function saveHistory(messages: ChatMsg[]): void {
  try {
    const keep = messages.filter((m) => !m.failed).slice(-MAX_STORED);
    if (keep.length === 0) globalThis.sessionStorage?.removeItem(STORAGE_KEY);
    else globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(keep));
  } catch { /* storage dolu/bloklanıb: söhbət işləməyə davam edir */ }
}

export function clearHistory(): void {
  try { globalThis.sessionStorage?.removeItem(STORAGE_KEY); } catch { /* sakit */ }
}

export const SUGGESTIONS = [
  'Sosial iş nədir?',
  'Sosial işçinin etik prinsipləri hansılardır?',
  'Bu mövzunu sadə dildə izah et.',
  'İmtahana hazırlaşmaq üçün mənə suallar hazırla.',
] as const;
