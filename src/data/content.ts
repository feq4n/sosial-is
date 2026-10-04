// Yalnız ehtiyat (fallback) məzmun: Supabase qoşulmayıbsa göstərilir. Real məzmun admin panelindən (faq_items) idarə olunur.
// İxtisas məlumatları src/data/specialties.ts (və Supabase `specialties` cədvəli) mənbəsindədir.

export const faq = [
  { q: 'Platformadan istifadə üçün qeydiyyat vacibdirmi?', a: 'Elanlar, materiallar, dərs cədvəli, tədbirlər və ixtisaslar haqqında məlumat hər kəs üçün açıqdır. Materialları yadda saxlamaq, bildirişləri görmək, şəxsi qeydlər yazmaq və tədbirlərə qeydiyyatdan keçmək üçün hesab lazımdır.' },
  { q: 'Qeydiyyat zamanı hansı məlumatlar tələb olunur?', a: 'Ad, soyad, e-poçt ünvanı, ixtisas, qrup və şifrə. Hesab “Tələbə” rolu ilə açılır; redaktor və admin səlahiyyətini yalnız admin verə bilər. E-poçt təsdiqi tələb olunarsa, poçtunuza gələn keçidlə hesabı təsdiqləyib sonra daxil olun.' },
  { q: 'İxtisas və qrupumu necə seçim və ya dəyişim?', a: 'Qeydiyyatda əvvəlcə ixtisası, sonra həmin ixtisasa aid qrupu seçirsiniz. Sonradan dəyişmək üçün kabinetdə “Profil” səhifəsini açın, ixtisas və qrupu yenidən seçib dəyişiklikləri saxlayın.' },
  { q: 'Növbələr (I və II növbə) necə müəyyən olunur?', a: 'Növbə qrupun rəsmi dərs cədvəlindən götürülür, onu ayrıca seçmək lazım deyil. Qrupunuzu seçdikdən sonra növbəniz kabinetdə göstərilir. “Dərs cədvəli” səhifəsində filtrdən I və ya II növbəni seçib həmin növbənin qruplarına da baxa bilərsiniz.' },
  { q: 'Dərs cədvəlimi harada görə bilərəm?', a: '“Dərs cədvəli” səhifəsində ixtisas, növbə, qrup və gün üzrə filtr edə bilərsiniz. Profilinizdə qrup seçilibsə, səhifə qrupunuzla açılır, ana səhifədəki “Bu gün” bölməsində isə bugünkü dərslər göstərilir. Kabinetdəki “Şəxsi cədvəl” bölməsində günlərə şəxsi qeydlər də əlavə edə bilərsiniz.' },
  { q: 'Tədris materiallarını necə tapım və endirim?', a: '“Materiallar” səhifəsində axtarışdan, fənn, növ və ixtisas filtrlərindən istifadə edin. Fayl kimi yüklənmiş materialda “Endir”, xarici keçid kimi əlavə olunmuş materialda “Aç” düyməsi var. Daxil olduqdan sonra materialı yadda saxlayıb kabinetdəki “Saxlanılanlar” bölməsindən tez tapa bilərsiniz.' },
  { q: 'Elanlardan və bildirişlərdən necə xəbərdar olum?', a: 'Yeni elanlar ana səhifədə və “Elanlar” səhifəsində görünür. Daxil olduqdan sonra son elanlar və yaxınlaşan tədbirlər kabinetdəki “Bildirişlər” bölməsində oxunmamış kimi işarələnir. Bildirişlər yalnız saytın daxilində göstərilir, e-poçtla göndərilmir.' },
  { q: 'Tədbirə necə qeydiyyatdan keçim?', a: '“Tədbirlər” səhifəsində tədbiri açın. Tədbir üçün qeydiyyat açıqdırsa, daxil olduqdan sonra “Tədbirə qeydiyyatdan keç” düyməsi görünür; qeydiyyatı eyni yerdən ləğv edə bilərsiniz.' },
  { q: 'Profil məlumatlarımı və şifrəmi necə dəyişim?', a: 'Kabinetdə “Profil” səhifəsində adınızı, soyadınızı, ixtisas və qrupunuzu yeniləyə bilərsiniz. E-poçt ünvanı və rol profildən dəyişdirilmir. Şifrəni dəyişmək üçün həmin səhifədəki düyməyə basın: e-poçtunuza yeniləmə keçidi göndəriləcək.' },
  { q: 'Şifrəmi unutmuşam, nə etməliyəm?', a: '“Daxil ol” səhifəsində “Şifrəni unutmusunuz?” keçidinə basıb e-poçtunuzu yazın; şifrəni yeniləmək üçün keçid göndəriləcək. Mesaj gəlməsə, spam qovluğunu yoxlayın.' },
  { q: 'Saytda texniki problem və ya səhv görsəm necə bildirim?', a: '“Əlaqə” səhifəsindəki formada problemi, hansı səhifədə baş verdiyini və varsa xəta mesajını yazın; mesajınız administratorlara çatır. Yanlış elan, material və ya cədvəl məlumatını da eyni yolla bildirə bilərsiniz.' },
];

export const advantages = [
  { title: 'Hər şey bir yerdə', text: 'Elan, cədvəl, material və tədbir üçün ayrı-ayrı yerləri axtarmağa ehtiyac qalmır.' },
  { title: 'Şəxsi kabinet', text: 'Yadda saxladığınız materiallar, qeydləriniz və bildirişləriniz yalnız sizə görünür.' },
  { title: 'Telefonda rahat', text: 'Cədvəl və elanlar kiçik ekranlar üçün ayrıca tərtib olunub.' },
  { title: 'Aydın və təhlükəsiz', text: 'Məlumatlara giriş icazələri serverdə yoxlanılır; yalnız lazım olan məlumat toplanır.' },
];
