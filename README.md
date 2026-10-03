# Sosial İş

Sosial iş şöbəsinin tələbələri üçün platforma: elanlar, tədris materialları, dərs cədvəli, tədbirlər, şəxsi tələbə kabineti və admin paneli. İnterfeys Azərbaycan dilindədir.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router 7 · Motion · Lucide · React Hook Form · Supabase (Auth + PostgreSQL + RLS)

## Quraşdırma və lokal işə salma

```bash
npm install
cp .env.example .env     # VITE_SUPABASE_URL və VITE_SUPABASE_PUBLISHABLE_KEY dəyərlərini doldurun
npm run dev              # http://localhost:3000
```

`.env` doldurulmasa sayt **nümunə məzmunla** açılır (ictimai səhifələr üçün, “Nümunə məzmun” xəbərdarlığı ilə). Giriş, qeydiyyat, əlaqə formu, kabinet və admin paneli yalnız Supabase qoşulduqda işləyir; qoşulmayıbsa aydın xəta göstərilir.

## Supabase qurulumu (bir dəfəlik)

1. [supabase.com](https://supabase.com)-da layihə yaradın. **Project Settings → API** bölməsindən *Project URL* və *Publishable key*-i `.env`-ə yazın. `service_role`/secret açarını `.env`-ə **yazmayın**.
2. **SQL Editor**-də `supabase/migrations/20261003000001_initial_schema.sql` faylının məzmununu işə salın (və ya `supabase link` + `supabase db push`).
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
| `editor` | + elan, material, tədbir, cədvəl idarəetməsi |
| `admin` | + istifadəçi rolları, əlaqə mesajları |

İcazələr Postgres **Row Level Security** siyasətləri ilə (`supabase/migrations/`) serverdə yoxlanılır; interfeysdəki gizlətmə yalnız rahatlıq üçündür.

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
  data/         content.ts (redaktə edilən statik mətnlər), sample.ts (yalnız nümunə rejimi)
  hooks/        useAsync, useSeo, useSaved, useNotifications
  layouts/      PublicLayout, AppShell (Dashboard/Admin)
  pages/        public/ auth/ dashboard/ admin/
  routes/       AppRoutes, guards
  services/     db (ortaq), content (CRUD), profiles, personal, users, contact
  types/ utils/ lib/ config/
supabase/       migrations/ (SQL sxem + RLS), tests/ (RLS testləri)
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
