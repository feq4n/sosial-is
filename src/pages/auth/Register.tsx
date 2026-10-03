import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSeo } from '@/hooks/useSeo';
import { Button, ErrorBanner, SelectField, TextField } from '@/components/ui';
import { friendlyError } from '@/utils/errors';
import { degreeLabels } from '@/utils/labels';
import type { Degree } from '@/types';
import { AuthLayout } from './AuthLayout';

interface Form { firstName: string; lastName: string; email: string; password: string; confirm: string; degree: Degree; course: number; studentId: string }

export default function Register() {
  useSeo('Qeydiyyat', undefined, { noindex: true });
  const { register: signUp } = useAuth();
  const nav = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>({ defaultValues: { degree: 'bakalavr', course: 1 } });
  const [err, setErr] = useState('');

  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try {
      await signUp({ firstName: v.firstName, lastName: v.lastName, email: v.email, password: v.password, degree: v.degree, course: Number(v.course), studentId: v.studentId });
      nav('/dashboard', { replace: true });
    } catch (e) { setErr(friendlyError(e)); }
  });

  return (
    <AuthLayout title="Qeydiyyat" text="Tələbə hesabı yaradın. Hər yeni hesab “Tələbə” rolu ilə açılır.">
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Ad" autoComplete="given-name" error={errors.firstName?.message} {...register('firstName', { required: 'Adı yazın', maxLength: { value: 60, message: 'Ən çox 60 simvol' } })} />
          <TextField label="Soyad" autoComplete="family-name" error={errors.lastName?.message} {...register('lastName', { required: 'Soyadı yazın', maxLength: { value: 60, message: 'Ən çox 60 simvol' } })} />
        </div>
        <TextField label="E-poçt ünvanı" type="email" autoComplete="email" error={errors.email?.message} {...register('email', { required: 'E-poçt ünvanını yazın', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-poçt ünvanı düzgün deyil' } })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Təhsil pilləsi" {...register('degree')}>{Object.entries(degreeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectField>
          <SelectField label="Kurs" {...register('course', { valueAsNumber: true })}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}-ci kurs</option>)}</SelectField>
        </div>
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
