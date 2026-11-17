import type { BadgeTone } from '@/components/StatusBadge';
import { isExpired } from '@/features/viewings/viewingRules';
import type { ViewingRequest } from '@/features/viewings/types';

export function viewingTone(v: ViewingRequest, nowLocal: string): BadgeTone {
  if (isExpired(v, nowLocal)) return 'neutral';
  switch (v.status) {
    case 'confirmed': return 'success';
    case 'pending': return 'warning';
    case 'alternative_proposed': return 'info';
    case 'declined': return 'danger';
    case 'cancelled': return 'neutral';
    case 'completed': return 'success';
  }
}
