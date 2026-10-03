import { NotConfiguredError } from '@/lib/firebase';

/** İstifadəçiyə texniki detalları göstərmədən, Azərbaycan dilində aydın mesaj qaytarır. */
export function friendlyError(err: unknown): string {
  if (err instanceof NotConfiguredError) {
    return 'Xidmət hələ qoşulmayıb. Sayt sahibi Firebase konfiqurasiyasını tamamlamalıdır.';
  }
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'E-poçt və ya şifrə yanlışdır.';
    case 'auth/email-already-in-use':
      return 'Bu e-poçt ünvanı ilə artıq qeydiyyatdan keçilib.';
    case 'auth/weak-password':
      return 'Şifrə çox zəifdir. Ən azı 8 simvoldan istifadə edin.';
    case 'auth/too-many-requests':
      return 'Çox sayda cəhd edildi. Bir az gözləyib yenidən yoxlayın.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Şəbəkə xətası. İnternet bağlantınızı yoxlayıb yenidən cəhd edin.';
    case 'permission-denied':
      return 'Bu əməliyyat üçün icazəniz yoxdur.';
    case 'not-found':
      return 'Axtarılan məlumat tapılmadı.';
    case 'resource-exhausted':
      return 'Sorğu limiti aşıldı. Bir az sonra yenidən cəhd edin.';
    default:
      return 'Gözlənilməz xəta baş verdi. Bir az sonra yenidən cəhd edin.';
  }
}
