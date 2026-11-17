// FICTIONAL DEMO ADDRESSES. These streets and numbers are invented and do not point to real homes.
// Kept apart from the public listing data on purpose: the exact address is never part of a listing. It is only
// released to the student (and the owner) once a viewing is CONFIRMED (see ViewingRepository.getConfirmedAddress).
// In production this is a restricted table, served by a function that checks the viewing status.
export const DEMO_PROPERTY_ADDRESSES: Record<string, string> = {
  'demo-1': 'Strada Lănăriei 78, Bucharest',
  'demo-2': 'Strada Studenților 14, Bucharest',
  'demo-3': 'Strada Fabricii 22, Cluj-Napoca',
  'demo-4': 'Strada Teilor 5, Iași',
  'demo-5': 'Bulevardul Exemplu 31, Bucharest',
  'demo-6': 'Strada Castanilor 9, Bucharest',
  'demo-7': 'Strada Gării 40, Cluj-Napoca',
  'demo-8': 'Strada Observatorului 18, Cluj-Napoca',
  'demo-9': 'Strada Palatului 3, Iași',
  'demo-10': 'Aleea Campusului 2, Timișoara',
  'demo-11': 'Strada Liniștii 27, Timișoara',
};
