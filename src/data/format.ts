import type { Property } from './types';

/** 2250 -> "2.250" (Romanian thousands separator; avoids depending on Intl support). */
export const formatNumber = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const formatRon = (n: number) => `${formatNumber(n)} lei`;

export function describeSize(p: Pick<Property, 'type' | 'bedrooms'>): string {
  if (p.type === 'studio') return 'Studio';
  if (p.type === 'private_room') return 'Private room';
  if (p.type === 'shared_room') return 'Shared room';
  return `${p.bedrooms} ${p.bedrooms === 1 ? 'bedroom' : 'bedrooms'}`;
}

/** e.g. "Studio · 12 min to ASE" */
export function describeDetail(p: Property): string {
  const { name, minutes } = p.nearestUniversity;
  return `${describeSize(p)} · ${minutes} min to ${name}`;
}
