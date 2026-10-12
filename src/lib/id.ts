// UUID-shaped ids for mock records so they map onto Postgres `uuid` columns later.
// DEMO ONLY: Math.random is not secure. In production the database or Supabase Auth generates ids.
export function newId(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.floor(Math.random() * 4)) + 8];
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}
