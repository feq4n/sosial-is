// AppRoutes.tsx-dən ictimai (sitemap-a düşən) marşrutları oxuyur: əl ilə siyahı saxlanılmır.
// Qayda: ilk <Route element={<PublicLayout />}> blokunun içində, dinamik hissəsi (:param, *) olmayan və
// <Navigate> yönləndirməsi olmayan marşrutlar. Giriş, qeydiyyat, dashboard, admin və /f/:slug bu blokda deyil.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function readPublicRoutes(file = join(ROOT, 'src/routes/AppRoutes.tsx')) {
  const src = readFileSync(file, 'utf8');
  const start = src.indexOf('<Route element={<PublicLayout />}>');
  if (start < 0) throw new Error('AppRoutes.tsx-də PublicLayout bloku tapılmadı');
  const end = src.indexOf('</Route>', start);
  const block = src.slice(start, end);
  const routes = [];
  for (const m of block.matchAll(/<Route\s+([^>]*?)\/>/g)) {
    const attrs = m[1];
    if (/element=\{<Navigate/.test(attrs)) continue;
    if (/\bindex\b/.test(attrs)) { routes.push('/'); continue; }
    const path = /path="([^"]+)"/.exec(attrs)?.[1];
    if (!path || /[:*]/.test(path)) continue;
    routes.push('/' + path.replace(/^\//, ''));
  }
  if (!routes.includes('/')) throw new Error('Ana səhifə marşrutu tapılmadı');
  return routes;
}

/** Marşrut üzrə dəyişmə tezliyi və prioritet. Siyahıda olmayan yeni marşrut “monthly / 0.5” alır. */
export const ROUTE_META = {
  '/': { changefreq: 'daily', priority: '1.0' },
  '/announcements': { changefreq: 'daily', priority: '0.9' },
  '/materials': { changefreq: 'weekly', priority: '0.8' },
  '/schedule': { changefreq: 'weekly', priority: '0.9' },
  '/events': { changefreq: 'weekly', priority: '0.7' },
  '/about': { changefreq: 'monthly', priority: '0.6' },
  '/staff': { changefreq: 'monthly', priority: '0.5' },
  '/contact': { changefreq: 'monthly', priority: '0.6' },
};
