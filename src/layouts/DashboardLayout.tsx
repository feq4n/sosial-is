import { Bell, Bookmark, CalendarDays, ClipboardList, LayoutDashboard, Send, Settings2, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import AppShell, { type NavItem } from './AppShell';

export default function DashboardLayout() {
  const { role } = useAuth();
  const { unread } = useNotifications();
  const items: NavItem[] = [
    { to: '/dashboard', label: 'İcmal', icon: <LayoutDashboard className="size-5" />, end: true },
    { to: '/dashboard/schedule', label: 'Şəxsi cədvəl', icon: <CalendarDays className="size-5" /> },
    { to: '/dashboard/forms', label: 'Formlar və cavablarım', icon: <ClipboardList className="size-5" /> },
    { to: '/dashboard/messages', label: 'Göndərdiyim mesajlar', icon: <Send className="size-5" /> },
    { to: '/dashboard/saved', label: 'Saxlanılanlar', icon: <Bookmark className="size-5" /> },
    { to: '/dashboard/notifications', label: 'Bildirişlər', icon: <Bell className="size-5" />, badge: unread },
    { to: '/dashboard/profile', label: 'Profil', icon: <UserRound className="size-5" /> },
    ...(role === 'admin' || role === 'editor' ? [{ to: '/admin', label: 'İdarəetmə paneli', icon: <Settings2 className="size-5" /> }] : []),
  ];
  return <AppShell items={items} title="Tələbə kabineti" />;
}
