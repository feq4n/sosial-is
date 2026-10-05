import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  it('mesaj göndərmə formu yoxdur, yalnız rəsmi əlaqə məlumatları göstərilir', async () => {
    renderAt('/contact');
    expect(await screen.findByRole('heading', { level: 1, name: 'Əlaqə' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Göndər' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Mesaj')).not.toBeInTheDocument();
  });
});

describe('Home', () => {
  it('qısadır: FAQ, komanda, faydalı bölmələr, haqqımızda və mesaj formu yoxdur; üç ixtisas bərabər göstərilir', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 2, name: 'İxtisaslar' })).toBeInTheDocument();
    for (const t of ['Tez-tez verilən suallar', 'Komandamız', 'Tələbələr üçün faydalı bölmələr', 'Sualınız var?']) expect(screen.queryByText(t)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mesaj göndər' })).not.toBeInTheDocument();
    for (const code of ['Sİ', 'KŞATS', 'KŞŞİ']) expect(screen.getByTestId(`specialty-${code}`)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Ətraflı bax/ })[0]).toHaveAttribute('href', '/specialties/S%C4%B0');
  });
  it('«Ətraflı bax» ixtisasın tam məlumat səhifəsinə aparır', async () => {
    renderAt('/specialties/K%C5%9EATS');
    expect(await screen.findByTestId('specialty-KŞATS')).toBeInTheDocument();
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

describe('qeydiyyatda ixtisas və qrup seçimi', () => {
  it('qrup ixtisas seçilməyincə bağlıdır və yalnız həmin ixtisasın qruplarını göstərir', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    const group = await screen.findByLabelText('Qrup');
    expect(group).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('İxtisas'), 'KŞATS');
    expect(group).toBeEnabled();
    const values = [...group.querySelectorAll('option')].map((o) => o.getAttribute('value')).filter(Boolean);
    expect(values).toHaveLength(6);
    expect(values.every((v) => v!.startsWith('KŞATS'))).toBe(true);
    await user.selectOptions(group, 'KŞATS25/01SB');
    expect(screen.getByText(/Növbə:/).textContent).toMatch(/Növbə: II növbə/);
    expect(screen.queryByText(/Kurs/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('İxtisas'), 'Sİ');
    expect(screen.getByLabelText('Qrup')).toHaveValue('');
  });

  it('ixtisas və qrup seçilmədən qeydiyyat göndərilmir', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await user.click(await screen.findByRole('button', { name: 'Hesab yarat' }));
    expect(await screen.findByText('İxtisası seçin', { selector: 'p' })).toBeInTheDocument();
  });
});

describe('qeydiyyat: e-poçt təsdiqi', () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(await screen.findByLabelText('Ad'), 'Aysel');
    await user.type(screen.getByLabelText('Soyad'), 'Məmmədova');
    await user.type(screen.getByLabelText('E-poçt ünvanı'), 'aysel@example.com');
    await user.selectOptions(screen.getByLabelText('İxtisas'), 'Sİ');
    await user.selectOptions(screen.getByLabelText('Qrup'), 'Sİ26/01SB');
    await user.type(screen.getByLabelText('Şifrə'), 'parol1234');
    await user.type(screen.getByLabelText('Şifrəni təkrarlayın'), 'parol1234');
    await user.click(screen.getByRole('button', { name: 'Hesab yarat' }));
  };

  it('təsdiq tələb olunarsa, kabinetə keçmir və təsdiq mesajı göstərir; ixtisas və qrup ötürülür', async () => {
    h.register.mockResolvedValue({ needsEmailConfirmation: true });
    const user = userEvent.setup();
    renderAt('/register');
    await fill(user);
    expect(await screen.findByText(/təsdiq keçidinə klikləyin/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /Xoş gəldin/ })).not.toBeInTheDocument();
    expect(h.register).toHaveBeenCalledWith(expect.objectContaining({ email: 'aysel@example.com', firstName: 'Aysel', specialty: 'Sİ', group: 'Sİ26/01SB' }));
  });

  it('mövcud e-poçt üçün Azərbaycan dilində xəta göstərir', async () => {
    h.register.mockRejectedValue({ code: 'user_already_exists', message: 'x' });
    const user = userEvent.setup();
    renderAt('/register');
    await fill(user);
    expect(await screen.findByText('Bu e-poçt ünvanı ilə artıq qeydiyyatdan keçilib.')).toBeInTheDocument();
  });
});

describe('şifrə yeniləmə (/reset-password)', () => {
  it('etibarsız/müddəti bitmiş keçiddə (sessiya yoxdur) izah və yeni keçid düyməsi göstərir', async () => {
    renderAt('/reset-password');
    expect(await screen.findByText(/Keçid etibarsızdır və ya müddəti bitib/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Yeni keçid istə' })).toHaveAttribute('href', '/forgot-password');
  });

  it('bərpa sessiyası olduqda yeni şifrə formunu göstərir və uyğunsuz şifrəni rədd edir', async () => {
    signIn('student');
    const user = userEvent.setup();
    renderAt('/reset-password');
    await user.type(await screen.findByLabelText('Yeni şifrə'), 'parol1234');
    await user.type(screen.getByLabelText('Şifrəni təkrarlayın'), 'basqa1234');
    await user.click(screen.getByRole('button', { name: 'Şifrəni yenilə' }));
    expect(await screen.findByText('Şifrələr eyni deyil')).toBeInTheDocument();
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
