import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSeo } from '@/hooks/useSeo';
import { useToast } from '@/components/Toast';
import { Badge, Button, Card, ErrorBanner, PageHeader, TextField } from '@/components/ui';
import { hasPlacementErrors, PlacementFields, validatePlacement, type Placement, type PlacementErrors } from '@/components/PlacementFields';
import { isValidPlacement } from '@/data/timetable';
import { friendlyError } from '@/utils/errors';
import { roleLabels } from '@/utils/labels';

interface Form { firstName: string; lastName: string; studentId: string }

export default function Profile() {
  useSeo('Profil', undefined, { noindex: true });
  const { profile, user, updateProfile, resetPassword, role } = useAuth();
  const toast = useToast();
  const [err, setErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const saved: Placement = profile?.specialty && profile.group && isValidPlacement(profile.specialty, profile.group)
    ? { specialty: profile.specialty, group: profile.group } : { specialty: '', group: '' };
  const [placement, setPlacement] = useState<Placement>(saved);
  const [placementErrors, setPlacementErrors] = useState<PlacementErrors>({});
  const placementDirty = placement.specialty !== saved.specialty || placement.group !== saved.group;
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<Form>({
    defaultValues: { firstName: profile?.firstName ?? '', lastName: profile?.lastName ?? '', studentId: profile?.studentId ?? '' },
  });

  const run = handleSubmit(async (v) => {
    setErr('');
    if (hasPlacementErrors(validatePlacement(placement))) return;
    try { await updateProfile({ ...v, specialty: placement.specialty, group: placement.group }); toast.success('Profil yeniləndi'); }
    catch (e) { setErr(friendlyError(e)); }
  });

  const onSubmit = (e: React.FormEvent) => {
    setPlacementErrors(validatePlacement(placement));
    return run(e);
  };

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
            {!saved.group && <p role="note" className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-ink dark:text-accent">İxtisas və qrup hələ seçilməyib. Dərs cədvəlinizin avtomatik görünməsi üçün onları seçin.</p>}
            <PlacementFields value={placement} errors={placementErrors} onChange={(v) => { setPlacement(v); setPlacementErrors({}); }} />
            <TextField label="Tələbə bileti nömrəsi" error={errors.studentId?.message} {...register('studentId', { maxLength: { value: 30, message: 'Ən çox 30 simvol' } })} />
            {err && <ErrorBanner>{err}</ErrorBanner>}
            <div><Button type="submit" loading={isSubmitting} disabled={!isDirty && !placementDirty}>Dəyişiklikləri saxla</Button></div>
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
