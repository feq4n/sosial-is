import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Role } from '@/types';

const h = vi.hoisted(() => ({
  auth: { user: null as unknown, profile: null as unknown, role: 'student' as Role, loading: false },
  register: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    ...h.auth, configured: false,
    login: vi.fn(), register: h.register, logout: vi.fn(), resetPassword: vi.fn(), updatePassword: vi.fn(), updateProfile: vi.fn(),
  }),
}));

import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import AppRoutes from '@/routes/AppRoutes';

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <ThemeProvider><ToastProvider><AppRoutes /></ToastProvider></ThemeProvider>
  </MemoryRouter>,
);

const signedOut = () => (h.register.mockReset(), Object.assign(h.auth, { user: null, profile: null, role: 'student', loading: false }));
const signIn = (role: Role) => Object.assign(h.auth, {
  user: { uid: 'u1', email: 'a@b.az' },
  profile: { uid: 'u1', firstName: 'Aysel', lastName: 'Məmmədova', email: 'a@b.az', role },
  role, loading: false,
});

beforeEach(signedOut);

describe('ictimai səhifələr', () => {
  const cases: [string, RegExp][] = [
    ['/', /Kollec tələbəsinin gündəlik iş masası/],
    ['/announcements', /^Elanlar$/],
    ['/materials', /Tədris materialları/],
    ['/schedule', /^Dərs cədvəli$/],
    ['/events', /^Tədbirlər$/],
    ['/about', /İxtisaslar haqqında/],
    ['/contact', /^Əlaqə$/],
    ['/login', /^Daxil ol$/],
    ['/register', /^Qeydiyyat$/],
    ['/forgot-password', /Şifrənin bərpası/],
  ];
  it.each(cases)('%s render olunur', async (path, heading) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('naməlum ünvan 404 göstərir', async () => {
    renderAt('/yoxdur-bele-seyfe');
    expect(await screen.findByText('Səhifə tapılmadı')).toBeInTheDocument();
  });

  it('elan və tədbir detalı nümunə məlumatla açılır, olmayan id isə boş vəziyyət göstərir', async () => {
    const a = renderAt('/announcements/sample-a1');
    expect(await screen.findByRole('heading', { level: 1, name: /imtahan cədvəli/ })).toBeInTheDocument();
    a.unmount();
    renderAt('/events/yoxdur');
    expect(await screen.findByText('Tədbir tapılmadı')).toBeInTheDocument();
  });

  it('layihə adı yalnız “Sosial İş” kimi görünür', async () => {
    renderAt('/');
    await screen.findByRole('heading', { level: 1 });
    expect(document.body.textContent).not.toMatch(/Social Work|Sosial İş Hub|Hub/);
    expect(document.title).toBe('Sosial İş');
  });
});

describe('dərs cədvəli', () => {
  it('filtr olmadan bütün qrupları sadalayır, ixtisas və qrup seçildikdə dərsləri göstərir', async () => {
    const user = userEvent.setup();
    renderAt('/schedule');
    expect(await screen.findByText(/29 qrup tapıldı/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('İxtisas'), 'Sİ');
    await user.selectOptions(screen.getByLabelText('Qrup'), 'Sİ26/01SB');
    expect((await screen.findAllByText('Qasımlı Əsmər')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 3, name: /^I gün · Bazar ertəsi/ })).toBeInTheDocument();
    expect(screen.queryByText(/Kurs/)).not.toBeInTheDocument();
    expect(screen.getAllByText('I növbə').length).toBeGreaterThan(1);
  });

  it('növbə filtri qrup siyahısını məhdudlaşdırır', async () => {
    const user = userEvent.setup();
    renderAt('/schedule');
    await screen.findByText(/29 qrup tapıldı/);
    await user.selectOptions(screen.getByLabelText('Növbə'), '2');
    expect(await screen.findByText(/13 qrup tapıldı/)).toBeInTheDocument();
    expect(screen.getByLabelText('Qrup').querySelectorAll('option')).toHaveLength(14);
  });

  it('gün filtri yalnız seçilmiş günü göstərir', async () => {
    const user = userEvent.setup();
    renderAt('/schedule?f=1&group=S%C4%B026%2F01SB');
    await screen.findByRole('heading', { level: 3, name: /^III gün · Çərşənbə/ });
    await user.selectOptions(screen.getByLabelText('Gün'), '3');
    expect(screen.queryByRole('heading', { level: 3, name: /^I gün · Bazar ertəsi/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /^III gün · Çərşənbə/ })).toBeInTheDocument();
  });

  it('qrupu seçilmiş tələbə üçün cədvəl avtomatik açılır', async () => {
    signIn('student');
    Object.assign(h.auth, { profile: { ...(h.auth.profile as object), specialty: 'Sİ', group: 'Sİ26/01SB' } });
    renderAt('/schedule');
    expect(await screen.findByLabelText('Qrup')).toHaveValue('Sİ26/01SB');
    expect(screen.getByRole('heading', { level: 3, name: /^I gün · Bazar ertəsi/ })).toBeInTheDocument();
  });
});

describe('axtarış və filtr', () => {
  it('elanlarda axtarış nəticəni süzür və boş vəziyyət göstərir', async () => {
    const user = userEvent.setup();
    renderAt('/announcements');
    await screen.findByText(/Nümunə: Təcrübə yerləri/);
    await user.type(screen.getByLabelText('Axtarış'), 'tecrube');
    expect(screen.queryByText(/imtahan cədvəli/)).not.toBeInTheDocument();
    expect(screen.getByText(/Təcrübə yerləri/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Axtarış'));
    await user.type(screen.getByLabelText('Axtarış'), 'zzzz');
    expect(await screen.findByText('Uyğun elan tapılmadı')).toBeInTheDocument();
  });
});

describe('əlaqə səhifəsi', () => {
  it('rəsmi əlaqə məlumatları göstərilir; mesaj üçün əməkdaş yoxdursa forma əvəzinə izahat çıxır, giriş tələb olunmur', async () => {
    renderAt('/contact');
    expect(await screen.findByRole('heading', { level: 1, name: 'Əlaqə' })).toBeInTheDocument();
    expect(await screen.findByText('Mesaj göndərmək üçün hazırda əməkdaş əlavə olunmayıb.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Göndər' })).not.toBeInTheDocument();
    expect(screen.queryByText(/giriş edin/i)).not.toBeInTheDocument();
  });
});
