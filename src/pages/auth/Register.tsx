import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSeo } from '@/hooks/useSeo';
import { Button, ErrorBanner, TextField } from '@/components/ui';
import { hasPlacementErrors, PlacementFields, validatePlacement, type Placement, type PlacementErrors } from '@/components/PlacementFields';
import { friendlyError } from '@/utils/errors';
import { AuthLayout } from './AuthLayout';

interface Form { firstName: string; lastName: string; email: string; password: string; confirm: string; studentId: string }

export default function Register() {
  useSeo('Qeydiyyat', undefined, { noindex: true });
  const { register: signUp } = useAuth();
  const nav = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>();
  const [placement, setPlacement] = useState<Placement>({ specialty: '', group: '' });
  const [placementErrors, setPlacementErrors] = useState<PlacementErrors>({});
  const [err, setErr] = useState('');

  const run = handleSubmit(async (v) => {
    setErr('');
    if (hasPlacementErrors(validatePlacement(placement))) return;
    try {
      await signUp({ firstName: v.firstName, lastName: v.lastName, email: v.email, password: v.password, specialty: placement.specialty, group: placement.group, studentId: v.studentId });
      nav('/dashboard', { replace: true });
    } catch (e) { setErr(friendlyError(e)); }
  });

  const onSubmit = (e: React.FormEvent) => {
    setPlacementErrors(validatePlacement(placement));
    return run(e);
  };

  return (
    <AuthLayout title="Qeydiyyat" text="Tələbə hesabı yaradın. Hər yeni hesab “Tələbə” rolu ilə açılır.">
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Ad" autoComplete="given-name" error={errors.firstName?.message} {...register('firstName', { required: 'Adı yazın', maxLength: { value: 60, message: 'Ən çox 60 simvol' } })} />
          <TextField label="Soyad" autoComplete="family-name" error={errors.lastName?.message} {...register('lastName', { required: 'Soyadı yazın', maxLength: { value: 60, message: 'Ən çox 60 simvol' } })} />
        </div>
        <TextField label="E-poçt ünvanı" type="email" autoComplete="email" error={errors.email?.message} {...register('email', { required: 'E-poçt ünvanını yazın', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-poçt ünvanı düzgün deyil' } })} />
        <PlacementFields value={placement} errors={placementErrors} onChange={(v) => { setPlacement(v); setPlacementErrors({}); }} />
        <TextField label="Tələbə bileti nömrəsi (könüllü)" error={errors.studentId?.message} {...register('studentId', { maxLength: { value: 30, message: 'Ən çox 30 simvol' } })} />
        <TextField label="Şifrə" type="password" autoComplete="new-password" hint="Ən azı 8 simvol, hərf və rəqəm" error={errors.password?.message}
          {...register('password', { required: 'Şifrəni yazın', minLength: { value: 8, message: 'Şifrə ən azı 8 simvol olmalıdır' }, validate: (p) => (/[A-Za-zƏəİıÖöÜüŞşÇçĞğ]/.test(p) && /\d/.test(p)) || 'Şifrədə hərf və rəqəm olmalıdır' })} />
        <TextField label="Şifrəni təkrarlayın" type="password" autoComplete="new-password" error={errors.confirm?.message}
          {...register('confirm', { required: 'Şifrəni təkrar yazın', validate: (c) => c === watch('password') || 'Şifrələr eyni deyil' })} />
        {err && <ErrorBanner>{err}</ErrorBanner>}
        <Button type="submit" size="lg" loading={isSubmitting}>Hesab yarat</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Artıq hesabınız var? <Link to="/login" className="font-semibold text-brand hover:underline">Daxil olun</Link></p>
    </AuthLayout>
  );
}
