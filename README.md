# Sosial İş

Azərbaycan Dövlət Pedaqoji Kollecinin Sosial iş şöbəsinin tələbələri üçün platforma: elanlar, tədris materialları, dərs cədvəli, tədbirlər, şəxsi tələbə kabineti və admin paneli. İnterfeys Azərbaycan dilindədir.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router 7 · Motion · Lucide · React Hook Form · Supabase (Auth + PostgreSQL + RLS)

## Quraşdırma və lokal işə salma

```bash
npm install
cp .env.example .env     # VITE_SUPABASE_URL və VITE_SUPABASE_PUBLISHABLE_KEY dəyərlərini doldurun
npm run dev              # http://localhost:3000
```

`.env` doldurulmasa sayt elan, material və tədbirlər üçün **nümunə məzmunla** açılır (“Nümunə məzmun” xəbərdarlığı ilə). Dərs cədvəli nümunə deyil, rəsmi Excel faylından gəlir və Supabase olmadan da işləyir. Giriş, qeydiyyat, əlaqə formu, kabinet və admin paneli yalnız Supabase qoşulduqda işləyir; qoşulmayıbsa aydın xəta göstərilir.

## Supabase qurulumu (bir dəfəlik)

1. [supabase.com](https://supabase.com)-da layihə yaradın. **Project Settings → API** bölməsindən *Project URL* və *Publishable key*-i `.env`-ə yazın. `service_role`/secret açarını `.env`-ə **yazmayın**.
2. **SQL Editor**-də `supabase/migrations/` qovluğundakı faylları **tarix ardıcıllığı ilə** işə salın: `20261003000001_initial_schema.sql`, sonra `20261004000001_adpk_placement.sql` (və ya `supabase link` + `supabase db push`). Birinci fayl artıq işə salınıbsa, yalnız ikincisini işə salın; mövcud profillər qorunur.
3. **Authentication → Sign In / Providers → Email** aktiv olsun. **E-poçt təsdiqi** (Confirm email) açıqdırsa, qeydiyyatdan sonra istifadəçiyə təsdiq mesajı göstərilir.
4. **Authentication → URL Configuration**: *Site URL* = saytın ünvanı; *Redirect URLs* siyahısına `https://SAYT/login` və `https://SAYT/reset-password` (və lokal üçün `http://localhost:3000/**`) əlavə edin.
5. **İlk admini təyin edin.** Rol interfeysdən və ya qeydiyyatdan verilə bilməz. Sayta qeydiyyatdan keçin, sonra **SQL Editor**-də:
   ```sql
   update public.profiles set role = 'admin' where email = 'sizin@eposta.az';
   ```
   Sonrakı rolları admin paneldən (“İstifadəçilər”) verə bilərsiniz.
6. Real istifadəçilərə e-poçt göndərmək üçün **Authentication → SMTP Settings**-də öz SMTP serverinizi qoşun (daxili xidmətin saatlıq limiti çox azdır).

Köhnə Firebase məlumatını köçürmək üçün `migration/README.md`-yə baxın.

### Rollar
| Rol | İcazə |
|---|---|
| `student` | Kabinet, yadda saxlama, qeydlər, tədbirə qeydiyyat |
| `editor` | + elan, material, tədbir idarəetməsi |
| `admin` | + istifadəçi rolları, əlaqə mesajları |

İcazələr Postgres **Row Level Security** siyasətləri ilə (`supabase/migrations/`) serverdə yoxlanılır; interfeysdəki gizlətmə yalnız rahatlıq üçündür.

## Dərs cədvəli

Cədvəl rəsmi Excel faylından (hər iki növbə vərəqi) oxunur və `src/data/timetable.json` faylına çevrilir. Yeni cədvəl gəldikdə:

```bash
pip install openpyxl
python3 scripts/import-timetable.py "cədvəl.xlsx" 2026/2027 payız
npm test
# Supabase SQL Editor-də işə salın (təkrar işlətmək təhlükəsizdir):
#   supabase/seed/groups.sql
```

- Skript ixtisas, qrup, kurs, növbə, gün, dərs, saat, fənn, müəllim və otaqları oxuyur; qrupun ixtisas, kurs və növbəsi yalnız cədvəldən götürülür.
- “XXX” kimi qeydlər olduğu kimi saxlanılır, saytda “Fənn hələ təyin olunmayıb” kimi göstərilir. Boş xanalar doldurulmur.
- İxtisasların tam adları `scripts/specialty-names.json` faylında yalnız təsdiqlənmiş olduqda yazılır; qalanları kodla göstərilir.
- Skript `supabase/seed/groups.sql` faylını da yeniləyir. Qeydiyyatda və profildə ixtisas-qrup əlaqəsi serverdə `public.groups` cədvəli (composite FK + tətik) ilə yoxlanılır, buna görə həmin SQL yenidən işlədilməlidir. Siyahıdan çıxan qruplar silinmir, `active=false` olur: köhnə profillər qalır, amma yeni seçim/qeydiyyat üçün qəbul edilmir. `npm test` seed-in `timetable.json` ilə üst-üstə düşdüyünü yoxlayır.
- İstifadəçinin `profiles` sətrində yalnız `specialty` və `group_name` saxlanılır; kurs və növbə cədvəldən hesablanır. Köhnə `degree` və `course` sütunları silinmir, istifadə olunmur və müştəri onları dəyişə bilməz. Qrupu seçilməmiş mövcud istifadəçilər profildə ixtisas və qrup seçməlidir.
- `schedule_entries` cədvəli (köhnə admin cədvəli) tətbiqdə artıq istifadə olunmur; məlumat itməsin deyə saxlanılır.

## Test və yoxlama

```bash
npm run lint    # tsc --noEmit
npm test        # vitest (utils, servis qatı, AuthProvider, route-lar, qorunan səhifələr, rollar)
npm run build

# RLS siyasətləri (lokal PostgreSQL tələb edir):
sudo -u postgres bash supabase/tests/run-local-pg.sh
# Data miqrasiyası skriptinin testləri:
cd migration && npm install && npm test
```

> RLS testləri sadə PostgreSQL-də Supabase `auth` sxemini təqlid edir. Real Supabase layihəsində də qısa əl ilə yoxlama aparın (bax: hesabat).

## Vercel-ə yerləşdirmə

1. Repozitoriyanı Vercel-ə qoşun (Framework: Vite; `vercel.json` hazırdır, SPA yönləndirməsi və təhlükəsizlik başlıqları daxildir).
2. **Environment Variables** bölməsinə `.env.example`-dakı bütün `VITE_*` dəyərlərini əlavə edin. İstəyə görə `SITE_URL=https://sizin-domen` — təyin edilərsə build zamanı `sitemap.xml` yaradılır.
3. Deploy edin. Vercel yalnız frontend-i yayımlayır; Supabase yuxarıdakı addımlarla ayrıca qurulmalıdır.

## Struktur

```
src/
  components/   ui kit (ui/), cards, Toast, admin/CrudPage
  context/      Auth, Theme
  data/         timetable.json (rəsmi cədvəl, skriptlə yaradılır), timetable.ts, content.ts (statik mətnlər), sample.ts (yalnız nümunə rejimi)
  hooks/        useAsync, useSeo, useSaved, useNotifications
  layouts/      PublicLayout, AppShell (Dashboard/Admin)
  pages/        public/ auth/ dashboard/ admin/
  routes/       AppRoutes, guards
  services/     db (ortaq), content (CRUD), profiles, personal, users, contact
  types/ utils/ lib/ config/
scripts/        import-timetable.py, specialty-names.json, generate-seo.mjs
supabase/       migrations/ (SQL sxem + RLS), seed/groups.sql (qrup siyahısı), tests/ (RLS testləri)
migration/      birdəfəlik Firebase → Supabase data miqrasiyası (ayrı paket)
```

## Məzmun haqqında

- “İxtisas haqqında” səhifəsindəki mətnlər ümumi təsvirdir; şöbəyə aid rəsmi məlumatlar `src/data/content.ts`-də yenilənməlidir.
- Materiallar fayl yükləmə əvəzinə **https keçidi** kimi əlavə olunur (layihə fayl saxlama istifadə etmir). Yalnız `https://` keçidlər açılır.
- Rəsmi əlaqə məlumatları `VITE_CONTACT_*` dəyişənləri ilə göstərilir; boşdursa, göstərilmir.

## Təhlükəsizlik qeydləri

- Repoda məxfi açar yoxdur; `.env` Git-ə əlavə edilmir. Supabase URL və publishable açar açıq məlumatdır, qoruma RLS siyasətləri ilədir; `service_role` açarı brauzerə verilmir.
- Əlaqə formu `contact_messages`-ə yazır: hər kəs göndərə bilər (sahə uzunluqları CHECK məhdudiyyətləri ilə yoxlanılır), yalnız admin oxuya bilər. Kütləvi spam üçün sonradan CAPTCHA (Supabase Auth/Turnstile) və ya Edge Function ilə sürət limiti əlavə etmək məsləhətdir.
- Axtarış sistemləri üçün `robots.txt` kabinet/admin/auth yollarını bağlayır, həmin səhifələr `noindex` meta və `X-Robots-Tag` ilə də qorunur.
