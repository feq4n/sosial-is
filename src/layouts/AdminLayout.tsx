import { BookOpen, CalendarDays, CircleHelp, ClipboardList, GraduationCap, Inbox, LayoutDashboard, Mail, Megaphone, PanelBottom, Settings, UserRound, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useStaffUnread } from '@/hooks/useStaffUnread';
import AppShell, { type NavItem } from './AppShell';

export default function AdminLayout() {
  const { role } = useAuth();
  const unreadMessages = useStaffUnread();
  const items: NavItem[] = [
    { to: '/admin', label: 'Statistika', icon: <LayoutDashboard className="size-5" />, end: true },
    { to: '/admin/announcements', label: 'Elanlar', icon: <Megaphone className="size-5" /> },
    { to: '/admin/materials', label: 'Materiallar', icon: <BookOpen className="size-5" /> },
    { to: '/admin/events', label: 'Tədbirlər', icon: <CalendarDays className="size-5" /> },
    { to: '/admin/inbox', label: 'Mesajlarım', icon: <Inbox className="size-5" />, badge: unreadMessages },
    ...(role === 'admin' ? [
      { to: '/admin/specialties', label: 'İxtisaslar', icon: <GraduationCap className="size-5" /> },
      { to: '/admin/forms', label: 'Formlar', icon: <ClipboardList className="size-5" /> },
      { to: '/admin/team', label: 'Şöbə əməkdaşları', icon: <UserRound className="size-5" /> },
      { to: '/admin/faq', label: 'SSS', icon: <CircleHelp className="size-5" /> },
      { to: '/admin/footer', label: 'Footer', icon: <PanelBottom className="size-5" /> },
      { to: '/admin/site', label: 'Sayt parametrləri', icon: <Settings className="size-5" /> },
      { to: '/admin/users', label: 'İstifadəçilər', icon: <Users className="size-5" /> },
      { to: '/admin/messages', label: 'Mesajlar', icon: <Mail className="size-5" /> },
    ] : []),
  ];
  return <AppShell items={items} title="İdarəetmə paneli" />;
}
