import { useEffect } from 'react';
import { SITE_NAME } from '@/config/site';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useSeo(title: string, description?: string, opts: { noindex?: boolean } = {}) {
  useEffect(() => {
    const full = title === SITE_NAME ? SITE_NAME : `${title} · ${SITE_NAME}`;
    document.title = full;
    setMeta('meta[property="og:title"]', 'property', 'og:title', full);
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }
    setMeta('meta[name="robots"]', 'name', 'robots', opts.noindex ? 'noindex, nofollow' : 'index, follow');
  }, [title, description, opts.noindex]);
}
