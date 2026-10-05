import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { isConfigured } from '@/lib/supabase';
import { STAFF_MESSAGES_CHANGED } from '@/lib/staffMessages';
import { countUnreadStaffMessages } from '@/services/staffMessages';

/** Əməkdaşın oxunmamış mesaj sayı (yan menyu nişanı üçün). Mesaj açılanda və səhifəyə qayıdanda yenilənir. */
export function useStaffUnread(): number {
  const { user, role } = useAuth();
  const [count, setCount] = useState(0);
  const uid = user?.uid;
  const enabled = isConfigured && !!uid && (role === 'admin' || role === 'editor');

  const load = useCallback(() => {
    if (!enabled || !uid) return;
    countUnreadStaffMessages(uid).then(setCount).catch(() => {});
  }, [enabled, uid]);

  useEffect(() => {
    if (!enabled) { setCount(0); return; }
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener(STAFF_MESSAGES_CHANGED, load);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener(STAFF_MESSAGES_CHANGED, load); document.removeEventListener('visibilitychange', onVisible); };
  }, [enabled, load]);

  return count;
}
