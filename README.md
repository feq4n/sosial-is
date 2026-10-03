# Sosial İş

Azərbaycan Dövlət Pedaqoji Kollecinin Sosial iş şöbəsinin tələbələri üçün platforma: elanlar, tədris materialları, dərs cədvəli, tədbirlər, şəxsi tələbə kabineti və admin paneli. İnterfeys Azərbaycan dilindədir.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router 7 · Motion · Lucide · React Hook Form · Firebase (Auth + Firestore)

## Quraşdırma və lokal işə salma

```bash
npm install
cp .env.example .env     # Firebase dəyərlərini doldurun
npm run dev              # http://localhost:3000
```

`.env` doldurulmasa sayt elan, material və tədbirlər üçün **nümunə məzmunla** açılır (“Nümunə məzmun” xəbərdarlığı ilə). Dərs cədvəli nümunə deyil, rəsmi Excel faylından gəlir və Firebase olmadan da işləyir. Giriş, qeydiyyat, əlaqə formu, kabinet və admin paneli yalnız Firebase qoşulduqda işləyir; qoşulmayıbsa aydın xəta göstərilir.

## Firebase qurulumu (bir dəfəlik)

1. [Firebase Console](https://console.firebase.google.com)-da layihə yaradın və **Web app** əlavə edin; verilən dəyərləri `.env` faylına yazın.
2. **Authentication → Sign-in method** bölməsində *Email/Password*-u aktivləşdirin.
3. **Firestore Database** yaradın (production mode).
4. Təhlükəsizlik qaydalarını yerləşdirin:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add            # layihənizi seçin
   firebase deploy --only firestore:rules,firestore:indexes
   ```
5. **İlk admini təyin edin.** Rol interfeysdən və ya qeydiyyatdan verilə bilməz (qaydalar buna icazə vermir). Sayta qeydiyyatdan keçin, sonra Firebase Console → Firestore → `users/{uid}` sənədində `role` sahəsini `admin` edin. Sonrakı rolları admin paneldən (“İstifadəçilər”) verə bilərsiniz.
6. **Authentication → Settings → Authorized domains** siyahısına Vercel domeninizi əlavə edin.

### Rollar
| Rol | İcazə |
|---|---|
| `student` | Kabinet, yadda saxlama, qeydlər, tədbirə qeydiyyat |
| `editor` | + elan, material, tədbir idarəetməsi |
| `admin` | + istifadəçi rolları, əlaqə mesajları |

İcazələr `firestore.rules` faylında **serverdə** yoxlanılır; interfeysdəki gizlətmə yalnız rahatlıq üçündür.

## Dərs cədvəli

Cədvəl rəsmi Excel faylından (hər iki növbə vərəqi) oxunur və `src/data/timetable.json` faylına çevrilir. Yeni cədvəl gəldikdə:

```bash
pip install openpyxl
python3 scripts/import-timetable.py "cədvəl.xlsx" 2026/2027 payız
npm test
firebase deploy --only firestore:rules
```

- Skript ixtisas, qrup, kurs, növbə, gün, dərs, saat, fənn, müəllim və otaqları oxuyur; qrupun ixtisas, kurs və növbəsi yalnız cədvəldən götürülür.
- “XXX” kimi qeydlər olduğu kimi saxlanılır, saytda “Fənn hələ təyin olunmayıb” kimi göstərilir. Boş xanalar doldurulmur.
- İxtisasların tam adları `scripts/specialty-names.json` faylında yalnız təsdiqlənmiş olduqda yazılır; qalanları kodla göstərilir.
- Skript `firestore.rules` daxilindəki `groupMap()` siyahısını da yeniləyir. Qeydiyyatda və profildə ixtisas-qrup əlaqəsi serverdə bu siyahı ilə yoxlanılır, buna görə qaydalar yenidən yerləşdirilməlidir.
- İstifadəçinin `users/{uid}` sənədində yalnız `specialty` və `group` saxlanılır; kurs və növbə cədvəldən hesablanır. Köhnə sənədlərdəki `degree` və `course` sahələri silinmir, istifadə olunmur. Qrupu seçilməmiş mövcud istifadəçilər profildə ixtisas və qrup seçməlidir.

## Test və yoxlama

```bash
npm run lint    # tsc --noEmit
npm test        # vitest (utils + bütün route-lar, qorunan səhifələr, rol yoxlamaları, form validasiyası)
npm run build
```

> Firestore qaydalarının real emulyatorda sınanması bu repoda avtomatlaşdırılmayıb — `firebase emulators:start` ilə əl ilə yoxlayın.

## Vercel-ə yerləşdirmə

1. Repozitoriyanı Vercel-ə qoşun (Framework: Vite; `vercel.json` hazırdır, SPA yönləndirməsi və təhlükəsizlik başlıqları daxildir).
2. **Environment Variables** bölməsinə `.env.example`-dakı bütün `VITE_*` dəyərlərini əlavə edin. İstəyə görə `SITE_URL=https://sizin-domen` — təyin edilərsə build zamanı `sitemap.xml` yaradılır.
3. Deploy edin. Vercel yalnız frontend-i yayımlayır; Firebase (Auth, Firestore, qaydalar) yuxarıdakı addımlarla ayrıca qurulmalıdır.

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
  services/     content (CRUD), personal, users, contact
  types/ utils/ lib/ config/
scripts/        import-timetable.py, specialty-names.json, generate-seo.mjs
```

## Məzmun haqqında

- “İxtisas haqqında” səhifəsindəki mətnlər ümumi təsvirdir; şöbəyə aid rəsmi məlumatlar `src/data/content.ts`-də yenilənməlidir.
- Materiallar fayl yükləmə əvəzinə **https keçidi** kimi əlavə olunur (Firebase Storage ödənişli plan tələb etdiyi üçün). Yalnız `https://` keçidlər açılır.
- Rəsmi əlaqə məlumatları `VITE_CONTACT_*` dəyişənləri ilə göstərilir; boşdursa, göstərilmir.

## Təhlükəsizlik qeydləri

- Repoda məxfi açar yoxdur; `.env` Git-ə əlavə edilmir. Firebase web konfiqurasiyası açıq məlumatdır, qoruma Firestore qaydaları ilədir.
- Əlaqə formu `contact_messages`-ə yazır: hər kəs göndərə bilər (sahə uzunluqları qaydalarda yoxlanılır), yalnız admin oxuya bilər. Kütləvi spam üçün sonradan Firebase App Check əlavə etmək məsləhətdir.
- Axtarış sistemləri üçün `robots.txt` kabinet/admin/auth yollarını bağlayır, həmin səhifələr `noindex` meta və `X-Robots-Tag` ilə də qorunur.
