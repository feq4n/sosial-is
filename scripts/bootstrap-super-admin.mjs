#!/usr/bin/env node
/**
 * Super Admin hesabını yaradır/təyin edir (bir dəfəlik, lokal işlədilir).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPER_ADMIN_PASSWORD='...' node scripts/bootstrap-super-admin.mjs
 *
 * - service_role açarı yalnız bu əmrin mühit dəyişənində olur; fayla yazılmır, frontend-ə (VITE_*) verilmir.
 * - Parol kodda saxlanılmır: SUPER_ADMIN_PASSWORD ilə verilir (hesab artıq varsa lazım deyil).
 * - Hesab artıq varsa yenidən yaradılmır; yalnız public.bootstrap_super_admin() çağırılır (idempotent).
 */
import { createClient } from '@supabase/supabase-js';

const EMAIL = 'feqangerayli@gmail.com';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SUPER_ADMIN_PASSWORD;

if (!url || !key) {
  console.error('SUPABASE_URL və SUPABASE_SERVICE_ROLE_KEY təyin edilməyib.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const created = password
  ? await sb.auth.admin.createUser({ email: EMAIL, password, email_confirm: true, user_metadata: { first_name: 'Feqan', last_name: 'Gəraylı' } })
  : { error: { message: 'no-password' } };

if (created.error && !/already|registered|exists|no-password/i.test(created.error.message)) {
  console.error('Hesab yaradıla bilmədi:', created.error.message);
  process.exit(1);
}
if (created.error?.message === 'no-password') console.log('Parol verilməyib: yalnız mövcud hesab təyin ediləcək.');
else if (created.error) console.log('Hesab artıq mövcuddur.');
else console.log('Hesab yaradıldı (e-poçt təsdiqlənmiş).');

const { data, error } = await sb.rpc('bootstrap_super_admin');
if (error) { console.error('bootstrap_super_admin xətası:', error.message); process.exit(1); }

const msg = {
  promoted: 'Super Admin təyin edildi.',
  exists: 'Super Admin artıq təyin olunub, heç nə dəyişmədi.',
  missing: 'Hesab tapılmadı: parolu verib yenidən işlədin.',
  unconfirmed: 'Hesabın e-poçtu təsdiqlənməyib: təsdiqləyib yenidən işlədin.',
  'no-profile': 'Hesab var, profil sətri yoxdur.',
};
console.log(msg[data] ?? data);
process.exit(data === 'promoted' || data === 'exists' ? 0 : 1);
