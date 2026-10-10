// build-dən əvvəl (prebuild) robots.txt və sitemap.xml yaradır. Marşrut siyahısı AppRoutes.tsx-dən oxunur.
// Saytın ünvanı sabitdir (SITE_URL mühit dəyişəni ilə dəyişdirilmir ki, yanlış domen sitemap-a düşməsin).
import { writeFileSync, mkdirSync } from 'node:fs';
import { readPublicRoutes, ROUTE_META } from './seo-routes.mjs';

export const SITE_URL = 'https://sosial-is.info';

const routes = readPublicRoutes();
const lastmod = new Date().toISOString().slice(0, 10); // build tarixi (UTC)

mkdirSync('public', { recursive: true });

const robots = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /admin',
  'Disallow: /dashboard',
  'Disallow: /f/',
  'Disallow: /login',
  'Disallow: /register',
  'Disallow: /forgot-password',
  'Disallow: /reset-password',
  '',
  `Sitemap: ${SITE_URL}/sitemap.xml`,
];
writeFileSync('public/robots.txt', robots.join('\n') + '\n');

const urls = routes.map((r) => {
  const { changefreq, priority } = ROUTE_META[r] ?? { changefreq: 'monthly', priority: '0.5' };
  const loc = r === '/' ? `${SITE_URL}/` : `${SITE_URL}${r}`;
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
});
writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
console.log(`[seo] robots.txt və sitemap.xml yaradıldı (${SITE_URL}, ${routes.length} səhifə: ${routes.join(', ')}; lastmod ${lastmod})`);
