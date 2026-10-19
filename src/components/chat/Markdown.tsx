import { Fragment, type ReactNode } from 'react';

/**
 * AI cavabları üçün kiçik və TƏHLÜKƏSİZ Markdown renderer-i.
 * dangerouslySetInnerHTML istifadə olunmur: bütün mətn React node-ları kimi çıxır, xam HTML işləmir.
 * Dəstək: başlıqlar, siyahılar (iç-içə yox), kod blokları, sitat, sadə cədvəl, **qalın**, *kursiv*, `kod`, [mətn](http/https/mailto), [n] istinadları.
 */

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\((?:https?:\/\/[^\s)]+|mailto:[^\s)]+)\))|(\*[^*\s][^*\n]*\*)|(\[\d{1,2}\](?!\())/g;

function inline(text: string, depth = 0): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const tok = m[0];
    if (m[1]) {
      out.push(<code key={key++} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] text-ink">{tok.slice(1, -1)}</code>);
    } else if (m[2]) {
      out.push(<strong key={key++} className="font-bold">{depth < 2 ? inline(tok.slice(2, -2), depth + 1) : tok.slice(2, -2)}</strong>);
    } else if (m[3]) {
      const close = tok.indexOf('](');
      const label = tok.slice(1, close);
      const href = tok.slice(close + 2, -1);
      out.push(<a key={key++} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand underline underline-offset-2">{label}</a>);
    } else if (m[4]) {
      out.push(<em key={key++}>{depth < 2 ? inline(tok.slice(1, -1), depth + 1) : tok.slice(1, -1)}</em>);
    } else if (m[5]) {
      out.push(<span key={key++} className="mx-0.5 rounded bg-brand-soft px-1 text-[0.75em] font-bold text-brand align-baseline">{tok}</span>);
    }
    last = i + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const lines = (s: string) => s.split('\n').map((l, i, a) => <Fragment key={i}>{inline(l)}{i < a.length - 1 && <br />}</Fragment>);

const FENCE = /^\s*```\s*([\w+#.-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const UL = /^\s*[-*+•]\s+(.*)$/;
const OL = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function Markdown({ text, className }: { text: string; className?: string }) {
  const src = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < src.length) {
    const line = src[i];
    if (!line.trim()) { i++; continue; }

    const fence = line.match(FENCE);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < src.length && !FENCE.test(src[i])) code.push(src[i++]);
      i++; // bağlanış çəpəri (olmaya da bilər)
      blocks.push(
        <pre key={k++} className="my-2 overflow-x-auto rounded-xl border border-line bg-surface-2 p-3 text-[0.82rem] leading-relaxed" tabIndex={0} aria-label={fence[1] ? `${fence[1]} kod bloku` : 'Kod bloku'}>
          <code className="font-mono">{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const h = line.match(HEADING);
    if (h) {
      blocks.push(<p key={k++} role="heading" aria-level={h[1].length <= 2 ? 3 : 4} className="mb-1 mt-3 font-display text-[0.98rem] font-bold first:mt-0">{inline(h[2])}</p>);
      i++;
      continue;
    }

    if (line.includes('|') && i + 1 < src.length && TABLE_SEP.test(src[i + 1]) && src[i + 1].includes('-')) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < src.length && src[i].includes('|') && src[i].trim()) rows.push(cells(src[i++]));
      blocks.push(
        <div key={k++} className="my-2 overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-left text-[0.85rem]">
            <thead className="bg-surface-2"><tr>{head.map((c, j) => <th key={j} className="px-2.5 py-1.5 font-bold">{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri} className="border-t border-line">{head.map((_, j) => <td key={j} className="px-2.5 py-1.5 align-top">{inline(r[j] ?? '')}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (UL.test(line) || OL.test(line)) {
      const ordered = OL.test(line);
      const items: string[] = [];
      const re = ordered ? OL : UL;
      while (i < src.length && re.test(src[i])) {
        const m = src[i].match(re) as RegExpMatchArray;
        items.push(ordered ? m[2] : m[1]);
        i++;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={k++} className={ordered ? 'my-2 list-decimal space-y-1 pl-5' : 'my-2 list-disc space-y-1 pl-5'}>
          {items.map((it, j) => <li key={j} className="pl-0.5">{inline(it)}</li>)}
        </List>,
      );
      continue;
    }

    if (QUOTE.test(line)) {
      const q: string[] = [];
      while (i < src.length && QUOTE.test(src[i])) q.push((src[i++].match(QUOTE) as RegExpMatchArray)[1]);
      blocks.push(<blockquote key={k++} className="my-2 border-l-4 border-brand/40 pl-3 text-muted">{lines(q.join('\n'))}</blockquote>);
      continue;
    }

    const para: string[] = [];
    while (i < src.length && src[i].trim() && !FENCE.test(src[i]) && !HEADING.test(src[i]) && !UL.test(src[i]) && !OL.test(src[i]) && !QUOTE.test(src[i])) para.push(src[i++]);
    blocks.push(<p key={k++} className="my-2 first:mt-0 last:mb-0">{lines(para.join('\n'))}</p>);
  }

  return <div className={className}>{blocks}</div>;
}
