# Firebase → Supabase data miqrasiyası

Bu qovluq **birdəfəlik** köçürmə üçündür və əsas tətbiqdən ayrıdır (öz `package.json`-u var; tətbiqdə Firebase asılılığı yoxdur).
`migration/firebase-legacy/` içində köhnə `firestore.rules`, `firestore.indexes.json`, `firebase.json` arxiv kimi saxlanılıb (məlumat itirməmək və müqayisə üçün).

## Nə köçürülür
| Firestore | Supabase |
|---|---|
| Firebase Auth hesabları + `users/{uid}` | `auth.users` + `public.profiles` (rol, ad, pillə, kurs, qrup, yaranma tarixi saxlanılır) |
| `announcements`, `materials`, `events`, `schedule`, `contact_messages` | eyni adlı cədvəllər (`schedule` → `schedule_entries`) |
| `events/{id}/registrations/{uid}` | `event_registrations` |
| `users/{uid}/saved`, `notes`, `notificationReads` | `saved_materials`, `personal_notes`, `notification_reads` |

Köhnə ID-lər `firebase_id` / `firebase_uid` sütunlarında saxlanılır; yeni ID-lər UUID-dir. Əlaqələr (FK) və bildiriş açarları (`a-<id>`) yeni UUID-lərlə yenidən qurulur.

## Parollar haqqında (vacib)
Firebase parolları **dəyişdirilmiş scrypt** ilə heşlənir; Supabase yalnız bcrypt/argon2 qəbul edir və hazır GoTrue idxalı Firebase-scrypt-i dəstəkləmir. Bu skript parol heşlərini **köçürmir** və parolları heç vaxt açıq mətn kimi saxlamır:
- hər hesab təsadüfi, heç yerdə saxlanılmayan parolla yaradılır, e-poçt təsdiqlənmiş sayılır;
- istifadəçilər **“Şifrəni unutmusunuz?”** (və ya sizin göndərdiyiniz `--send-reset`) ilə yeni parol təyin edir.

Şifrəni saxlayaraq köçürmək istəsəniz, Supabase-in rəsmi `firebase-to-supabase` aləti + Firebase “password hash parameters” lazımdır və əvvəlcə bir neçə test hesabda yoxlanmalıdır; bu layihədə yoxlanılmayıb deyə istifadə olunmayıb.

## İşə salma
```bash
cd migration
npm install
cp .env.example .env      # doldurun; real .env Git-ə düşmür
set -a; source .env; set +a

npm test                  # skriptin testləri (Firebase/Supabase tələb etmir)
npm run dry-run           # Firebase-i OXUYUR, heç nə yazmır, problemləri göstərir
npm run apply             # köçürür, sonra sayları yoxlayır (təkrar işə salmaq təhlükəsizdir)
npm run verify            # yalnız Firebase ↔ Supabase say müqayisəsi
npm run send-reset        # köçürülmüş istifadəçilərə şifrə yeniləmə e-poçtu
npm run rollback          # (yalnız lazım olsa) köçürülmüşləri Supabase-dən silir
```
Hər işdə `backup/` qovluğunda Firestore-un yerli surəti və hesabat (`report-*.json`) yaranır (Git-ə düşmür). **Firebase-də heç nə silinmir və dəyişdirilmir**; yalnız oxuma sorğuları göndərilir.

## Tövsiyə olunan ardıcıllıq
1. Supabase sxemi quruldu (əsas README, addım 1–4).
2. `npm run dry-run` → problemlər siyahısını oxuyun (profilsiz hesablar, tarixsiz tədbirlər və s.).
3. `npm run apply` → cədvəl `OK` göstərməlidir. `FƏRQ!` varsa, `backup/report-*.json`-a baxın.
4. Saytı Supabase ilə yoxlayın (giriş, rol, admin paneli).
5. Öz SMTP-nizi qoşun, sonra `npm run send-reset`.
6. Hər şey təsdiqlənənədək Firebase layihəsini **silməyin**.
