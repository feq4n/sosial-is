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

- Skript ixtisas, qrup, növbə, gün, dərs, saat, fənn, müəllim və otaqları oxuyur; qrupun ixtisas və növbəsi yalnız cədvəldən götürülür.
- “XXX” kimi qeydlər olduğu kimi saxlanılır, saytda “Fənn hələ təyin olunmayıb” kimi göstərilir. Boş xanalar doldurulmur.
- İxtisasların tam adları `scripts/specialty-names.json` faylında yalnız təsdiqlənmiş olduqda yazılır; qalanları kodla göstərilir.
- Skript `supabase/seed/groups.sql` faylını da yeniləyir. Qeydiyyatda və profildə ixtisas-qrup əlaqəsi serverdə `public.groups` cədvəli (composite FK + tətik) ilə yoxlanılır, buna görə həmin SQL yenidən işlədilməlidir. Siyahıdan çıxan qruplar silinmir, `active=false` olur: köhnə profillər qalır, amma yeni seçim/qeydiyyat üçün qəbul edilmir. `npm test` seed-in `timetable.json` ilə üst-üstə düşdüyünü yoxlayır.
- İstifadəçinin `profiles` sətrində yalnız `specialty` və `group_name` saxlanılır; növbə cədvəldən hesablanır. Tələbə bileti nömrəsi və kurs saxlanılmır (aşağıdakı “Yeniləmə” bölməsinə baxın).
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
3. Deploy edin. Vercel yalnız frontend-i yayımlayır (serverless funksiya və ya ikinci layihə yoxdur); verilənlər bazası, giriş, fayllar və formlar Supabase-dədir.

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


## İxtisaslar (Sosial İş, KŞATS, KŞŞİ)

- Məlumat mənbəyi: `src/data/specialties.ts` (ilkin/fallback) və Supabase `public.specialties` cədvəli (`supabase/migrations/20261004000002_specialties.sql`). Sayt cədvəl varsa ondan, yoxdursa ilkin məlumatdan oxuyur.
- Qrup siyahısı mərkəzi `src/data/timetable.json` + `public.groups` cədvəlindədir (29 qrup: Sİ 12, KŞATS 6, KŞŞİ 11). Qeydiyyat və cədvəl filtrləri buradan qidalanır; əl ilə təkrarlanmır.
- Admin paneli → **İxtisaslar** (yalnız admin): ad, tam ad, kod, təsvir, müddət, semestr, kredit, qəbul balları, təsdiq bayrağı və aktivlik. Yeni ixtisas əlavə etmək SQL ilə aparılır (qruplara bağlıdır).
- Qəbul balları yalnız `admission_confirmed = true` olduqda göstərilir. Rəsmi mənbə: https://adpk.edu.az/tedris/ixtisaslar
- Yeni miqrasiyanı Supabase SQL Editor-də `20261004000001`-dən SONRA bir dəfə işə salın. Əvvəlki miqrasiyaları təkrar işlətməyin.


## Formlar (sorğu və qeydiyyat formları)

Tələbə göndərdiyi cavabları yalnız oxuya bilir (`/dashboard/forms`, `/dashboard/forms/:formId`); redaktə, silmə və yenidən göndərmə yoxdur. Bunun üçün `supabase/migrations/20261006000001_my_form_responses.sql` (yalnız `my_form_responses()` funksiyası; cədvəllər və məlumatlar dəyişmir) `20261005000006`-dan sonra işə salınmalıdır.

Ayrıca xidmət yoxdur: formlar portalın içində, Supabase cədvəllərində işləyir (`supabase/migrations/20261004000003_native_forms.sql`).

- **Admin → Formlar:** yeni form (başlıq, təsvir, suallar, status, son tarix), auditoriya (bütün tələbələr və ya seçilmiş ixtisas/qruplar), önizləmə, paylaşım linki, cavab cədvəli, xülasə və CSV ixracı.
- **Sual növləri:** qısa mətn, uzun mətn, ədəd, e-poçt, tarix, bir seçim (düymə/siyahı), çox seçim, qiymət (1–5). Hər sual məcburi ola bilər.
- **Tələbə:** Kabinet → Formlar (yalnız öz ixtisas/qrupuna açıq olanlar) və ya paylaşım linki `/f/<kod>` (giriş tələb ETMİR: qeydiyyatsız istifadəçi formu birbaşa doldurur, ad/e-poçt soruşulmur).
- **Təhlükəsizlik (hamısı serverdə, RLS + `submit_form`):** tələbə yalnız dərc olunmuş və öz auditoriyasına aid formu görür; cavab sualların təyininə görə yoxlanılır (məcburilik, variant, tarix, e-poçt, 1–5); qeydiyyatlı istifadəçi bir dəfə doldura bilər (qonağı təkrardan qorumaq mümkün deyil); qaralama və vaxtı bitmiş formlar qəbul olunmur; yalnız admin form yarada/dəyişə/cavablara baxa bilər.
- **Cavab verən:** girişli istifadəçinin cavabında `respondent_name`/`respondent_email` serverdə profildən yazılır və admin cavablar səhifəsində, CSV-də görünür. Giriş etməyən (qonaq) cavabı anonimdir: ad, soyad və e-poçt soruşulmur və saxlanılmır. Qonaq yalnız auditoriyası «hamı» olan formu görür; ixtisas/qrup üçün məhdud formlar giriş tələb edir. Əvvəlki cavablar anonim qalır.
- **Məhdudiyyət:** cavab tələbələrə göstərilmir; fayl yükləmə yoxdur; formu dərc etdikdən sonra sualları dəyişsəniz köhnə cavablar yeni suallarla uyğun gəlməyə bilər.

## Yeniləmə: Super Admin, admin tərəfindən idarə olunan məzmun, material faylları

### Miqrasiyalar (SQL Editor-də, ardıcıllıqla, hər biri bir dəfə)

0. `20261004000003_native_forms.sql` (formlar): `20261004000002_specialties.sql`-dən sonra işə salınır, aşağıdakılardan asılı deyil. Əvvəllər artıq işə salıbsınızsa, təkrar işə salmayın.
1. `20261005000001_detach_student_id_and_course.sql`: bilet nömrəsi yazılmasını dayandırır (məlumat silmir).
2. `20261005000002_super_admin.sql`: dəyişdirilməz Super Admin (RLS + tətiklər). Hesab hələ yoxdursa heç kimi yüksəltmir.
3. `20261005000003_site_content.sql`: `site_settings`, `faq_items`, `footer_links`, `team_members`, `team-photos` bucket-i. İlkin məlumat yalnız boş cədvələ yazılır.
4. `20261005000004_materials_files.sql`: material faylları (`materials` bucket-i, ixtisas/qrup sütunları). Mövcud materiallar toxunulmaz qalır.
5. Yeni frontend-i yerləşdirin (Vercel), yoxlayın, **sonra** `20261005000005_drop_legacy_profile_columns.sql`. Bu, `profiles.student_id` və `profiles.course` sütunlarını silir; dolu dəyərlər əvvəlcə `_legacy_profile_columns_backup` cədvəlinə köçürülür. Köhnə frontend sütunları hələ yazdığı üçün bu fayl frontend-dən ƏVVƏL işlədilməməlidir.

### Super Admin

- Hesab: `feqangerayli@gmail.com`, Supabase Auth-dakı real UID ilə tanınır (`profiles.is_super_admin`). E-poçt, rol və ya `user_metadata` heç vaxt Super Admin vermir.
- Hesab yoxdursa: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPER_ADMIN_PASSWORD='...' node scripts/bootstrap-super-admin.mjs`. Hesab artıq varsa və e-poçtu təsdiqlənibsə, SQL Editor-də `select public.bootstrap_super_admin();` kifayətdir. Parol heç yerdə saxlanılmır, `service_role` açarı frontend-ə verilmir.
- Qorunur: silinmə (`auth.users` cascade daxil), rol dəyişikliyi, deaktiv/ban, bayrağın dəyişdirilməsi, ikinci Super Admin. Qoruma SQL tətikləri ilə `service_role` üçün də tətbiq olunur. Yeganə yol: layihə sahibi SQL Editor-də `set local app.allow_super_admin_changes = 'on';` təyin edir (API müştəriləri bunu edə bilmir).

### Admin paneli

`/admin/site` (sayt adı, ana səhifə mətnləri, əlaqə, footer mətni), `/admin/faq`, `/admin/footer`, `/admin/team`, `/admin/materials` (fayl yükləmə). Bu bölmələrin yazma icazəsi yalnız `admin` rolundadır (materiallar: redaktor və admin). Developer qeydi (“Developed by Feqan Gəraylı”, https://feqan.dev) kodda sabitdir (`src/config/site.ts`), admin paneli onu dəyişə bilmir.

### Fayl yükləmə

Dəstəklənən tiplər: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, ZIP (≤ 25 MB); komanda şəkli: JPG, PNG, WEBP (≤ 2 MB). Yoxlama iki qatdadır: brauzerdə uzantı, MIME və faylın ilk baytları; serverdə Storage bucket-in ölçü/MIME limiti, `storage.objects` siyasətləri (rol, ad şablonu `<uuid>.<uzantı>`) və `materials` tətiyi (fayl mövcuddur, ölçü və MIME Storage-dən götürülür, uzantıya uyğundur). **Məhdudiyyət:** Storage MIME-i sorğu başlığından götürür və baytlara baxmır, ona görə bayt (magic bytes) yoxlaması yalnız brauzerdədir. Yalnız adminin/redaktorun yükləyə bildiyini nəzərə alsaq, risk aşağıdır; tam server tərəfi yoxlama üçün Edge Function lazımdır. Bucket-lər ictimai oxunur (materiallar da ictimaidir).

### Testlər

`bash supabase/tests/run-local-pg.sh` (lokal PostgreSQL; Super Admin, məzmun, Storage və material siyasətlərini əhatə edir), `npm test`, `npm run lint`, `cd migration && npm test`.

## Şöbə əməkdaşlarına mesaj göndərmə

Hər kəs (**qeydiyyat və ya giriş olmadan da**) `/contact` səhifəsində əməkdaşı seçib, yaxud `/staff` səhifəsində əməkdaşın kartındakı **«Mesaj göndər»** düyməsi ilə **konkret əməkdaşa** müraciət göndərə bilər. Hər iki yol eyni `StaffMessageForm` komponentindən və eyni `send_staff_message` RPC-sindən istifadə edir. Bu, chat deyil: realtime, əlavə fayl, e-poçt bildirişi yoxdur. Axın: əməkdaşı seç → ad və soyad → qrup → mövzu → mesaj → göndər → əməkdaş görsün → «Oxundu».

### Quraşdırma (bir dəfə)
1. SQL Editor-də `supabase/migrations/20261007000001_staff_messages.sql`, sonra `supabase/migrations/20261008000001_staff_messages_guest.sql` fayllarını işə salın (əvvəlki miqrasiyalardan sonra).
2. **Admin paneli → Şöbə əməkdaşları**: əməkdaşı redaktə edib **«Mesaj üçün hesab»** sahəsində onun hesabını (admin və ya redaktor rolu olan istifadəçi) seçin. Hesaba bağlı olmayan kartda «Mesaj göndər» düyməsi görünmür; mesaj ümumi şöbəyə yox, yalnız bu hesaba çatır. Bir hesab yalnız bir karta bağlana bilər.

### İstifadəçi tərəfi
- Giriş etmiş istifadəçi: ad və soyad (və profildə varsa qrup) profildən avtomatik doldurulur və dəyişdirilə bilmir; profildə qrup yoxdursa qrupu özü yazır. Mesajlarını **Kabinet → Göndərdiyim mesajlar** (`/dashboard/messages`) bölməsində görür: kimə, mövzu, tarix, status (Göndərildi / Oxundu) və tam mətn; redaktə, silmə və yönləndirmə yoxdur.
- Qonaq: ad və soyad, qrup, mövzu, mesaj və alıcı məcburidir; giriş və qeydiyyat tələb olunmur, tarixçə yoxdur, göndərildikdən sonra «Mesajınız göndərildi.» bildirişi göstərilir.
- Əməkdaş (admin/redaktor): **İdarəetmə paneli → Mesajlarım** (`/admin/inbox`). Oxunmamışlar fərqlənir və yan menyuda sayı görünür; mesaj açılanda avtomatik «Oxundu» olur. Mesajda göndərən, qrup, mövzu və tarix, sonra mesajın özü göstərilir; qonaq mesajı da anonim görünmür (ad və qrup məcburidir). Mövcud **Mesajlar** bölməsi (admin) sayt «Əlaqə» formundan gələn mesajlardır və dəyişməyib.

### Təhlükəsizlik (Postgres RLS + tətiklər; frontend-ə güvənilmir)
- Cədvələ birbaşa INSERT icazəsi yoxdur (nə `anon`, nə `authenticated`); yazmaq yalnız `public.send_staff_message(...)` RPC-si ilə olur. RPC-də `sender_id` parametri yoxdur: giriş etmiş istifadəçidə `auth.uid()`, qonaqda `NULL` olur, başqasının adından göndərmək olmaz.
- `status`, `read_at`, `created_at`, `sender_name`, `sender_group`, `recipient_name` serverdə (tətikdə) təyin olunur. Giriş etmiş istifadəçidə ad profildən götürülür, müştəri dəyəri nəzərə alınmır; qrup profildə varsa oradan, yoxdursa göndərilən dəyərdən. Qonaqda ad və qrup yoxlanılır (boş və ya yalnız boşluq olmaz, ad ≤ 100, qrup ≤ 50 simvol, ardıcıl boşluqlar birləşdirilir). Alıcı yoxlanır: hesaba bağlı **aktiv** kartın sahibi, rolu admin/editor, göndərən özü deyil.
- Snapshot: ad və qrup mesajın özündə saxlanır; profil sonradan dəyişsə köhnə mesaj dəyişmir.
- Sürət limiti: bir göndərən saatda ən çox 20 mesaj (giriş etmişdə `sender_id`, qonaqda ad və qrupdan hesablanan `sender_key` üzrə); qonaqlardan bir əməkdaşa ümumilikdə saatda ən çox 30 mesaj. IP/cihaz səviyyəsində qorunma üçün `staff_messages.client_key` sütunu və `public.staff_message_client_key()` funksiyası hazırdır (hazırda `NULL` qaytarır, limit onu avtomatik nəzərə alacaq). CAPTCHA yoxdur.
- Tələbə yalnız öz mesajlarını görür; UPDATE/DELETE icazəsi yoxdur. Əməkdaş yalnız ona göndəriləni görür və yeganə dəyişiklik `sent → read`-dir. Admin bütün mesajları görə və silə bilər (moderasiya).
- Limitlər: mövzu 3–150, mesaj 5–3000 simvol (həm interfeysdə, həm bazada).

### Gələcək e-poçt bildirişi
Əlavə sxem dəyişikliyi tələb olunmur: `staff_messages` üzərində `AFTER INSERT` tətiki və ya Supabase Database Webhook ilə `recipient_id → profiles.email` istifadə edilə bilər.

### Testlər
`supabase/tests/rls_smoke.sql` (kart bağlantısı, giriş etmiş və qonaq göndərməsi, saxta `sender_id`, validation, snapshot, icazələr, oxundu keçidi, sürət limitləri), `tests/staff-messages.test.tsx`, `tests/staff-messages-service.test.ts`, `tests/routes.test.tsx` (yeni marşrutların qorunması).
