import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { StaffMessage, TeamMember } from '@/types';

const h = vi.hoisted(() => {
  return {
    auth: { user: null as null | { uid: string; email: string }, role: 'student' as 'student' | 'editor' | 'admin', profile: null as null | { firstName: string; lastName: string; group?: string } },
    send: vi.fn(),
    listSent: vi.fn(),
    listInbox: vi.fn(),
    markRead: vi.fn(),
    team: vi.fn(),
  };
});

vi.mock('@/lib/supabase', () => ({ isConfigured: true, supabase: {}, NotConfiguredError: class extends Error {} }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ ...h.auth, loading: false }) }));

const UUID = '8f14e45f-ceea-467f-a0e6-1f6b0a9a3c11';

/* ------------------------------------------------------------------ komponentlər */
vi.mock('@/services/staffMessages', async (orig) => ({
  ...(await orig<typeof import('@/services/staffMessages')>()),
  sendStaffMessage: (...a: unknown[]) => h.send(...a),
  listSentMessages: (...a: unknown[]) => h.listSent(...a),
  listInboxMessages: (...a: unknown[]) => h.listInbox(...a),
  markStaffMessageRead: (...a: unknown[]) => h.markRead(...a),
}));
vi.mock('@/services/site', async (orig) => ({
  ...(await orig<typeof import('@/services/site')>()),
  useContactInfo: () => ({ email: 'info@example.az', phone: '', address: '', has: true }),
}));
vi.mock('@/services/content', async (orig) => ({
  ...(await orig<typeof import('@/services/content')>()),
  teamApi: { list: () => h.team() },
}));

import { ToastProvider } from '@/components/Toast';
import { SendMessageDialog } from '@/components/SendMessageDialog';
import Staff from '@/pages/public/Staff';
import Contact from '@/pages/public/Contact';
import SentMessages from '@/pages/dashboard/SentMessages';
import { AdminInbox } from '@/pages/admin/Inbox';

const wrap = (ui: React.ReactNode, path = '/') => render(<MemoryRouter initialEntries={[path]}><ToastProvider>{ui}</ToastProvider></MemoryRouter>);

describe('SendMessageDialog', () => {
  beforeEach(() => { h.send.mockReset(); h.auth.user = null; h.auth.profile = null; });
  const target = { profileId: UUID, name: 'Elnur Rzayev', jobTitle: 'Müəllim' };
  const fill = async (subject = 'İmtahan barədə', message = 'Salam, sualım var.') => {
    await userEvent.type(screen.getByLabelText('Mövzu'), subject);
    await userEvent.type(screen.getByLabelText('Mesaj'), message);
  };

  it('alıcı avtomatik göstərilir və dəyişdirilə bilmir', () => {
    wrap(<SendMessageDialog target={target} onClose={() => {}} />);
    const to = screen.getByLabelText('Kimə') as HTMLInputElement;
    expect(to.value).toBe('Elnur Rzayev — Müəllim');
    expect(to).toHaveAttribute('readonly');
  });

  it('qonaqda ad və qrup boşdur və doldurula bilir', () => {
    wrap(<SendMessageDialog target={target} onClose={() => {}} />);
    expect(screen.getByLabelText('Ad və soyad')).toHaveValue('');
    expect(screen.getByLabelText('Ad və soyad')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Qrup')).toHaveValue('');
    expect(screen.getByLabelText('Qrup')).not.toHaveAttribute('readonly');
  });

  it('girişli istifadəçidə ad və qrup profildən avtomatik gəlir və dəyişdirilə bilmir', () => {
    h.auth.user = { uid: 'student-1', email: 'a@b.az' };
    h.auth.profile = { firstName: 'Aysel', lastName: 'Məmmədova', group: 'KŞATS 25/01' };
    wrap(<SendMessageDialog target={target} onClose={() => {}} />);
    expect(screen.getByLabelText('Ad və soyad')).toHaveValue('Aysel Məmmədova');
    expect(screen.getByLabelText('Ad və soyad')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Qrup')).toHaveValue('KŞATS 25/01');
    expect(screen.getByLabelText('Qrup')).toHaveAttribute('readonly');
  });

  it('profildə qrup yoxdursa girişli istifadəçi qrupu özü yazır, ad yenə kilidlidir', async () => {
    h.auth.user = { uid: 'student-1', email: 'a@b.az' };
    h.auth.profile = { firstName: 'Aysel', lastName: 'Məmmədova' };
    h.send.mockResolvedValue(undefined);
    wrap(<SendMessageDialog target={target} onClose={() => {}} />);
    expect(screen.getByLabelText('Ad və soyad')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Qrup')).not.toHaveAttribute('readonly');
    await userEvent.type(screen.getByLabelText('Qrup'), 'KŞATS 25/01');
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(h.send).toHaveBeenCalledWith({ recipientId: UUID, senderName: 'Aysel Məmmədova', senderGroup: 'KŞATS 25/01', subject: 'İmtahan barədə', message: 'Salam, sualım var.' });
  });

  it('boş göndərməyə cəhd bütün məcburi sahələr üçün xəta göstərir və sorğu getmir', async () => {
    wrap(<SendMessageDialog target={target} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText('Ad və soyad boş ola bilməz')).toBeInTheDocument();
    expect(screen.getByText('Qrup boş ola bilməz')).toBeInTheDocument();
    expect(screen.getByText('Mövzu boş ola bilməz')).toBeInTheDocument();
    expect(screen.getByText('Mesaj boş ola bilməz')).toBeInTheDocument();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('yalnız boşluqdan ibarət ad qəbul edilmir', async () => {
    wrap(<SendMessageDialog target={target} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText('Ad və soyad'), '   ');
    await userEvent.type(screen.getByLabelText('Qrup'), 'KŞATS 25/01');
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText('Ad və soyad boş ola bilməz')).toBeInTheDocument();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('qonaq üçün uğurlu göndərmə: giriş tələb olunmur, loading, bildiriş və bağlanma', async () => {
    let done!: () => void;
    h.send.mockReturnValue(new Promise<void>((r) => { done = r; }));
    const onClose = vi.fn();
    wrap(<SendMessageDialog target={target} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText('Ad və soyad'), 'Fəqan Gəraylı');
    await userEvent.type(screen.getByLabelText('Qrup'), 'KŞATS 25/01');
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(h.send).toHaveBeenCalledWith({ recipientId: UUID, senderName: 'Fəqan Gəraylı', senderGroup: 'KŞATS 25/01', subject: 'İmtahan barədə', message: 'Salam, sualım var.' });
    expect(screen.getByRole('button', { name: 'Göndər' })).toBeDisabled();
    done();
    expect(await screen.findByText('Mesajınız göndərildi.')).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('server xətası aydın mesajla göstərilir, pəncərə açıq qalır', async () => {
    h.send.mockRejectedValue(Object.assign(new Error('invalid-recipient'), { code: '23514' }));
    const onClose = vi.fn();
    wrap(<SendMessageDialog target={target} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText('Ad və soyad'), 'Fəqan Gəraylı');
    await userEvent.type(screen.getByLabelText('Qrup'), 'KŞATS 25/01');
    await fill('Mövzu', 'Mesaj mətni');
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText('Bu əməkdaşa hazırda mesaj göndərmək mümkün deyil.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sürət limiti xətası aydın mesajla göstərilir', async () => {
    h.send.mockRejectedValue(Object.assign(new Error('message-rate-limit'), { code: '54000' }));
    wrap(<SendMessageDialog target={target} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText('Ad və soyad'), 'Fəqan Gəraylı');
    await userEvent.type(screen.getByLabelText('Qrup'), 'KŞATS 25/01');
    await fill('Mövzu', 'Mesaj mətni');
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText('Qısa müddətdə çox mesaj göndərdiniz. Bir az gözləyib yenidən cəhd edin.')).toBeInTheDocument();
  });

  it('Ləğv et pəncərəni bağlayır', async () => {
    const onClose = vi.fn();
    wrap(<SendMessageDialog target={target} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ləğv et' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Əlaqə səhifəsi: əməkdaşa mesaj', () => {
  const member = (o: Partial<TeamMember>): TeamMember => ({ id: 'x', fullName: 'Ad Soyad', jobTitle: 'Müəllim', bio: '', sortOrder: 1, active: true, createdAt: '2026-01-01T00:00:00Z', ...o });
  const UUID2 = '1a2b3c4d-0000-4000-8000-000000000002';

  beforeEach(() => {
    h.send.mockReset();
    h.auth.user = null;
    h.auth.profile = null;
    h.team.mockResolvedValue([
      member({ id: '1', fullName: 'Aysel Məmmədova', jobTitle: 'Dekan müavini', profileId: UUID }),
      member({ id: '2', fullName: 'Hesabsız Əməkdaş' }),
      member({ id: '3', fullName: 'Gizli Əməkdaş', profileId: UUID2, active: false }),
    ]);
  });

  const pick = async () => userEvent.selectOptions(await screen.findByLabelText('Kimə'), UUID);
  const typeAll = async (skip?: string) => {
    const values: [string, string][] = [['Ad və soyad', 'Fəqan Gəraylı'], ['Qrup', 'KŞATS 25/01'], ['Mövzu', 'Dərs cədvəli'], ['Mesaj', 'Salam, dərs cədvəli ilə bağlı sualım var.']];
    for (const [l, v] of values) if (l !== skip) await userEvent.type(screen.getByLabelText(l), v);
  };

  it('qonaq giriş etmədən formu görür; Kimə siyahısında yalnız aktiv və hesaba bağlı əməkdaşlar var', async () => {
    wrap(<Contact />);
    const select = await screen.findByLabelText('Kimə');
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Əməkdaşı seçin', 'Aysel Məmmədova — Dekan müavini']);
    for (const l of ['Ad və soyad', 'Qrup', 'Mövzu', 'Mesaj']) expect(screen.getByLabelText(l)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Göndər' })).toBeInTheDocument();
    expect(screen.queryByText(/giriş edin/i)).toBeNull();
  });

  it('qonaq mesajı konkret əməkdaşa göndərə bilir (login və qeydiyyatsız)', async () => {
    h.send.mockResolvedValue(undefined);
    wrap(<Contact />);
    await pick();
    await typeAll();
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(h.send).toHaveBeenCalledWith({ recipientId: UUID, senderName: 'Fəqan Gəraylı', senderGroup: 'KŞATS 25/01', subject: 'Dərs cədvəli', message: 'Salam, dərs cədvəli ilə bağlı sualım var.' });
    expect(Object.keys(h.send.mock.calls[0][0])).not.toContain('senderId');
    expect(await screen.findByText('Mesajınız göndərildi.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Mövzu')).toHaveValue(''));
    expect(screen.getByLabelText('Mesaj')).toHaveValue('');
  });

  it.each([
    ['Ad və soyad', 'Ad və soyad boş ola bilməz'],
    ['Qrup', 'Qrup boş ola bilməz'],
    ['Mövzu', 'Mövzu boş ola bilməz'],
    ['Mesaj', 'Mesaj boş ola bilməz'],
  ])('%s boşdursa göndərmək olmur', async (field, error) => {
    wrap(<Contact />);
    await pick();
    await typeAll(field);
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText(error)).toBeInTheDocument();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('əməkdaş seçilməyibsə göndərmək olmur', async () => {
    wrap(<Contact />);
    await screen.findByLabelText('Kimə');
    await typeAll();
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText('Əməkdaşı seçin', { selector: 'p, span, div' })).toBeInTheDocument();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('girişli istifadəçidə ad və qrup profildən doldurulur və dəyişdirilə bilmir', async () => {
    h.auth.user = { uid: 'student-1', email: 'a@b.az' };
    h.auth.profile = { firstName: 'Fəqan', lastName: 'Gəraylı', group: 'KŞATS 25/01' };
    h.send.mockResolvedValue(undefined);
    wrap(<Contact />);
    await pick();
    expect(screen.getByLabelText('Ad və soyad')).toHaveValue('Fəqan Gəraylı');
    expect(screen.getByLabelText('Ad və soyad')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Qrup')).toHaveValue('KŞATS 25/01');
    expect(screen.getByLabelText('Qrup')).toHaveAttribute('readonly');
    await userEvent.type(screen.getByLabelText('Mövzu'), 'Dərs cədvəli');
    await userEvent.type(screen.getByLabelText('Mesaj'), 'Salam, dərs cədvəli ilə bağlı sualım var.');
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(h.send).toHaveBeenCalledWith({ recipientId: UUID, senderName: 'Fəqan Gəraylı', senderGroup: 'KŞATS 25/01', subject: 'Dərs cədvəli', message: 'Salam, dərs cədvəli ilə bağlı sualım var.' });
  });

  it('əməkdaş siyahısı boşdursa izahat göstərilir', async () => {
    h.team.mockResolvedValue([member({ id: '2', fullName: 'Hesabsız Əməkdaş' })]);
    wrap(<Contact />);
    expect(await screen.findByText('Mesaj göndərmək üçün hazırda əməkdaş əlavə olunmayıb.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Göndər' })).toBeNull();
  });
});

describe('Staff səhifəsi', () => {
  const member = (o: Partial<TeamMember>): TeamMember => ({ id: 'x', fullName: 'Ad Soyad', jobTitle: 'Müəllim', bio: '', sortOrder: 1, active: true, createdAt: '2026-01-01T00:00:00Z', ...o });
  const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
  const mount = () => wrap(<><Routes><Route path="/staff" element={<Staff />} /><Route path="/login" element={<p>login səhifəsi</p>} /></Routes><Where /></>, '/staff');

  beforeEach(() => {
    h.auth.user = { uid: 'student-1', email: 'a@b.az' };
    h.team.mockResolvedValue([member({ id: '1', fullName: 'Bağlı Əməkdaş', profileId: UUID }), member({ id: '2', fullName: 'Bağlı Olmayan' }), member({ id: '3', fullName: 'Mən Özüm', profileId: 'student-1' })]);
  });

  it('düymə yalnız hesaba bağlı (və özün olmayan) əməkdaşın kartında görünür', async () => {
    mount();
    expect(await screen.findByRole('button', { name: 'Mesaj göndər: Bağlı Əməkdaş' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mesaj göndər: Bağlı Olmayan/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Mesaj göndər: Mən Özüm/ })).toBeNull();
  });

  it('düymə modalı açır, alıcı kartdan gəlir', async () => {
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Mesaj göndər: Bağlı Əməkdaş' }));
    const dlg = await screen.findByRole('dialog');
    expect((within(dlg).getByLabelText('Kimə') as HTMLInputElement).value).toContain('Bağlı Əməkdaş');
  });

  it('qonaq düyməyə basanda giriş səhifəsinə yönlənmir, ad və qrup sahələri olan forma açılır', async () => {
    h.auth.user = null;
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Mesaj göndər: Bağlı Əməkdaş' }));
    const dlg = await screen.findByRole('dialog');
    expect(screen.queryByText('login səhifəsi')).toBeNull();
    expect(screen.getByTestId('where')).toHaveTextContent('/staff');
    expect(within(dlg).getByLabelText('Ad və soyad')).toBeInTheDocument();
    expect(within(dlg).getByLabelText('Qrup')).toBeInTheDocument();
    expect((within(dlg).getByLabelText('Kimə') as HTMLInputElement).value).toContain('Bağlı Əməkdaş');
  });

  it('qonaq /staff üzərindən də eyni göndərmə yolu ilə mesaj göndərir', async () => {
    h.auth.user = null;
    h.send.mockResolvedValue(undefined);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Mesaj göndər: Bağlı Əməkdaş' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText('Ad və soyad'), 'Fəqan Gəraylı');
    await userEvent.type(within(dlg).getByLabelText('Qrup'), 'KŞATS 25/01');
    await userEvent.type(within(dlg).getByLabelText('Mövzu'), 'Dərs cədvəli');
    await userEvent.type(within(dlg).getByLabelText('Mesaj'), 'Salam, sualım var.');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Göndər' }));
    expect(h.send).toHaveBeenCalledWith({ recipientId: UUID, senderName: 'Fəqan Gəraylı', senderGroup: 'KŞATS 25/01', subject: 'Dərs cədvəli', message: 'Salam, sualım var.' });
  });
});

describe('Göndərdiyim mesajlar', () => {
  const msg = (o: Partial<StaffMessage>): StaffMessage => ({ id: 'm', senderId: 'student-1', recipientId: UUID, subject: 'Mövzu', message: 'Tam mətn', status: 'sent', createdAt: '2026-10-05T09:00:00.000Z', senderName: 'Aysel', recipientName: 'Elnur Rzayev', ...o });
  beforeEach(() => { h.auth.user = { uid: 'student-1', email: 'a@b.az' }; });

  it('kimə, mövzu, tarix və status göstərilir; mesaj açılır, redaktə/silmə/yönləndirmə yoxdur', async () => {
    h.listSent.mockResolvedValue([msg({ id: 'a', subject: 'Birinci', status: 'sent' }), msg({ id: 'b', subject: 'İkinci', status: 'read', readAt: '2026-10-06T09:00:00.000Z' })]);
    wrap(<SentMessages />);
    expect(await screen.findByText('Birinci')).toBeInTheDocument();
    expect(h.listSent).toHaveBeenCalledWith('student-1');
    expect(screen.getAllByText(/Kimə: Elnur Rzayev/)).toHaveLength(2);
    expect(screen.getByText('Göndərildi')).toBeInTheDocument();
    expect(screen.getByText('Oxundu')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mesajı aç: İkinci' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByTestId('staff-message-body')).toHaveTextContent('Tam mətn');
    expect(within(dlg).queryByRole('button', { name: /redaktə|sil|yönləndir/i })).toBeNull();
  });

  it('boş vəziyyət', async () => {
    h.listSent.mockResolvedValue([]);
    wrap(<SentMessages />);
    expect(await screen.findByText('Hələ mesaj göndərməmisiniz')).toBeInTheDocument();
  });
});

describe('Mesajlarım (əməkdaş)', () => {
  const msg = (o: Partial<StaffMessage>): StaffMessage => ({ id: 'm', senderId: 's', recipientId: 'staff-1', subject: 'Mövzu', message: 'Tam mətn', status: 'sent', createdAt: '2026-10-05T09:00:00.000Z', senderName: 'Aysel Əliyeva', recipientName: 'Elnur', ...o });
  beforeEach(() => { h.auth.user = { uid: 'staff-1', email: 'e@b.az' }; h.auth.role = 'editor'; h.markRead.mockReset(); });

  it('oxunmamış fərqlənir; açıldıqda tam məzmun göstərilir və mesaj «Oxundu» olur', async () => {
    h.listInbox.mockResolvedValue([msg({ id: 'a', subject: 'Yeni mövzu' }), msg({ id: 'b', subject: 'Köhnə mövzu', status: 'read', readAt: '2026-10-05T10:00:00.000Z' })]);
    h.markRead.mockResolvedValue({ readAt: '2026-10-07T08:00:00.000Z' });
    wrap(<AdminInbox />);
    expect(await screen.findByText('Yeni mövzu')).toBeInTheDocument();
    expect(h.listInbox).toHaveBeenCalledWith('staff-1');
    expect(screen.getAllByText(/Kimdən: Aysel Əliyeva/)).toHaveLength(2);
    expect(screen.getAllByText('Oxunmamış')).toHaveLength(1);
    expect(screen.getByText('1 oxunmamış mesajınız var.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mesajı aç: Yeni mövzu' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByTestId('staff-message-body')).toHaveTextContent('Tam mətn');
    expect(h.markRead).toHaveBeenCalledWith('a');
    await waitFor(() => expect(screen.queryByText('Oxunmamış')).toBeNull());
  });

  it('əməkdaş mesajı açanda göndərənin adı, qrupu, mövzusu və tarixi aydın göstərilir, sonra mesajın özü', async () => {
    h.listInbox.mockResolvedValue([msg({ id: 'a', subject: 'Dərs cədvəli', senderName: 'Fəqan Gəraylı', senderGroup: 'KŞATS 25/01', message: 'Salam, dərs cədvəli ilə bağlı sualım var.' })]);
    h.markRead.mockResolvedValue({ readAt: '2026-10-07T08:00:00.000Z' });
    wrap(<AdminInbox />);
    await userEvent.click(await screen.findByRole('button', { name: 'Mesajı aç: Dərs cədvəli' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Göndərən')).toBeInTheDocument();
    expect(within(dlg).getByTestId('staff-message-sender')).toHaveTextContent('Fəqan Gəraylı');
    expect(within(dlg).getByText('Qrup')).toBeInTheDocument();
    expect(within(dlg).getByTestId('staff-message-group')).toHaveTextContent('KŞATS 25/01');
    expect(within(dlg).getByText('Mövzu')).toBeInTheDocument();
    expect(within(dlg).getByText('Tarix')).toBeInTheDocument();
    expect(within(dlg).getByTestId('staff-message-body')).toHaveTextContent('Salam, dərs cədvəli ilə bağlı sualım var.');
  });

  it('qonaq mesajında (senderId yoxdur) göndərən anonim göstərilmir, ad və qrup görünür', async () => {
    h.listInbox.mockResolvedValue([msg({ id: 'g', senderId: undefined, subject: 'Qonaq sualı', senderName: 'Fəqan Gəraylı', senderGroup: 'KŞATS 25/01' })]);
    h.markRead.mockResolvedValue({ readAt: '2026-10-07T08:00:00.000Z' });
    wrap(<AdminInbox />);
    expect(await screen.findByText(/Kimdən: Fəqan Gəraylı · KŞATS 25\/01/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mesajı aç: Qonaq sualı' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByTestId('staff-message-sender')).toHaveTextContent('Fəqan Gəraylı');
    expect(within(dlg).getByTestId('staff-message-group')).toHaveTextContent('KŞATS 25/01');
    expect(within(dlg).queryByText(/anonim/i)).toBeNull();
    expect(h.markRead).toHaveBeenCalledWith('g');
  });

  it('artıq oxunmuş mesaj açılanda yenidən işarələnmir', async () => {
    h.listInbox.mockResolvedValue([msg({ id: 'b', subject: 'Köhnə mövzu', status: 'read', readAt: '2026-10-05T10:00:00.000Z' })]);
    wrap(<AdminInbox />);
    await userEvent.click(await screen.findByRole('button', { name: 'Mesajı aç: Köhnə mövzu' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(h.markRead).not.toHaveBeenCalled();
  });
});
