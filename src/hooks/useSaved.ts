import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { listSavedIds, saveMaterial, unsaveMaterial } from '@/services/personal';
import { useToast } from '@/components/Toast';
import { friendlyError } from '@/utils/errors';

export function useSaved() {
  const { user } = useAuth();
  const toast = useToast();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user) { setIds(new Set()); setReady(true); return; }
    listSavedIds(user.uid).then((l) => alive && setIds(new Set(l))).catch(() => undefined).finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, [user]);

  const toggle = useCallback(async (id: string) => {
    if (!user) return;
    const has = ids.has(id);
    const next = new Set(ids);
    has ? next.delete(id) : next.add(id);
    setIds(next); // optimistik
    try {
      if (has) await unsaveMaterial(user.uid, id); else await saveMaterial(user.uid, id);
      toast.success(has ? 'Material siyahıdan çıxarıldı' : 'Material yadda saxlanıldı');
    } catch (e) {
      setIds(ids);
      toast.error(friendlyError(e));
    }
  }, [user, ids, toast]);

  return { ids, ready, toggle, signedIn: !!user };
}
