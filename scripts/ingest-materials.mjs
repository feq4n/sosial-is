#!/usr/bin/env node
/**
 * Material fayllarından mətn çıxarır, parçalara bölür və public.material_chunks cədvəlinə yazır (Sosial İş AI RAG).
 *
 * İşə salmaq (YEREL kompüterdə, serverdə yox):
 *   export SUPABASE_URL="https://<layihə>.supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="<service_role açarı>"   # YALNIZ terminal mühitində; heç bir fayla və Git-ə yazmayın
 *   node scripts/ingest-materials.mjs                # mətni hələ çıxarılmamış materiallar
 *   node scripts/ingest-materials.mjs --reindex      # hamısını yenidən
 *   node scripts/ingest-materials.mjs --material <uuid>
 *   node scripts/ingest-materials.mjs --dry-run      # bazaya yazmadan yoxla
 *
 * Dəstəklənir: PDF (səhifə nömrəsi ilə), DOCX, TXT. Digər tiplər (doc, ppt, xls, zip) atlanır.
 * Yalnız ictimai "materials" bucket-indəki fayllar emal olunur (materials cədvəli və bucket onsuz da hamıya açıqdır).
 */
import { createClient } from '@supabase/supabase-js';
import { extract } from './rag-extract.mjs';

const BATCH = 100;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL və SUPABASE_SERVICE_ROLE_KEY mühit dəyişənləri təyin edilməlidir (yalnız terminalda, fayla yazmadan).');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let q = supabase.from('materials').select('id,title,file_path').not('file_path', 'is', null);
if (opt('--material')) q = q.eq('id', opt('--material'));
const { data: materials, error } = await q;
if (error) { console.error('Materiallar oxunmadı:', error.message); process.exit(1); }

let done = 0, skipped = 0, failed = 0;
for (const m of materials ?? []) {
  const ext = String(m.file_path).split('.').pop()?.toLowerCase() ?? '';
  try {
    if (!flag('--reindex') && !opt('--material')) {
      const { count } = await supabase.from('material_chunks').select('id', { count: 'exact', head: true }).eq('material_id', m.id);
      if (count) { skipped++; continue; }
    }
    const { data: blob, error: dErr } = await supabase.storage.from('materials').download(m.file_path);
    if (dErr || !blob) throw new Error(`yüklənmədi: ${dErr?.message ?? 'boş cavab'}`);
    const chunks = await extract(ext, new Uint8Array(await blob.arrayBuffer()));
    if (chunks === null) { console.log(`– ${m.title}: .${ext} tipi dəstəklənmir, atlandı`); skipped++; continue; }
    if (chunks.length === 0) { console.log(`! ${m.title}: mətn çıxarıla bilmədi (skan edilmiş şəkil ola bilər)`); failed++; continue; }
    if (flag('--dry-run')) { console.log(`✓ ${m.title}: ${chunks.length} parça (dry-run)`); done++; continue; }

    const del = await supabase.from('material_chunks').delete().eq('material_id', m.id);
    if (del.error) throw new Error(del.error.message);
    const rows = chunks.map((c, i) => ({ material_id: m.id, chunk_index: i, page: c.page, content: c.content }));
    for (let i = 0; i < rows.length; i += BATCH) {
      const ins = await supabase.from('material_chunks').insert(rows.slice(i, i + BATCH));
      if (ins.error) throw new Error(ins.error.message);
    }
    console.log(`✓ ${m.title}: ${rows.length} parça`);
    done++;
  } catch (e) {
    console.error(`✗ ${m.title}: ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}
console.log(`\nHazır: ${done} emal olundu, ${skipped} atlandı, ${failed} xəta/boş.`);
process.exit(failed ? 2 : 0);
