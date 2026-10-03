import { NotConfiguredError } from '@/lib/supabase';

/** İstifadəçiyə texniki detalları göstərmədən, Azərbaycan dilində aydın mesaj qaytarır. */
export function friendlyError(err: unknown): string {
  if (err instanceof NotConfiguredError) {
    return 'Xidmət hələ qoşulmayıb. Sayt sahibi Supabase konfiqurasiyasını tamamlamalıdır.';
  }
  const e = (typeof err === 'object' && err ? err : {}) as { code?: unknown; name?: unknown; message?: unknown; status?: unknown };
  const code = e.code ? String(e.code) : '';
  const name = e.name ? String(e.name) : '';
  const message = e.message ? String(e.message) : '';

  if (name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Şəbəkə xətası. İnternet bağlantınızı yoxlayıb yenidən cəhd edin.';
  }

  switch (code) {
    // ---- Supabase Auth
    case 'invalid_credentials':
    case 'user_not_found':
      return 'E-poçt və ya şifrə yanlışdır.';
    case 'email_not_confirmed':
      return 'E-poçt ünvanı hələ təsdiqlənməyib. Poçtunuza göndərilən keçidə baxın.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Bu e-poçt ünvanı ilə artıq qeydiyyatdan keçilib.';
    case 'weak_password':
      return 'Şifrə çox zəifdir. Ən azı 8 simvoldan istifadə edin.';
    case 'same_password':
      return 'Yeni şifrə köhnə şifrədən fərqli olmalıdır.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
    case '429':
      return 'Çox sayda cəhd edildi. Bir az gözləyib yenidən yoxlayın.';
    case 'session_expired':
    case 'session_not_found':
    case 'bad_jwt':
    case 'PGRST301':
      return 'Sessiyanın müddəti bitib. Yenidən daxil olun.';
    // ---- Postgres / PostgREST
    case '42501':
    case 'no-rows':
      return 'Bu əməliyyat üçün icazəniz yoxdur və ya qeyd tapılmadı.';
    case 'PGRST116':
    case '22P02':
      return 'Axtarılan məlumat tapılmadı.';
    case '23505':
      return 'Bu qeyd artıq mövcuddur.';
    case 'validation_failed':
    case '23514':
    case '23502':
      return 'Daxil edilən məlumatlar düzgün deyil. Sahələri yoxlayın.';
    case '57014':
      return 'Sorğu limiti aşıldı. Bir az sonra yenidən cəhd edin.';
    default:
      return 'Gözlənilməz xəta baş verdi. Bir az sonra yenidən cəhd edin.';
  }
}
