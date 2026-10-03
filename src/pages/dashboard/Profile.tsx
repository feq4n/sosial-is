import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSeo } from '@/hooks/useSeo';
import { useToast } from '@/components/Toast';
import { Badge, Button, Card, ErrorBanner, PageHeader, SelectField, TextField } from '@/components/ui';
import { friendlyError } from '@/utils/errors';
import { degreeLabels, roleLabels } from '@/utils/labels';
import type { Degree } from '@/types';

interface Form { firstName: string; lastName: string; studentId: string; degree: Degree; course: number; group: string }

export default function Profile() {
  useSeo('Profil', undefined, { noindex: true });
  const { profile, user, updateProfile, resetPassword, role } = useAuth();
  const toast = useToast();
  const [err, setErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<Form>({
    defaultValues: { firstName: profile?.firstName ?? '', lastName: profile?.lastName ?? '', studentId: profile?.studentId ?? '', degree: profile?.degree ?? 'bakalavr', course: profile?.course ?? 1, group: profile?.group ?? '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try { await updateProfile({ ...v, course: Number(v.course) }); toast.success('Profil yeniləndi'); }
    catch (e) { setErr(friendlyError(e)); }
  });

  const sendReset = async () => {
    if (!user?.email) return;
    setPwBusy(true);
    try { await resetPassword(user.email); toast.success('Şifrəni yeniləmək üçün keçid e-poçtunuza göndərildi'); }
    catch (e) { toast.error(friendlyError(e)); } finally { setPwBusy(false); }
  };

  return (
    <>
      <PageHeader title="Profil" text="Şəxsi məlumatlarınızı yeniləyin." />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <form onSubmit={onSubmit} noValidate className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Ad" error={errors.firstName?.message} {...register('firstName', { required: 'Adı yazın', maxLength: { value: 60, message: 'Ən çox 60 simvol' } })} />
              <TextField label="Soyad" error={errors.lastName?.message} {...register('lastName', { required: 'Soyadı yazın', maxLength: { value: 60, message: 'Ən çox 60 simvol' } })} />
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <SelectField label="Təhsil pilləsi" {...register('degree')}>{Object.entries(degreeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectField>
              <SelectField label="Kurs" {...register('course', { valueAsNumber: true })}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</SelectField>
              <TextField label="Qrup" error={errors.group?.message} {...register('group', { maxLength: { value: 20, message: 'Ən çox 20 simvol' } })} />
            </div>
            <TextField label="Tələbə bileti nömrəsi" error={errors.studentId?.message} {...register('studentId', { maxLength: { value: 30, message: 'Ən çox 30 simvol' } })} />
            {err && <ErrorBanner>{err}</ErrorBanner>}
            <div><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Dəyişiklikləri saxla</Button></div>
          </form>
        </Card>
        <div className="grid h-fit gap-6">
          <Card className="p-6">
            <h2 className="font-bold">Hesab</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div><dt className="text-muted">E-poçt</dt><dd className="break-all font-semibold">{user?.email}</dd></div>
              <div><dt className="text-muted">Rol</dt><dd><Badge tone="brand">{roleLabels[role]}</Badge></dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">Rolu yalnız admin dəyişə bilər.</p>
          </Card>
          <Card className="p-6">
            <h2 className="font-bold">Şifrə</h2>
            <p className="mt-1 text-sm text-muted">Şifrəni dəyişmək üçün e-poçtunuza yeniləmə keçidi göndərilir.</p>
            <Button className="mt-4" variant="secondary" onClick={sendReset} loading={pwBusy}><KeyRound className="size-4" aria-hidden />Şifrəni dəyiş</Button>
          </Card>
        </div>
      </div>
    </>
  );
}
