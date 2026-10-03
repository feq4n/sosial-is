// robots.txt və sitemap.xml yaradır. SITE_URL (və ya Vercel-in VERCEL_PROJECT_PRODUCTION_URL dəyişəni) varsa sitemap də yazılır.
import { writeFileSync, mkdirSync } from 'node:fs';

const raw = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
const site = raw.replace(/\/+$/, '');
const publicRoutes = ['/', '/announcements', '/materials', '/schedule', '/events', '/about', '/contact'];

mkdirSync('public', { recursive: true });

const robots = ['User-agent: *', 'Allow: /', 'Disallow: /dashboard', 'Disallow: /admin', 'Disallow: /login', 'Disallow: /register', 'Disallow: /forgot-password'];
if (site) robots.push('', `Sitemap: ${site}/sitemap.xml`);
writeFileSync('public/robots.txt', robots.join('\n') + '\n');

if (site) {
  const urls = publicRoutes.map((r) => `  <url><loc>${site}${r === '/' ? '/' : r}</loc></url>`).join('\n');
  writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  console.log(`[seo] robots.txt və sitemap.xml yaradıldı (${site})`);
} else {
  console.log('[seo] SITE_URL təyin edilməyib: yalnız robots.txt yaradıldı, sitemap.xml buraxıldı.');
}
