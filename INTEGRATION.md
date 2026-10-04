# Formlar: portalın daxilində (OpnForm lazım deyil)

Əvvəlki variantda formlar ayrıca OpnForm (Laravel + Nuxt + Docker) xidməti idi və ikinci layihə/server tələb edirdi. İndi formlar **portalın özündədir**: React + Supabase + Vercel. İkinci layihə, Docker, PHP, `FORMS_*` mühit dəyişənləri, Vercel funksiyaları (`api/`) və bilet/körpü kodu **yoxdur**.

## Qurulum (2 addım)
1. Supabase SQL Editor-də `supabase/migrations/20261004000003_native_forms.sql` faylını bir dəfə işə salın (əvvəlki migration-lar artıq işə salınıbsa, yalnız bunu).
2. Vercel-ə əvvəlki kimi deploy edin. Yeni mühit dəyişəni **yoxdur**.

İlk admin əvvəlki kimi `profiles.role = 'admin'` ilə təyin olunur → **Admin → Formlar → Yeni form**.

## Nə var
Sual növləri (mətn, uzun mətn, ədəd, e-poçt, tarix, bir/çox seçim, 1–5 qiymət), məcburi sual, qaralama/dərc/bağlanıb, son tarix, auditoriya (hamı / ixtisas / qrup), önizləmə, paylaşım linki `/f/<kod>`, cavab cədvəli, seçim üzrə statistika, CSV ixracı.

## Təhlükəsizlik
- Hər qayda serverdədir (Postgres RLS + `submit_form` funksiyası); interfeys yalnız rahatlıqdır.
- Rol yalnız `profiles.role`-dan oxunur. Yalnız `admin` form yarada/dəyişə/silə və cavabları oxuya bilər (redaktor da yox).
- Tələbə yalnız dərc olunmuş **və öz ixtisas/qrupuna aid** formu görür. İxtisası/qrupu olmayan tələbə məhdud formları görmür və doldura bilmir.
- `submit_form`: giriş tələb edir; auditoriyanı profildən yoxlayır; son tarix və statusu yoxlayır; hər cavabı sualın təyininə görə yoxlayır (məcburilik, variant, tarix, e-poçt, 1–5, uzunluq); təyində olmayan açarları atır; bir tələbə yalnız bir dəfə doldura bilər. Cavab cədvəlinə birbaşa yazmaq mümkün deyil.
- Anonimlik: `form_responses`-da istifadəçi identifikatoru yoxdur və vaxt saata yuvarlaqlaşdırılır; «kim doldurub» ayrıca cədvəldədir və admin onu oxuya bilmir. Qeyd: bu, sıx qrupda (məs. bir nəfərlik auditoriya) və ya DB-yə birbaşa girişi olan şəxsə qarşı tam anonimlik deyil.
- CSV: Excel düstur inyeksiyasına qarşı `= + - @` ilə başlayan mətnlərin əvvəlinə `'` qoyulur.
- Form və sual strukturu DB trigger-i ilə də yoxlanılır (naməlum növ, təkrar açar, boş sual, uydurma ixtisas/qrup rədd edilir).

## Faylar
Yeni: `supabase/migrations/20261004000003_native_forms.sql`, `src/lib/forms.ts`, `src/components/forms/FormRenderer.tsx`, `src/pages/admin/{FormEditor,FormResponses}.tsx`, testlər `tests/forms-{lib,service,pages}.test*`, `supabase/tests/rls_smoke.sql`-ə əlavə testlər.
Dəyişən: `src/services/forms.ts`, `src/pages/admin/Forms.tsx`, `src/pages/dashboard/Forms.tsx`, `src/pages/public/FormEntry.tsx`, `src/routes/AppRoutes.tsx`, `src/utils/errors.ts`, `vercel.json`, `tsconfig.json`, `.env.example`, `README.md`, `robots.txt`.
Silinən: `api/` (körpü funksiyaları), `tests/forms-bridge.test.ts`, `.env.example`-dakı `FORMS_*`. `OpnForm-sosial-is-fork.zip` artıq lazım deyil, silə bilərsiniz.

## Yoxlama vəziyyəti (birləşdirmədən sonra)
**İcra olunub:** `npm install`, `npm run lint` (xətasız), `npm test` (10 fayl, 177 test keçdi, formlar daxil), `npm run build` (uğurlu), `supabase/tests/run-local-pg.sh` (bütün miqrasiyalar ardıcıllıqla, 213 RLS yoxlaması keçdi, formlar daxil).
**İcra olunMAYIB:** real Supabase/Vercel, brauzerdə vizual yoxlama, `migration/` alt-layihəsinin testləri.

## Qəbul yoxlaması
1. Migration işə düşür, RLS testləri keçir.
2. Admin → Formlar → Yeni form → 3 sual, auditoriya «yalnız KŞŞİ25/01SB», status «Dərc olunub» → Saxla → Linki kopyala.
3. `KŞŞİ25/01SB` tələbəsi linki açıb dolduru; ikinci dəfə «artıq doldurmusunuz» görür. `Sİ` tələbəsi «Form tapılmadı» görür.
4. Admin → Cavablar: sətir görünür, tələbə adı yoxdur; CSV Excel-də düzgün açılır.
5. Mobil görünüş və tünd rejim.
