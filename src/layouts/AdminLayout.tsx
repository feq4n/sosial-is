import { BookOpen, CalendarClock, CalendarDays, LayoutDashboard, Mail, Megaphone, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AppShell, { type NavItem } from './AppShell';

export default function AdminLayout() {
  const { role } = useAuth();
  const items: NavItem[] = [
    { to: '/admin', label: 'Statistika', icon: <LayoutDashboard className="size-5" />, end: true },
    { to: '/admin/announcements', label: 'Elanlar', icon: <Megaphone className="size-5" /> },
    { to: '/admin/materials', label: 'Materiallar', icon: <BookOpen className="size-5" /> },
    { to: '/admin/events', label: 'Tədbirlər', icon: <CalendarDays className="size-5" /> },
    { to: '/admin/schedule', label: 'Dərs cədvəli', icon: <CalendarClock className="size-5" /> },
    ...(role === 'admin' ? [
      { to: '/admin/users', label: 'İstifadəçilər', icon: <Users className="size-5" /> },
      { to: '/admin/messages', label: 'Mesajlar', icon: <Mail className="size-5" /> },
    ] : []),
  ];
  return <AppShell items={items} title="İdarəetmə paneli" />;
}
