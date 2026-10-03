import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Role } from '@/types';

const h = vi.hoisted(() => ({ auth: { user: null as unknown, profile: null as unknown, role: 'student' as Role, loading: false } }));

vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    ...h.auth, configured: false,
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), resetPassword: vi.fn(), updateProfile: vi.fn(),
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

const signedOut = () => Object.assign(h.auth, { user: null, profile: null, role: 'student', loading: false });
const signIn = (role: Role) => Object.assign(h.auth, {
  user: { uid: 'u1', email: 'a@b.az' },
  profile: { uid: 'u1', firstName: 'Aysel', lastName: 'Məmmədova', email: 'a@b.az', role },
  role, loading: false,
});

beforeEach(signedOut);

describe('ictimai səhifələr', () => {
  const cases: [string, RegExp][] = [
    ['/', /Sosial iş tələbəsinin gündəlik iş masası/],
    ['/announcements', /^Elanlar$/],
    ['/materials', /Tədris materialları/],
    ['/schedule', /^Dərs cədvəli$/],
    ['/events', /^Tədbirlər$/],
    ['/about', /Sosial iş ixtisası haqqında/],
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

describe('əlaqə formu', () => {
  it('boş göndərildikdə Azərbaycan dilində validasiya xətaları göstərir', async () => {
    const user = userEvent.setup();
    renderAt('/contact');
    await user.click(await screen.findByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText('Ad və soyadı yazın')).toBeInTheDocument();
    expect(screen.getByText('E-poçt ünvanını yazın')).toBeInTheDocument();
    expect(screen.getByText('Mövzunu yazın')).toBeInTheDocument();
    expect(screen.getByText('Mesajı yazın')).toBeInTheDocument();
  });

  it('düzgün doldurulsa belə, backend qoşulmayıbsa aydın xəta göstərir (uğurlu saxta mesaj yox)', async () => {
    const user = userEvent.setup();
    renderAt('/contact');
    await user.type(await screen.findByLabelText('Ad və soyad'), 'Aysel Məmmədova');
    await user.type(screen.getByLabelText('E-poçt ünvanı'), 'aysel@example.com');
    await user.type(screen.getByLabelText('Mövzu'), 'Sual');
    await user.type(screen.getByLabelText('Mesaj'), 'Bu bir sınaq mesajıdır.');
    await user.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/hələ qoşulmayıb/);
  });
});

describe('qeydiyyat formu', () => {
  it('zəif və uyğunsuz şifrəni rədd edir', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(await screen.findByLabelText('Ad'), 'Aysel');
    await user.type(screen.getByLabelText('Soyad'), 'M');
    await user.type(screen.getByLabelText('E-poçt ünvanı'), 'yanlis');
    await user.type(screen.getByLabelText('Şifrə'), 'qisa');
    await user.type(screen.getByLabelText('Şifrəni təkrarlayın'), 'basqa');
    await user.click(screen.getByRole('button', { name: 'Hesab yarat' }));
    expect(await screen.findByText('E-poçt ünvanı düzgün deyil')).toBeInTheDocument();
    expect(screen.getByText('Şifrə ən azı 8 simvol olmalıdır')).toBeInTheDocument();
    expect(screen.getByText('Şifrələr eyni deyil')).toBeInTheDocument();
  });
});

describe('qorunan səhifələr', () => {
  it.each(['/dashboard', '/dashboard/profile', '/dashboard/saved', '/dashboard/notifications', '/dashboard/schedule', '/admin', '/admin/users'])(
    'giriş etməmiş istifadəçi %s ünvanından girişə yönləndirilir', async (path) => {
      renderAt(path);
      expect(await screen.findByRole('heading', { level: 1, name: 'Daxil ol' })).toBeInTheDocument();
    });

  it('tələbə /admin ünvanına girə bilmir', async () => {
    signIn('student');
    renderAt('/admin');
    expect(await screen.findByText('Bu bölməyə giriş icazəniz yoxdur')).toBeInTheDocument();
  });

  it('redaktor admin panelini görür, lakin istifadəçilər səhifəsini görmür', async () => {
    signIn('editor');
    const a = renderAt('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'İdarəetmə paneli' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'İstifadəçilər' })).not.toBeInTheDocument();
    a.unmount();
    renderAt('/admin/users');
    expect(await screen.findByText('Bu bölməyə giriş icazəniz yoxdur')).toBeInTheDocument();
  });

  it('admin istifadəçilər bölməsini görür', async () => {
    signIn('admin');
    renderAt('/admin/users');
    expect(await screen.findByRole('heading', { level: 1, name: 'İstifadəçilər' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'İstifadəçilər' }).length).toBeGreaterThan(0);
  });

  it('giriş etmiş tələbə kabinetdə xoş gəldin mesajını görür', async () => {
    signIn('student');
    renderAt('/dashboard');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Xoş gəldiniz, Aysel!'));
  });

  it('giriş etmiş istifadəçi /login ünvanından kabinetə yönləndirilir', async () => {
    signIn('student');
    renderAt('/login');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Xoş gəldiniz'));
  });
});
