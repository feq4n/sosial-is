import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Check, Copy, RotateCcw, Sparkles, SquarePen, Trash2, TriangleAlert, X } from 'lucide-react';
import { cx } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { CHAT_PUBLIC } from '@/config/site';
import { Markdown } from './Markdown';
import {
  ChatError, MAX_MESSAGE_CHARS, SUGGESTIONS, clearHistory, formatTime, loadHistory, newId, saveHistory, sendChat,
  type ChatMsg,
} from '@/lib/chat';

/** Çatın göstərilmədiyi yollar: admin paneli, giriş/qeydiyyat və formlar. */
const HIDDEN = [/^\/admin(\/|$)/, /^\/(login|register|forgot-password|reset-password)$/, /^\/f\//, /^\/dashboard\/forms\//];

const GREETING = 'Salam! Mən Sosial İş AI-yam, sosial iş üzrə tədris köməkçisi. Mövzuları izah edə, imtahana hazırlığa kömək edə və saytdakı materiallardan mənbə göstərə bilərəm. AI səhv edə bilər, vacib məlumatı yoxlayın.';

function TypingIndicator() {
  return (
    <div role="status" className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3">
      <span className="sr-only">Sosial İş AI yazır…</span>
      {[0, 1, 2].map((d) => (
        <span key={d} aria-hidden className="size-2 animate-bounce rounded-full bg-muted motion-reduce:animate-none" style={{ animationDelay: `${d * 140}ms` }} />
      ))}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40">
      {children}
    </button>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* köhnə üsula keç */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function AssistantMessage({ m, isLast, busy, onRegenerate }: { m: ChatMsg; isLast: boolean; busy: boolean; onRegenerate: () => void }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    setState((await copyText(m.content)) ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };

  return (
    <div className="flex max-w-[92%] flex-col items-start gap-1">
      <div className="rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-[0.92rem] leading-relaxed text-ink">
        <Markdown text={m.content} />
      </div>

      {m.sources && m.sources.length > 0 ? (
        <div className="w-full rounded-xl border border-line px-3 py-2 text-xs" aria-label="Mənbələr">
          <p className="mb-1 font-bold text-muted">Mənbələr</p>
          <ul className="space-y-0.5">
            {m.sources.map((s) => (
              <li key={s.id}>
                <Link to={`/materials/${s.id}`} className="font-semibold text-brand underline-offset-2 hover:underline">
                  [{s.n}] {s.title}
                </Link>
                {s.pages.length > 0 && <span className="text-muted"> (səh. {s.pages.join(', ')})</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        m.grounded === false && <p className="px-1 text-xs text-muted">Saytın materiallarında mənbə tapılmadı; cavab ümumi biliyə əsaslanır.</p>
      )}

      <div className="flex items-center gap-0.5 px-1 text-xs text-muted">
        <span>{formatTime(m.ts)}</span>
        <IconBtn label={state === 'copied' ? 'Kopyalandı' : 'Cavabı kopyala'} onClick={copy}>
          {state === 'copied' ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </IconBtn>
        {isLast && <IconBtn label="Cavabı yenidən yarat" onClick={onRegenerate} disabled={busy}><RotateCcw className="size-4" aria-hidden /></IconBtn>}
        <span className="sr-only" role="status">{state === 'copied' ? 'Cavab kopyalandı' : state === 'failed' ? 'Kopyalamaq alınmadı' : ''}</span>
        {state === 'failed' && <span aria-hidden className="text-danger">Kopyalanmadı</span>}
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const { pathname } = useLocation();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(false);

  // Hələlik yalnız admin və super admin; digərləri düyməni görür, amma çat açılmır (server də eyni qaydanı tətbiq edir)
  const { role, profile } = useAuth();
  const canChat = CHAT_PUBLIC || role === 'admin' || profile?.isSuperAdmin === true;

  const busyRef = useRef(false);
  const ctrlRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => { if (canChat) saveHistory(messages); }, [messages, canChat]);
  useEffect(() => { if (!canChat) { setOpen(false); ctrlRef.current?.abort(); } }, [canChat]);
  useEffect(() => {
    if (!notice) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setNotice(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notice]);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) launcherRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const grow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  /** Verilmiş tarixçə ilə cavab alır. Paralel sorğu (busyRef) və təkrar klik bloklanır. */
  const run = useCallback(async (history: ChatMsg[]) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const last = history[history.length - 1];
    try {
      const r = await sendChat(history, ctrl.signal);
      setMessages((cur) => [...cur, { id: newId(), role: 'assistant', content: r.reply, ts: Date.now(), sources: r.sources, grounded: r.grounded }]);
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;
      const msg = e instanceof ChatError ? e.message : 'Gözlənilməz xəta baş verdi. Yenidən cəhd edin.';
      setMessages((cur) => cur.map((m) => (m.id === last.id ? { ...m, failed: true, error: msg } : m)));
    } finally {
      if (ctrlRef.current === ctrl) { ctrlRef.current = null; busyRef.current = false; setBusy(false); }
    }
  }, []);

  const send = (raw: string) => {
    const content = raw.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS || busyRef.current) return;
    const history: ChatMsg[] = [...messages.filter((m) => !m.failed), { id: newId(), role: 'user', content, ts: Date.now() }];
    setMessages(history);
    setInput('');
    requestAnimationFrame(grow);
    void run(history);
  };

  const retry = (id: string) => {
    if (busyRef.current) return;
    const idx = messages.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const history = messages.slice(0, idx + 1).map((m) => (m.id === id ? { ...m, failed: false, error: undefined } : m));
    setMessages(history);
    void run(history);
  };

  const regenerate = () => {
    if (busyRef.current) return;
    const last = messages[messages.length - 1];
    if (last?.role !== 'assistant') return;
    const history = messages.slice(0, -1);
    setMessages(history);
    void run(history);
  };

  /** Davam edən sorğunu ləğv edir, mesajları silir. */
  const reset = (focus: boolean) => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    busyRef.current = false;
    setBusy(false);
    setMessages([]);
    clearHistory();
    if (focus) { setInput(''); requestAnimationFrame(() => { grow(); inputRef.current?.focus(); }); }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  if (HIDDEN.some((re) => re.test(pathname))) return null;

  const empty = messages.length === 0;
  const lastMsg = messages[messages.length - 1];
  const over = input.length > MAX_MESSAGE_CHARS - 200;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        aria-label={open ? 'Sosial İş AI söhbətini bağla' : 'Sosial İş AI söhbətini aç'}
        aria-expanded={canChat ? open : notice}
        aria-controls={canChat ? panelId : `${panelId}-notice`}
        onClick={() => (canChat ? setOpen((o) => !o) : setNotice((n) => !n))}
        className={cx(
          'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[45] grid size-14 place-items-center rounded-full bg-brand text-brand-ink shadow-pop transition hover:brightness-110 active:scale-95 sm:right-6',
          open && 'max-sm:hidden',
        )}
      >
        {open ? <X className="size-6" aria-hidden /> : <Sparkles className="size-6" aria-hidden />}
      </button>

      <AnimatePresence>
        {!canChat && notice && (
          <motion.div
            id={`${panelId}-notice`}
            role="alertdialog"
            aria-label="Sosial İş AI hazırlıq mərhələsindədir"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)] right-4 z-[55] w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-4 text-ink shadow-pop sm:right-6"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-brand-ink" aria-hidden><Sparkles className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base font-bold leading-tight">Xidmət hazırlıq mərhələsindədir</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">Sosial İş AI köməkçisi hazırda sınaq mərhələsindədir və hələlik istifadəyə verilməyib. Yaxın vaxtda əlçatan olacaq.</p>
              </div>
              <IconBtn label="Bağla" onClick={() => setNotice(false)}><X className="size-5" aria-hidden /></IconBtn>
            </div>
          </motion.div>
        )}
        {canChat && open && (
          <motion.section
            id={panelId}
            role="dialog"
            aria-label="Sosial İş AI söhbəti"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-[55] flex flex-col overflow-hidden bg-surface text-ink sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-line sm:shadow-pop"
          >
            <header className="flex items-center gap-2 border-b border-line bg-brand-soft px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
              <span className="grid size-9 place-items-center rounded-full bg-brand text-brand-ink" aria-hidden><Sparkles className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-base font-bold leading-tight">Sosial İş AI</h2>
                <p className="truncate text-xs text-muted">Tədris köməkçisi · ADPK</p>
              </div>
              <IconBtn label="Yeni söhbət" onClick={() => reset(true)}><SquarePen className="size-[1.15rem]" aria-hidden /></IconBtn>
              <IconBtn label="Söhbəti təmizlə" onClick={() => reset(false)} disabled={empty && !busy}><Trash2 className="size-[1.15rem]" aria-hidden /></IconBtn>
              <IconBtn label="Söhbəti bağla" onClick={() => setOpen(false)}><X className="size-5" aria-hidden /></IconBtn>
            </header>

            <div ref={listRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="Söhbət" className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4">
              {empty && (
                <div className="space-y-3">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-[0.92rem] leading-relaxed">{GREETING}</div>
                  <ul className="flex flex-wrap gap-2" aria-label="Nümunə suallar">
                    {SUGGESTIONS.map((s) => (
                      <li key={s}>
                        <button type="button" onClick={() => send(s)} disabled={busy}
                          className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm font-semibold text-brand transition hover:bg-brand-soft disabled:opacity-50">
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {messages.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
                  className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {m.role === 'user' ? (
                    <div className="flex max-w-[88%] flex-col items-end gap-1">
                      <div className={cx('whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-3.5 py-2.5 text-[0.92rem] leading-relaxed', m.failed ? 'bg-danger-soft text-ink' : 'bg-brand text-brand-ink')}>{m.content}</div>
                      <div className="flex items-center gap-1 px-1 text-xs text-muted">
                        <span>{formatTime(m.ts)}</span>
                      </div>
                      {m.failed && (
                        <div role="alert" className="flex flex-wrap items-center justify-end gap-2 text-xs text-danger">
                          <TriangleAlert className="size-4 shrink-0" aria-hidden />
                          <span>{m.error}</span>
                          <button type="button" onClick={() => retry(m.id)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 font-bold text-ink hover:bg-surface-2 disabled:opacity-50">
                            <RotateCcw className="size-3.5" aria-hidden />Yenidən göndər
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <AssistantMessage m={m} isLast={m === lastMsg} busy={busy} onRegenerate={regenerate} />
                  )}
                </motion.div>
              ))}

              {busy && <TypingIndicator />}
            </div>

            <form
              className="border-t border-line bg-surface px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5"
              onSubmit={(e) => { e.preventDefault(); send(input); }}
            >
              <div className="flex items-end gap-2">
                <label htmlFor={`${panelId}-input`} className="sr-only">Mesajınız</label>
                <textarea
                  id={`${panelId}-input`}
                  ref={inputRef}
                  value={input}
                  rows={1}
                  maxLength={MAX_MESSAGE_CHARS}
                  placeholder="Sualınızı yazın…"
                  onChange={(e) => { setInput(e.target.value); grow(); }}
                  onKeyDown={onKeyDown}
                  className="max-h-36 min-h-11 flex-1 resize-none rounded-xl border border-field-line bg-field px-3 py-2.5 text-[0.95rem] text-ink placeholder:text-placeholder"
                />
                <button type="submit" aria-label="Göndər" disabled={busy || !input.trim()}
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink transition hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none">
                  <ArrowUp className="size-5" aria-hidden />
                </button>
              </div>
              <p className="mt-1.5 flex justify-between gap-2 text-[0.7rem] leading-snug text-muted">
                <span>Şəxsi məlumat yazmayın. Söhbət yalnız bu brauzer sessiyasında saxlanılır.</span>
                {over && <span className="shrink-0 font-semibold text-ink" aria-live="polite">{input.length}/{MAX_MESSAGE_CHARS}</span>}
              </p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
