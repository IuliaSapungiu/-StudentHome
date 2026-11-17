import { useEffect, useMemo, useState } from 'react';
import { propertyRepository, type Property } from '@/data';

/**
 * Loads the public listings among the given ids. A home that is no longer listed is simply missing from
 * `byId`, so screens show "no longer available" instead of crashing.
 */
export function usePropertiesById(ids: string[]): { byId: Record<string, Property>; loaded: boolean } {
  const key = useMemo(() => [...new Set(ids)].sort().join('|'), [ids]);
  const [state, setState] = useState<{ key: string; byId: Record<string, Property> } | null>(null);

  useEffect(() => {
    let alive = true;
    const wanted = key ? key.split('|') : [];
    if (wanted.length === 0) {
      setState({ key, byId: {} });
      return;
    }
    propertyRepository.getByIds(wanted).then((list) => {
      if (alive) setState({ key, byId: Object.fromEntries(list.map((p) => [p.id, p])) });
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return { byId: state?.byId ?? {}, loaded: state?.key === key };
}
