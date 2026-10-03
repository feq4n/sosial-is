import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSeo } from '@/hooks/useSeo';
import { Button, ButtonLink, ErrorBanner, SuccessBanner, TextField } from '@/components/ui';
import { PageLoader } from '@/components/PageLoader';
import { friendlyError } from '@/utils/errors';
import { AuthLayout } from './AuthLayout';

/** Şifrə bərpası e-poçtundakı keçid buraya yönləndirir; Supabase müvəqqəti sessiya yaradır. */
export default function ResetPassword() {
  useSeo('Yeni şifrə', undefined, { noindex: true });
  const { user, loading, updatePassword } = useAuth();
  const nav = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<{ password: string; confirm: string }>();
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try {
      await updatePassword(v.password);
      setDone(true);
      setTimeout(() => nav('/dashboard', { replace: true }), 1500);
    } catch (e) { setErr(friendlyError(e)); }
  });

  if (loading) return <PageLoader />;

  return (
    <AuthLayout title="Yeni şifrə" text={user ? 'Hesabınız üçün yeni şifrə təyin edin.' : undefined}>
      {!user ? (
        <div className="grid gap-4">
          <ErrorBanner>Keçid etibarsızdır və ya müddəti bitib. Şifrənin bərpasını yenidən sorğulayın.</ErrorBanner>
          <ButtonLink to="/forgot-password" size="lg">Yeni keçid istə</ButtonLink>
          <p className="text-center text-sm"><Link to="/login" className="font-semibold text-brand hover:underline">← Girişə qayıt</Link></p>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          <TextField label="Yeni şifrə" type="password" autoComplete="new-password" hint="Ən azı 8 simvol, hərf və rəqəm" error={errors.password?.message}
            {...register('password', { required: 'Şifrəni yazın', minLength: { value: 8, message: 'Şifrə ən azı 8 simvol olmalıdır' }, validate: (p) => (/[A-Za-zƏəİıÖöÜüŞşÇçĞğ]/.test(p) && /\d/.test(p)) || 'Şifrədə hərf və rəqəm olmalıdır' })} />
          <TextField label="Şifrəni təkrarlayın" type="password" autoComplete="new-password" error={errors.confirm?.message}
            {...register('confirm', { required: 'Şifrəni təkrar yazın', validate: (c) => c === watch('password') || 'Şifrələr eyni deyil' })} />
          {err && <ErrorBanner>{err}</ErrorBanner>}
          {done && <SuccessBanner>Şifrə yeniləndi. Kabinetə yönləndirilirsiniz…</SuccessBanner>}
          <Button type="submit" size="lg" loading={isSubmitting} disabled={done}>Şifrəni yenilə</Button>
        </form>
      )}
    </AuthLayout>
  );
}
