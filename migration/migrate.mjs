#!/usr/bin/env node
// Firebase (Auth + Firestore) → Supabase data miqrasiyası. Bax: migration/README.md
//   node migrate.mjs                 quru yoxlama (heç nə yazılmır, Supabase-ə qoşulmur)
//   node migrate.mjs --apply         köçür (təkrar işə salmaq təhlükəsizdir) və yoxla
//   node migrate.mjs --verify        yalnız sayları müqayisə et
//   node migrate.mjs --send-reset    köçürülmüş istifadəçilərə şifrə yeniləmə e-poçtu göndər
//   node migrate.mjs --rollback --yes  yalnız bu skriptlə köçürülmüşləri Supabase-dən sil
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { runMigration, rollback, sendResetEmails } from './lib/runner.mjs';

const args = new Set(process.argv.slice(2));
const die = (m) => { console.error(`XƏTA: ${m}`); process.exit(2); };
const env = (k) => process.env[k] || die(`${k} mühit dəyişəni təyin edilməyib (migration/.env.example-a baxın)`);

const mode = args.has('--apply') ? 'apply' : args.has('--verify') ? 'verify' : 'dry-run';
const needsSupabase = mode !== 'dry-run' || args.has('--send-reset') || args.has('--rollback');

let sb = null;
if (needsSupabase) {
  const { createClient } = await import('@supabase/supabase-js');
  const url = env('SUPABASE_URL');
  sb = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(`Hədəf Supabase: ${new URL(url).host}`);
}

if (args.has('--rollback')) {
  if (!args.has('--yes')) die('--rollback təsdiq tələb edir: --rollback --yes');
  await rollback({ sb });
  process.exit(0);
}
if (args.has('--send-reset')) {
  const site = env('SITE_URL').replace(/\/$/, '');
  const { failed } = await sendResetEmails({ sb, redirectTo: `${site}/reset-password` });
  if (failed.length) { console.error('Göndərilməyənlər:', failed); process.exit(1); }
  process.exit(0);
}

// ---- Firebase mənbəyi (YALNIZ OXUMA)
const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore } = await import('firebase-admin/firestore');
const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
initializeApp({ credential: cred ? cert(JSON.parse(readFileSync(cred, 'utf8'))) : applicationDefault() });
const fs = getFirestore();
const source = {
  async authUsers() {
    const out = []; let token;
    do {
      const page = await getAuth().listUsers(1000, token);
      out.push(...page.users.map((u) => ({ uid: u.uid, email: u.email ?? null, disabled: u.disabled })));
      token = page.pageToken;
    } while (token);
    return out;
  },
  async collection(name) { return (await fs.collection(name).get()).docs.map((d) => ({ id: d.id, data: d.data() })); },
  async subcollection(name) {
    return (await fs.collectionGroup(name).get()).docs.map((d) => ({ id: d.id, parentId: d.ref.parent.parent?.id ?? '', data: d.data() }));
  },
};

const groups = JSON.parse(readFileSync(new URL('../src/data/timetable.json', import.meta.url), 'utf8')).groups;
const result = await runMigration({ source, sb, mode, groups });

// ---- Bərpa üçün: Firebase məlumatının yerli surəti + hesabat (Git-ə düşmür)
mkdirSync(new URL('./backup/', import.meta.url), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const { snapshot, ...report } = result;
writeFileSync(new URL(`./backup/firestore-snapshot-${stamp}.json`, import.meta.url), JSON.stringify(snapshot, null, 2));
writeFileSync(new URL(`./backup/report-${mode}-${stamp}.json`, import.meta.url), JSON.stringify(report, null, 2));

console.log('\nSahə                  Firebase  Atlanan  Uğursuz  Gözlənilən  Supabase');
for (const v of result.verification) {
  console.log(`${v.area.padEnd(22)}${String(v.firebase).padStart(8)}${String(v.skipped).padStart(9)}${String(v.failed).padStart(9)}${String(v.expected).padStart(12)}${String(v.supabase).padStart(10)}  ${v.ok ? 'OK' : 'FƏRQ!'}`);
}
if (mode === 'dry-run') for (const [a, s] of Object.entries(result.stats)) console.log(`${a.padEnd(22)} mənbə=${s.source} atlanacaq=${s.skipped}`);
if (result.problems.length) {
  console.log(`\n${result.problems.length} problem (tam siyahı backup/report-*.json-da):`);
  for (const p of result.problems.slice(0, 50)) console.log(`  [${p.area}] ${p.id}: ${p.reason}`);
}
console.log(mode === 'dry-run' ? '\nQuru yoxlama bitdi: heç nə yazılmadı.' : result.ok ? '\nYoxlama uğurludur.' : '\nDİQQƏT: sayılarda fərq var. Firebase məlumatını SİLMƏYİN.');
process.exit(mode === 'dry-run' || result.ok ? 0 : 1);
