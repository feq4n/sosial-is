import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSeo } from '@/hooks/useSeo';
import { Button, ErrorBanner, SuccessBanner, TextField } from '@/components/ui';
import { friendlyError } from '@/utils/errors';
import { AuthLayout } from './AuthLayout';

export default function ForgotPassword() {
  useSeo('Şifrənin bərpası', undefined, { noindex: true });
  const { resetPassword } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>();
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);

  const onSubmit = handleSubmit(async (v) => {
    setState(null);
    try {
      await resetPassword(v.email);
      setState({ ok: true, text: 'Əgər bu e-poçt ünvanı ilə hesab varsa, şifrənin yenilənməsi üçün keçid göndərildi.' });
    } catch (e) {
      const code = (e as { code?: string }).code;
      // Hesabın mövcudluğunu açıqlamamaq üçün "user-not-found" uğurlu kimi göstərilir
      if (code === 'auth/user-not-found') setState({ ok: true, text: 'Əgər bu e-poçt ünvanı ilə hesab varsa, şifrənin yenilənməsi üçün keçid göndərildi.' });
      else setState({ ok: false, text: friendlyError(e) });
    }
  });

  return (
    <AuthLayout title="Şifrənin bərpası" text="E-poçt ünvanınızı yazın, şifrəni yeniləmək üçün keçid göndərək.">
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <TextField label="E-poçt ünvanı" type="email" autoComplete="email" error={errors.email?.message} {...register('email', { required: 'E-poçt ünvanını yazın', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-poçt ünvanı düzgün deyil' } })} />
        {state && (state.ok ? <SuccessBanner>{state.text}</SuccessBanner> : <ErrorBanner>{state.text}</ErrorBanner>)}
        <Button type="submit" size="lg" loading={isSubmitting}>Keçid göndər</Button>
      </form>
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-brand hover:underline">← Girişə qayıt</Link></p>
    </AuthLayout>
  );
}
