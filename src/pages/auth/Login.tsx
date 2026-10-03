import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSeo } from '@/hooks/useSeo';
import { Button, ErrorBanner, TextField } from '@/components/ui';
import { friendlyError } from '@/utils/errors';
import { AuthLayout } from './AuthLayout';

export default function Login() {
  useSeo('Daxil ol', undefined, { noindex: true });
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>();
  const [err, setErr] = useState('');

  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try { await login(v.email, v.password); nav((loc.state as { from?: string } | null)?.from ?? '/dashboard', { replace: true }); }
    catch (e) { setErr(friendlyError(e)); }
  });

  return (
    <AuthLayout title="Daxil ol" text="Tələbə kabinetinə giriş üçün e-poçt və şifrənizi yazın.">
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <TextField label="E-poçt ünvanı" type="email" autoComplete="email" error={errors.email?.message} {...register('email', { required: 'E-poçt ünvanını yazın', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-poçt ünvanı düzgün deyil' } })} />
        <TextField label="Şifrə" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password', { required: 'Şifrəni yazın' })} />
        <Link to="/forgot-password" className="-mt-2 text-sm font-semibold text-brand hover:underline">Şifrəni unutmusunuz?</Link>
        {err && <ErrorBanner>{err}</ErrorBanner>}
        <Button type="submit" size="lg" loading={isSubmitting}>Daxil ol</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Hesabınız yoxdur? <Link to="/register" className="font-semibold text-brand hover:underline">Qeydiyyatdan keçin</Link></p>
    </AuthLayout>
  );
}
