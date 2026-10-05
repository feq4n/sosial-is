import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { StaffMessage, TeamMember } from '@/types';

const h = vi.hoisted(() => {
  return {
    auth: { user: null as null | { uid: string; email: string }, role: 'student' as 'student' | 'editor' | 'admin' },
    send: vi.fn(),
    listSent: vi.fn(),
    listInbox: vi.fn(),
    markRead: vi.fn(),
    team: vi.fn(),
  };
});

vi.mock('@/lib/supabase', () => ({ isConfigured: true, supabase: {}, NotConfiguredError: class extends Error {} }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ ...h.auth, profile: null, loading: false }) }));

const UUID = '8f14e45f-ceea-467f-a0e6-1f6b0a9a3c11';

/* ------------------------------------------------------------------ komponentlər */
vi.mock('@/services/staffMessages', async (orig) => ({
  ...(await orig<typeof import('@/services/staffMessages')>()),
  sendStaffMessage: (...a: unknown[]) => h.send(...a),
  listSentMessages: (...a: unknown[]) => h.listSent(...a),
  listInboxMessages: (...a: unknown[]) => h.listInbox(...a),
  markStaffMessageRead: (...a: unknown[]) => h.markRead(...a),
}));
vi.mock('@/services/content', async (orig) => ({
  ...(await orig<typeof import('@/services/content')>()),
  teamApi: { list: () => h.team() },
}));

import { ToastProvider } from '@/components/Toast';
import { SendMessageDialog } from '@/components/SendMessageDialog';
import Staff from '@/pages/public/Staff';
import SentMessages from '@/pages/dashboard/SentMessages';
import { AdminInbox } from '@/pages/admin/Inbox';

const wrap = (ui: React.ReactNode, path = '/') => render(<MemoryRouter initialEntries={[path]}><ToastProvider>{ui}</ToastProvider></MemoryRouter>);

describe('SendMessageDialog', () => {
  beforeEach(() => { h.send.mockReset(); });
  const target = { profileId: UUID, name: 'Elnur Rzayev', jobTitle: 'Müəllim' };

  it('alıcı avtomatik göstərilir və dəyişdirilə bilmir', () => {
    wrap(<SendMessageDialog target={target} onClose={() => {}} />);
    const to = screen.getByLabelText('Kimə') as HTMLInputElement;
    expect(to.value).toBe('Elnur Rzayev — Müəllim');
    expect(to).toHaveAttribute('readonly');
  });

  it('boş göndərməyə cəhd xəta göstərir və sorğu getmir', async () => {
    wrap(<SendMessageDialog target={target} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText('Mövzu boş ola bilməz')).toBeInTheDocument();
    expect(screen.getByText('Mesaj boş ola bilməz')).toBeInTheDocument();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('uğurlu göndərmə: loading, bildiriş və bağlanma', async () => {
    let done!: () => void;
    h.send.mockReturnValue(new Promise<void>((r) => { done = r; }));
    const onClose = vi.fn();
    wrap(<SendMessageDialog target={target} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText('Mövzu'), 'İmtahan barədə');
    await userEvent.type(screen.getByLabelText('Mesaj'), 'Salam, sualım var.');
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(h.send).toHaveBeenCalledWith({ recipientId: UUID, subject: 'İmtahan barədə', message: 'Salam, sualım var.' });
    expect(screen.getByRole('button', { name: 'Göndər' })).toBeDisabled();
    done();
    expect(await screen.findByText('Mesajınız göndərildi.')).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('server xətası aydın mesajla göstərilir, pəncərə açıq qalır', async () => {
    h.send.mockRejectedValue(Object.assign(new Error('invalid-recipient'), { code: '23514' }));
    const onClose = vi.fn();
    wrap(<SendMessageDialog target={target} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText('Mövzu'), 'Mövzu');
    await userEvent.type(screen.getByLabelText('Mesaj'), 'Mesaj mətni');
    await userEvent.click(screen.getByRole('button', { name: 'Göndər' }));
    expect(await screen.findByText('Bu əməkdaşa hazırda mesaj göndərmək mümkün deyil.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Ləğv et pəncərəni bağlayır', async () => {
    const onClose = vi.fn();
    wrap(<SendMessageDialog target={target} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ləğv et' }));
    expect(onClose).toHaveBeenCalled();
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

  it('qonaq düyməyə basanda giriş səhifəsinə yönlənir', async () => {
    h.auth.user = null;
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Mesaj göndər: Bağlı Əməkdaş' }));
    expect(await screen.findByText('login səhifəsi')).toBeInTheDocument();
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

  it('artıq oxunmuş mesaj açılanda yenidən işarələnmir', async () => {
    h.listInbox.mockResolvedValue([msg({ id: 'b', subject: 'Köhnə mövzu', status: 'read', readAt: '2026-10-05T10:00:00.000Z' })]);
    wrap(<AdminInbox />);
    await userEvent.click(await screen.findByRole('button', { name: 'Mesajı aç: Köhnə mövzu' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(h.markRead).not.toHaveBeenCalled();
  });
});
