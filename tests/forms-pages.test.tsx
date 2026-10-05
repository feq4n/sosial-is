import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Role } from '@/types';

const h = vi.hoisted(() => ({
  auth: { user: null as unknown, profile: null as unknown, role: 'student' as Role, loading: false },
  api: {
    listAdmin: vi.fn(), listForStudent: vi.fn(), getById: vi.fn(), getBySlug: vi.fn(), hasSubmitted: vi.fn(),
    create: vi.fn(), update: vi.fn(), remove: vi.fn(), submit: vi.fn(), responses: vi.fn(),
  },
}));

vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ ...h.auth, configured: false, login: vi.fn(), register: vi.fn(), logout: vi.fn(), resetPassword: vi.fn(), updatePassword: vi.fn(), updateProfile: vi.fn() }),
}));
vi.mock('@/services/forms', async (orig) => ({ ...(await orig<typeof import('@/services/forms')>()), formsApi: h.api }));

import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import AppRoutes from '@/routes/AppRoutes';

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><ThemeProvider><ToastProvider><AppRoutes /></ToastProvider></ThemeProvider></MemoryRouter>);
const signIn = (role: Role) => Object.assign(h.auth, { user: { uid: 'u1', email: 'a@b.az' }, profile: { uid: 'u1', firstName: 'Aysel', lastName: 'M', email: 'a@b.az', role }, role, loading: false });

const form = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-1111-1111-111111111111', slug: 'abc123def456', title: 'Praktika sorğusu', description: 'Qısa sorğu', status: 'published',
  audience: { mode: 'all', specialties: [], groups: [] }, createdAt: '2026-10-04T08:00:00.000Z',
  fields: [
    { id: 'q1', type: 'text', label: 'Adınız', required: true },
    { id: 'q2', type: 'radio', label: 'Praktika yeri', required: false, options: ['Ofis', 'Sahə'] },
  ], ...over,
});

beforeEach(() => {
  Object.values(h.api).forEach((m) => m.mockReset());
  h.api.submit.mockResolvedValue(undefined);
  h.api.hasSubmitted.mockResolvedValue(false);
});

describe('admin Formlar', () => {
  it('admin siyahını, statusu və cavab sayını görür', async () => {
    signIn('admin');
    h.api.listAdmin.mockResolvedValue([
      form({ responseCount: 7, audience: { mode: 'restricted', specialties: ['Sİ'], groups: [] } }),
      form({ id: '22222222-2222-2222-2222-222222222222', slug: 'qaralama1234', title: 'Qaralama form', status: 'draft', responseCount: 0 }),
    ]);
    renderAt('/admin/forms');
    expect(await screen.findByText('Praktika sorğusu')).toBeInTheDocument();
    expect(screen.getByText('Dərc olunub')).toBeInTheDocument();
    expect(screen.getByText('Qaralama')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Linki kopyala/ })).toHaveLength(1); // qaralamada link yoxdur
    expect(screen.getAllByRole('link', { name: /Redaktə et/ })[0]).toHaveAttribute('href', '/admin/forms/11111111-1111-1111-1111-111111111111');
    expect(screen.getByRole('link', { name: /Yeni form/ })).toHaveAttribute('href', '/admin/forms/new');
  });
  it('editor və tələbə admin Formlar səhifəsinə daxil ola bilmir', async () => {
    for (const role of ['editor', 'student'] as Role[]) {
      signIn(role);
      const { unmount } = renderAt('/admin/forms');
      expect(await screen.findByText(/giriş icazəniz yoxdur/)).toBeInTheDocument();
      expect(h.api.listAdmin).not.toHaveBeenCalled();
      unmount();
    }
  });
  it('yeni form redaktoru açılır, boş başlıqla saxlamaq xəta verir və serverə getmir', async () => {
    signIn('admin');
    renderAt('/admin/forms/new');
    expect(await screen.findByRole('heading', { name: 'Yeni form' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Saxla/ }));
    expect(await screen.findByText(/Başlıq 3–160 simvol/)).toBeInTheDocument();
    expect(h.api.create).not.toHaveBeenCalled();
  });
  it('admin sual əlavə edib formu yaradır', async () => {
    signIn('admin');
    h.api.create.mockResolvedValue(form());
    h.api.getById.mockResolvedValue(form({ responseCount: 0 }));
    renderAt('/admin/forms/new');
    await userEvent.type(await screen.findByLabelText('Başlıq'), 'Yeni sorğu');
    await userEvent.click(screen.getByRole('button', { name: /Qısa mətn/ }));
    await userEvent.type(screen.getByLabelText('Sual mətni'), 'Adınız');
    await userEvent.click(screen.getByRole('button', { name: /Saxla/ }));
    await waitFor(() => expect(h.api.create).toHaveBeenCalledTimes(1));
    const arg = h.api.create.mock.calls[0][0];
    expect(arg).toMatchObject({ title: 'Yeni sorğu', status: 'draft', fields: [{ id: 'q1', type: 'text', label: 'Adınız', required: false }] });
  });
  it('cavablar səhifəsi xülasə və cədvəl göstərir', async () => {
    signIn('admin');
    h.api.getById.mockResolvedValue(form());
    h.api.responses.mockResolvedValue([
      { id: 'r1', submittedAt: '2026-10-04T08:00:00.000Z', answers: { q1: 'Aysel', q2: 'Ofis' }, respondentName: 'Aysel Məmmədova', respondentEmail: 'aysel@example.az', respondentKind: 'student' },
      { id: 'r2', submittedAt: '2026-10-04T09:00:00.000Z', answers: { q1: 'Bəhruz', q2: 'Ofis' }, respondentKind: 'anonymous' },
      { id: 'r3', submittedAt: '2026-10-04T10:00:00.000Z', answers: { q1: 'Köhnə', q2: 'Ofis' }, respondentKind: 'anonymous' },
    ]);
    renderAt('/admin/forms/11111111-1111-1111-1111-111111111111/responses');
    expect(await screen.findByText('Aysel')).toBeInTheDocument();
    expect(screen.getByText('Bəhruz')).toBeInTheDocument();
    expect(screen.getByText('Aysel Məmmədova')).toBeInTheDocument();
    expect(screen.getAllByText('Anonim')).toHaveLength(2);
    expect(screen.getByText(/Cavab sayı: 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CSV yüklə/ })).toBeEnabled();
  });
});

describe('tələbə Formlar və doldurma', () => {
  it('siyahıda doldurulmuş form «Doldurulub», digəri «Doldur» linki ilə görünür', async () => {
    signIn('student');
    h.api.listForStudent.mockResolvedValue({
      forms: [form(), form({ id: '33333333-3333-3333-3333-333333333333', slug: 'ikinci123456', title: 'İkinci sorğu' })],
      submitted: new Set(['11111111-1111-1111-1111-111111111111']),
    });
    renderAt('/dashboard/forms');
    expect(await screen.findByText('Praktika sorğusu')).toBeInTheDocument();
    expect(screen.getByText('Doldurulub')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Doldur' })).toHaveAttribute('href', '/f/ikinci123456');
  });
  it('vaxtı bitmiş doldurulmamış form siyahıda görünmür', async () => {
    signIn('student');
    h.api.listForStudent.mockResolvedValue({ forms: [form({ closesAt: '2020-01-01T00:00:00.000Z' })], submitted: new Set() });
    renderAt('/dashboard/forms');
    expect(await screen.findByText(/Hazırda sizin üçün açıq form yoxdur/)).toBeInTheDocument();
  });
  it('/f/:slug giriş etməyən istifadəçini loginə atmır və ad/soyad/e-poçt soruşmur; cavab anonim göndərilir', async () => {
    Object.assign(h.auth, { user: null, profile: null, role: 'student', loading: false });
    h.api.getBySlug.mockResolvedValue(form());
    renderAt('/f/abc123def456');
    expect(await screen.findByRole('heading', { name: 'Praktika sorğusu' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Daxil ol' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Soyad/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^E-poçt/)).not.toBeInTheDocument();
    expect(h.api.hasSubmitted).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/Adınız/), 'Fidan');
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    await waitFor(() => expect(h.api.submit).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', { q1: 'Fidan' }));
    expect(await screen.findByText('Cavabınız qəbul edildi')).toBeInTheDocument();
  });
  it('qonaq üçün görünməyən (məhdud auditoriyalı) form: «Daxil ol» təklifi', async () => {
    Object.assign(h.auth, { user: null, profile: null, role: 'student', loading: false });
    h.api.getBySlug.mockResolvedValue(null);
    renderAt('/f/abc123def456');
    expect(await screen.findByText('Form tapılmadı')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Daxil ol' }).every((a) => a.getAttribute('href') === '/login')).toBe(true);
  });
  it('tələbə formu doldurub göndərir', async () => {
    signIn('student');
    h.api.getBySlug.mockResolvedValue(form());
    renderAt('/f/abc123def456');
    expect(await screen.findByRole('heading', { name: 'Praktika sorğusu' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText('Bu sual məcburidir.')).toBeInTheDocument();
    expect(h.api.submit).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/Adınız/), '  Aysel ');
    await userEvent.click(screen.getByLabelText('Sahə'));
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    await waitFor(() => expect(h.api.submit).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', { q1: 'Aysel', q2: 'Sahə' }));
    expect(await screen.findByText('Cavabınız qəbul edildi')).toBeInTheDocument();
  });
  it('server xətası (məs. artıq doldurulub) aydın mesajla göstərilir', async () => {
    signIn('student');
    h.api.getBySlug.mockResolvedValue(form({ fields: [{ id: 'q1', type: 'text', label: 'Ad', required: false }] }));
    h.api.submit.mockRejectedValue(Object.assign(new Error('form-already-submitted'), { code: 'P0001' }));
    renderAt('/f/abc123def456');
    await userEvent.click(await screen.findByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText(/artıq doldurmusunuz/)).toBeInTheDocument();
  });
  it('əvvəl doldurulmuş form üçün məlumat göstərilir', async () => {
    signIn('student');
    h.api.getBySlug.mockResolvedValue(form());
    h.api.hasSubmitted.mockResolvedValue(true);
    renderAt('/f/abc123def456');
    expect(await screen.findByText('Siz bu formu artıq doldurmusunuz')).toBeInTheDocument();
  });
  it('tapılmayan / icazəsiz form eyni mesajı verir (RLS gizlədir)', async () => {
    signIn('student');
    h.api.getBySlug.mockResolvedValue(null);
    renderAt('/f/abc123def456');
    expect(await screen.findByText('Form tapılmadı')).toBeInTheDocument();
  });
  it('vaxtı bitmiş form doldurulmur', async () => {
    signIn('student');
    h.api.getBySlug.mockResolvedValue(form({ closesAt: '2020-01-01T00:00:00.000Z' }));
    renderAt('/f/abc123def456');
    expect(await screen.findByText('Bu formun qəbul müddəti bitib')).toBeInTheDocument();
  });
  it('admin formu önizləmə rejimində görür və göndərə bilmir', async () => {
    signIn('admin');
    h.api.getBySlug.mockResolvedValue(form());
    renderAt('/f/abc123def456');
    expect(await screen.findByText(/Önizləmə: admin kimi/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Göndər' })).not.toBeInTheDocument();
    expect(h.api.hasSubmitted).not.toHaveBeenCalled();
  });
});
