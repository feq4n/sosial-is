import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { OG_IMAGE_ALT, OG_IMAGE_URL, PRIVATE_PATH_RE, SITE_NAME, SITE_URL } from '@/config/site';
import { useSiteSettings } from '@/services/site';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Marşrutun mütləq (canonical) ünvanı: sorğu parametrləri və son “/” olmadan. */
export function canonicalUrl(pathname: string) {
  const path = pathname.replace(/\/+$/, '');
  return `${SITE_URL}${path || '/'}`;
}

export function useSeo(title: string, description?: string, opts: { noindex?: boolean } = {}) {
  const { siteName } = useSiteSettings();
  const { pathname } = useLocation();
  const noindex = Boolean(opts.noindex) || PRIVATE_PATH_RE.test(pathname);
  useEffect(() => {
    const full = title === SITE_NAME || title === siteName ? siteName : `${title} · ${siteName}`;
    const url = canonicalUrl(pathname);
    document.title = full;
    setMeta('meta[property="og:title"]', 'property', 'og:title', full);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', full);
    setMeta('meta[property="og:url"]', 'property', 'og:url', url);
    setMeta('meta[property="og:image"]', 'property', 'og:image', OG_IMAGE_URL);
    setMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', OG_IMAGE_ALT);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', OG_IMAGE_URL);
    setCanonical(url);
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
  }, [title, description, noindex, siteName, pathname]);
}
