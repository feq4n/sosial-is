# Sosial İş AI: tədris köməkçisi

Saytın sağ aşağı küncündə açılan çat köməkçisi. Sosial iş üzrə sualları Azərbaycan dilində cavablandırır (türk, ingilis, rus dilində yazana həmin dildə cavab verir) və saytdakı tədris materiallarından **mənbə** göstərir.

## Arxitektura

```
Brauzer (ChatWidget)  ──POST /api/chat──▶  Vercel Function (api/chat.ts)
                                             │ 1. Origin, content-type, ölçü, tezlik yoxlaması
                                             │ 2. Mesajların doğrulanması (yalnız user/assistant)
                                             │ 3. Supabase RPC search_material_chunks  (anon açar + RLS)
                                             │ 4. Groq chat/completions  (GROQ_API_KEY yalnız burada)
                                             ▼
                                   { reply, sources[], grounded }
```

- **Provayder: Groq.** OpenAI uyğun API-dir, sürətlidir, Vercel Function ilə problemsiz işləyir. Model `GROQ_MODEL` ilə dəyişdirilir (defolt `openai/gpt-oss-120b`; reasoning modeli olduğu üçün `reasoning_effort: low` və `include_reasoning: false` ilə çağırılır, token limiti 1500). Groq-un model siyahısı tez-tez dəyişir, model köhnəlsə yalnız bu dəyişəni yeniləyin.
- **Axın (streaming) yoxdur.** Cavab tam gəlir, gözləyərkən "yazır…" göstəricisi çıxır. Bu, Vercel Function-da sadə və etibarlıdır, ləğvetmə və xəta idarəsi aydın qalır. Lazım olsa sonradan SSE əlavə etmək olar.
- **RAG: Postgres tam mətn axtarışı (MVP).** Groq embedding modeli vermir, `pgvector` üçün ayrıca embedding provayderi və açarı lazım olardı. Azərbaycan dili suffiksli olduğu üçün axtarış sualdakı sözlərin 4 hərflik kökləri ilə və diakritiksiz (`işçi` = `isci`) aparılır. `search_material_chunks` funksiyasının imzası dəyişmədən sonradan vektor axtarışı ilə əvəz edilə bilər.
- **Mənbələr:** yalnız cavabda həqiqətən `[1]`, `[2]` kimi istinad edilən sənədlər göstərilir (ad, fənn, səhifə, `/materials/:id` keçidi). Mənbə tapılmasa interfeys və model bunu açıq bildirir.

## Yeni və dəyişən fayllar

**Yeni**
- `api/chat.ts`: server endpoint-i (özünə yetərli bir fayldır, nisbi import yoxdur).
- `src/lib/chat.ts`: müştəri kitabxanası (API çağırışı, xəta xəritəsi, sessiya tarixçəsi).
- `src/components/chat/ChatWidget.tsx`, `src/components/chat/Markdown.tsx`: interfeys və təhlükəsiz Markdown renderer (HTML işlətmir).
- `supabase/migrations/20261009000001_material_chunks.sql`: `material_chunks` cədvəli, RLS, `az_fold`, `search_material_chunks`.
- `scripts/ingest-materials.mjs`, `scripts/rag-extract.mjs`, `scripts/rag-chunk.mjs`: PDF/DOCX/TXT-dən mətn çıxarma və parçalama.
- Testlər: `tests/chat-api.test.ts`, `chat-lib.test.ts`, `chat-markdown.test.tsx`, `chat-widget.test.tsx`, `rag-chunk.test.ts`, `rag-extract.test.ts`; `supabase/tests/rls_smoke.sql`-ə 17 yoxlama.

**Dəyişən** (minimal)
- `src/App.tsx`: çat lazy yüklənir (ayrıca ~7 kB gzip chunk, ilk yükə təsir etmir).
- `vercel.json`: `/api/` SPA rewrite-dan çıxarıldı, `api/chat.ts` üçün `maxDuration: 30`, `/api/*` üçün `Cache-Control: no-store`.
- `tsconfig.json`: `api/` tip yoxlamasına daxil edildi.
- `tests/setup.ts`: `window` yoxdursa (Node mühitində işləyən API testləri) brauzer təqlidləri keçilir.
- `.env.example`: boş server dəyişənləri. `package.json`: ingest skripti üçün devDependencies (`pdfjs-dist`, `mammoth`, `jszip`).

Mövcud login, qeydiyyat, RLS qaydaları, materials cədvəli və mövcud testlərə toxunulmayıb.

## Quraşdırma və deploy (3 addım)

### 1. Supabase
SQL Editor-də `supabase/migrations/20261009000001_material_chunks.sql` faylını bir dəfə işə salın (əvvəlki miqrasiyalar artıq işə salınıbdırsa yalnız bunu).

### 2. Vercel mühit dəyişənləri
Vercel → Project → Settings → Environment Variables (Production və Preview):

| Dəyişən | Dəyər | Qeyd |
|---|---|---|
| `GROQ_API_KEY` | `gsk_...` | https://console.groq.com/keys. **VITE_ prefiksi olmasın.** |
| `GROQ_MODEL` | məs. `openai/gpt-oss-120b` | İstəyə bağlı; boş olarsa defolt işləyir |
| `CHAT_ALLOWED_ORIGINS` | boş | İstəyə bağlı: sayt ünvanından başqa Origin-lər (vergüllə) |

Mövcud `VITE_SUPABASE_URL` və `VITE_SUPABASE_PUBLISHABLE_KEY` funksiya tərəfindən də oxunur, yeni Supabase dəyişəni lazım deyil. Dəyişənlər əlavə olunandan sonra **yenidən deploy** edin.

### 3. Materialların mətnini çıxarın (RAG)
Öz kompüterinizdə (serverdə yox):

```bash
npm install
export SUPABASE_URL="https://<layihə>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role açarı>"   # yalnız bu terminalda, heç bir fayla yazmayın
node scripts/ingest-materials.mjs --dry-run     # əvvəlcə yoxlama
node scripts/ingest-materials.mjs               # hələ emal olunmamış materiallar
```

Yeni material yükləndikdə skripti təkrar işə salın (`--reindex` hamısını yenidən emal edir, `--material <uuid>` birini). Dəstəklənir: PDF (səhifə nömrəsi ilə), DOCX, TXT. DOC/PPT/XLS/ZIP atlanır. Skan edilmiş (şəkil) PDF-dən mətn çıxmır, skript bunu bildirir. Yalnız link olan materiallar ad/fənn/təsvirinə görə tapılır.

`service_role` açarı yalnız bu skriptdə, yalnız lokal terminalda istifadə olunur: Vercel-ə və ya Git-ə yazmayın.

### Lokal inkişaf
`npm run dev` (Vite) `/api/chat`-ı işlətmir, çat "xidmət əlçatan deyil" göstərir. Tam yoxlama üçün `npx vercel dev` istifadə edin (`GROQ_API_KEY` lokal mühitdə və ya `.env.local`-da, Git-ə düşmür).

## Təhlükəsizlik və limitlər

- Groq açarı yalnız `process.env.GROQ_API_KEY`-də, yalnız `api/chat.ts` daxilində oxunur; brauzerə, bundle-a və cavablara düşmür. Xəta cavablarında açar, stack trace, provayder cavabı yoxdur; loglara yalnız status kodu yazılır.
- Müştəridən yalnız `user`/`assistant` mesajları qəbul olunur (`system` rədd edilir). Mesaj ≤ 2000 simvol, tarixçə ≤ 10 mesaj, gövdə ≤ 40 KB, cavab ≤ 700 token, Groq timeout 25 san.
- **Tezlik limiti:** IP üzrə dəqiqədə 8, saatda 60 sorğu. Limit **bir Function instansının yaddaşındadır**, serverless-də "best effort" qoruyucudur. Ciddi sui-istifadədən qorunmaq üçün əlavə edin: Vercel → Firewall → Rate Limiting qaydası (`/api/chat`) və Groq konsolunda xərc/limit təyin edilməsi.
- Başqa saytdan gələn brauzer sorğuları (`Origin`) rədd edilir.
- Sənəd mətnləri və istifadəçi mesajları etibarsız giriş sayılır: sistem təlimatı onlardakı əmrlərə tabe olmamağı tələb edir, kontekst `<kontekst>` ilə ayrılır və içindəki bağlayıcı teq silinir. Bu, prompt injection riskini azaldır, tam aradan qaldırmır.
- **RLS və giriş:** axtarış publishable açarla, çağıranın RLS-i altında işləyir. `material_chunks` yalnız `materials` sətri görünən olduqda oxunur və yalnız `service_role` yaza bilir (anon, tələbə və hətta redaktor yaza bilmir, SQL testləri ilə təsdiqlənib). Hazırda `materials` cədvəli və `materials` bucket-i hamıya açıqdır, ona görə də RAG-a yalnız onsuz da ictimai olan məzmun düşür. Özəl tələbə faylları, admin məlumatları və formlar bu sistemə daxil deyil. **Gələcəkdə materialları məhdud girişli etsəniz**, `/api/chat` anon açarla işlədiyi üçün parçalar da avtomatik gizlənəcək, amma `ingest-materials.mjs` bütün faylları oxuyur: məhdud faylları skriptdən kənarda saxlamaq lazımdır.
- **Tarixçə:** söhbət yalnız bu brauzer tabının `sessionStorage`-ində saxlanılır (tab bağlananda silinir, serverə/Supabase-ə yazılmır). Səhifə yenilənəndə bərpa olunur; "Söhbəti təmizlə" və "Yeni söhbət" silir. Şəxsi məlumat yazmamaq barədə xəbərdarlıq composer-in altındadır.
- Çat admin paneli, giriş/qeydiyyat və form səhifələrində göstərilmir.

## İnterfeys

Sağ aşağıda açıb-bağlanan düymə; mobil telefonda tam ekran, masaüstündə 400 px pəncərə. Ağ-yaşıl dizayn tokenləri və tünd rejim qorunur. Salamlaşma və 4 nümunə sual, vaxt damğası, "yazır…" göstəricisi, Enter ilə göndərmə / Shift+Enter ilə yeni sətir, Markdown (başlıq, siyahı, kod bloku, cədvəl), cavabı kopyalama, cavabı yenidən yaratma, uğursuz mesajı yenidən göndərmə, paralel sorğunun bloklanması, aydın xəta mesajları. Əlçatanlıq: `role="dialog"`, `aria-live` jurnal, Escape ilə bağlama və fokusun düyməyə qaytarılması, klaviatura ilə tam idarə, `prefers-reduced-motion`.

## Yoxlama vəziyyəti

**İcra olunub:** `npm test` (19 fayl, **277 test** keçdi: 224 mövcud + 53 yeni), `npm run build` (uğurlu), `supabase/tests/run-local-pg.sh` (bütün miqrasiyalar ardıcıllıqla, bütün RLS yoxlamaları keçdi, yeni 17 daxil), PDF/DOCX/TXT mətn çıxarma real fayl formatları üzərində.

**İcra olunMAYIB:** real Groq açarı ilə canlı cavab, real Supabase/Vercel mühiti, brauzerdə və telefonda vizual yoxlama, Azərbaycan dilində cavab keyfiyyətinin canlı qiymətləndirilməsi. Bunları deploy-dan sonra aşağıdakı siyahı ilə yoxlayın.

**Əvvəldən mövcud problem:** `npm run lint` `src/lib/firebase.ts`-də 3 xəta verir (`firebase` paketi `package.json`-da yoxdur, fayl heç yerdə import olunmur, köhnə miqrasiya qalığıdır). Bu dəyişikliklə əlaqəsi yoxdur; faylı silmək və ya `firebase`-i əlavə etmək kifayətdir.

## Deploy-dan sonra qəbul yoxlaması

1. Sayt açılır, sağ aşağıda yaşıl düymə var; klik edəndə salamlaşma və 4 sual çıxır.
2. "Sosial iş nədir?" cavab verir (Azərbaycan dilində, Markdown düzgün).
3. Ingest-dən sonra materialın mövzusunda sual verin: cavabda `[1]` və altında "Mənbələr" (səhifə ilə) görünür; materiallarda olmayan mövzuda "mənbə tapılmadı" qeydi çıxır.
4. `GROQ_API_KEY`-i müvəqqəti silsəniz: "Süni intellekt xidməti hazırda aktiv deyil" (açar və ya texniki detal yoxdur).
5. DevTools → Network və səhifə mənbəyində `gsk_` axtarın: tapılmamalıdır.
6. Telefonda: pəncərə tam ekran, klaviatura açılanda yazı sahəsi görünür, Daxil ol/Qeydiyyat/Materiallar işləyir.
7. Admin panelində çat düyməsi görünmür.
