import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { announcementsApi, eventsApi } from '@/services/content';
import { listReadKeys, markRead } from '@/services/personal';
import { useAsync } from './useAsync';
import type { NotificationItem } from '@/types';

/** Bildirişlər elan və tədbirlərdən törədilir; oxunma vəziyyəti users/{uid}/notificationReads-də saxlanılır. */
export function useNotifications() {
  const { user } = useAuth();
  const src = useAsync(async () => {
    if (!user) return { items: [] as NotificationItem[] };
    const [ann, ev, reads] = await Promise.all([announcementsApi.list(), eventsApi.list(), listReadKeys(user.uid)]);
    const now = new Date();
    const soon = new Date(now.getTime() + 3 * 864e5).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 864e5).toISOString();
    const items: NotificationItem[] = [
      ...ann.filter((a) => a.createdAt >= monthAgo).map((a) => ({ key: `a-${a.id}`, kind: 'announcement' as const, title: a.title, text: a.summary, href: `/announcements/${a.id}`, date: a.createdAt, read: reads.has(`a-${a.id}`) })),
      ...ev.filter((e) => e.startsAt >= now.toISOString() && e.startsAt <= soon).map((e) => ({ key: `e-${e.id}`, kind: 'event' as const, title: `Tezliklə: ${e.title}`, text: e.location, href: `/events/${e.id}`, date: e.startsAt, read: reads.has(`e-${e.id}`) })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    return { items };
  }, [user?.uid]);

  const items = src.data?.items ?? [];
  const unread = useMemo(() => items.filter((i) => !i.read).length, [items]);

  const read = useCallback(async (keys: string[]) => {
    if (!user || !keys.length) return;
    src.setData((p) => ({ items: (p?.items ?? []).map((i) => (keys.includes(i.key) ? { ...i, read: true } : i)) }));
    try { await markRead(user.uid, keys); } catch { src.reload(); }
  }, [user, src]);

  return { items, unread, loading: src.loading, error: src.error, reload: src.reload, markRead: read };
}
