// Tiny validators for reading mock-persisted records. Anything that does not fit is dropped, never trusted.
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const asString = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
export const asStringOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
export const asIsoTimestamp = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
export const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);
export const asInt = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);
