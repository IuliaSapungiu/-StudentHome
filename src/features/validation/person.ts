export function validateFullName(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter your full name.';
  if (v.length < 3 || !/\p{L}/u.test(v)) return 'Enter your first and last name.';
  if (v.length > 100) return 'This name is too long.';
  return null;
}

/** Optional field: empty is fine, otherwise it must look like a web address. */
export function validateWebsite(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v) ? null : 'Enter a valid website address, for example www.example.ro.';
}
