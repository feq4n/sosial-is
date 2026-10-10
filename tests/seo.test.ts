import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readPublicRoutes } from '../scripts/seo-routes.mjs';
import { OG_IMAGE_URL, PRIVATE_PATH_RE, SITE_URL } from '@/config/site';
import { canonicalUrl } from '@/hooks/useSeo';

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), 'utf-8');

describe('domen və metadata', () => {
  it('sayt ünvanı https://sosial-is.info və skriptdəki ünvanla eynidir', () => {
    expect(SITE_URL).toBe('https://sosial-is.info');
    expect(OG_IMAGE_URL).toBe('https://sosial-is.info/og-image.png');
    expect(read('scripts/generate-seo.mjs')).toContain("export const SITE_URL = 'https://sosial-is.info';");
  });

  it('canonical hər marşrut üçün mütləq ünvandır (sorğu parametrsiz, son “/” olmadan)', () => {
    expect(canonicalUrl('/')).toBe('https://sosial-is.info/');
    expect(canonicalUrl('/schedule')).toBe('https://sosial-is.info/schedule');
    expect(canonicalUrl('/schedule/')).toBe('https://sosial-is.info/schedule');
    expect(canonicalUrl('/announcements/abc')).toBe('https://sosial-is.info/announcements/abc');
  });

  it('index.html: başlıq, canonical, OG və Twitter teqləri', () => {
    const html = read('index.html');
    expect(html).toContain('<title>Sosial İş</title>');
    expect(html).toContain('<link rel="canonical" href="https://sosial-is.info/" />');
    expect(html).toContain('<meta property="og:url" content="https://sosial-is.info/" />');
    expect(html).toContain('<meta property="og:image" content="https://sosial-is.info/og-image.png" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toMatch(/<meta property="og:image:alt" content="[^"]+" \/>/);
    expect(html).toContain('<meta property="og:type" content="website" />');
    expect(html).toContain('<meta property="og:locale" content="az_AZ" />');
    expect(html).toContain('<meta property="og:site_name" content="Sosial İş" />');
    expect(html).toContain('<meta property="og:title" content="Sosial İş" />');
    expect(html).toContain('<meta name="twitter:title" content="Sosial İş" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain('<meta name="twitter:image" content="https://sosial-is.info/og-image.png" />');
    expect(html).not.toMatch(/Hub|vercel\.app|localhost|example\.(com|az)/i);
  });

  it('ikon bağlantıları mövcud fayllara yönəlir', () => {
    const html = read('index.html');
    for (const href of ['/favicon.ico', '/favicon-32.png', '/icon-192.png', '/apple-touch-icon.png']) {
      expect(html).toContain(`href="${href}"`);
      expect(existsSync(join(root, 'public', href))).toBe(true);
    }
    expect(html).not.toContain('favicon.svg');
    expect(existsSync(join(root, 'public/logo-profile.png'))).toBe(true);
    expect(existsSync(join(root, 'public/icon-512.png'))).toBe(true);
  });

  it('OG şəkli 1200x630 PNG-dir və 300 KB-dan böyük deyil', () => {
    const f = join(root, 'public/og-image.png');
    const buf = readFileSync(f);
    expect(buf.subarray(1, 4).toString()).toBe('PNG');
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
    expect(statSync(f).size).toBeLessThanOrEqual(300 * 1024);
  });
});

describe('sitemap və robots', () => {
  it('ictimai marşrutlar AppRoutes.tsx-dən oxunur; giriş, dashboard, admin və formlar daxil deyil', () => {
    const routes = readPublicRoutes();
    expect(routes).toEqual(['/', '/announcements', '/materials', '/schedule', '/events', '/about', '/staff', '/contact']);
    expect(routes.some((r) => PRIVATE_PATH_RE.test(r))).toBe(false);
  });

  it('prebuild skripti etibarlı sitemap.xml və robots.txt yaradır', () => {
    execFileSync('node', ['scripts/generate-seo.mjs'], { cwd: root });
    const xml = read('public/sitemap.xml');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(readPublicRoutes().map((r) => (r === '/' ? 'https://sosial-is.info/' : `https://sosial-is.info${r}`)));
    expect(locs.every((l) => l.startsWith('https://sosial-is.info/'))).toBe(true);
    expect([...xml.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)]).toHaveLength(locs.length);
    expect([...xml.matchAll(/<changefreq>[a-z]+<\/changefreq>/g)]).toHaveLength(locs.length);
    expect([...xml.matchAll(/<priority>[01]\.\d<\/priority>/g)]).toHaveLength(locs.length);
    expect(xml).not.toMatch(/login|register|forgot|dashboard|admin|\/f\//);

    const robots = read('public/robots.txt').split('\n');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Sitemap: https://sosial-is.info/sitemap.xml');
  });

  it('şəxsi yollar noindex sayılır', () => {
    for (const p of ['/admin', '/admin/users', '/dashboard', '/dashboard/profile', '/login', '/register', '/forgot-password', '/reset-password', '/f/abc']) {
      expect(PRIVATE_PATH_RE.test(p)).toBe(true);
    }
    for (const p of ['/', '/schedule', '/announcements', '/about', '/contact', '/staff', '/formlar']) {
      expect(PRIVATE_PATH_RE.test(p)).toBe(false);
    }
  });
});

describe('vercel.json', () => {
  const cfg = JSON.parse(read('vercel.json'));
  const rewrite = new RegExp(`^${cfg.rewrites[0].source}$`);

  it('SPA rewrite statik faylları və /assets-i tutmur, marşrutları tutur', () => {
    for (const f of ['/sitemap.xml', '/robots.txt', '/og-image.png', '/favicon.ico', '/favicon-32.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/logo-profile.png', '/assets/index-abc.js']) {
      expect(rewrite.test(f)).toBe(false);
    }
    for (const r of ['/', '/schedule', '/announcements/abc', '/admin/users', '/f/abc']) expect(rewrite.test(r)).toBe(true);
    expect(cfg.rewrites[0].destination).toBe('/index.html');
  });

  it('şəxsi yollar üçün X-Robots-Tag noindex göndərilir', () => {
    const noindex = cfg.headers.filter((h: { headers: { key: string; value: string }[] }) => h.headers.some((x) => x.key === 'X-Robots-Tag' && /noindex/.test(x.value))).map((h: { source: string }) => h.source);
    expect(noindex).toEqual(expect.arrayContaining(['/dashboard/:path*', '/admin/:path*', '/login', '/register', '/forgot-password', '/reset-password', '/f/:path*']));
  });
});
