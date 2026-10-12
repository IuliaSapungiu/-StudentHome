import { validateEmail, validateNewPassword } from '../session/validation';
import { normalizeCui, validateCui, normalizeOnrc, validateOnrc } from '../validation/companyIds';
import { normalizePhone, validatePhone } from '../validation/phone';
import { validateFullName, validateWebsite } from '../validation/person';
import type { Answers, Condition, FieldDefinition, FieldValue, FormDefinition } from './types';

function holds(c: Condition, answers: Answers): boolean {
  const actual = answers[c.field];
  if (c.op === 'eq') return actual === c.value;
  if (c.op === 'neq') return actual !== c.value;
  return Array.isArray(c.value) && actual !== undefined && c.value.includes(actual);
}
const allHold = (cs: Condition[] | undefined, answers: Answers) => !cs || cs.every((c) => holds(c, answers));

export const isFieldVisible = (f: FieldDefinition, answers: Answers) => allHold(f.visibleWhen, answers);

export const isFieldRequired = (f: FieldDefinition, answers: Answers) =>
  isFieldVisible(f, answers) && (f.required === true || (f.requiredWhen !== undefined && allHold(f.requiredWhen, answers)));

export const getVisibleFields = (form: FormDefinition, answers: Answers) => form.fields.filter((f) => isFieldVisible(f, answers));

const isEmpty = (v: FieldValue) => v === undefined || v === '' || (typeof v === 'string' && v.trim() === '');

function validateValue(f: FieldDefinition, v: FieldValue): string | null {
  const text = typeof v === 'string' ? v : '';
  switch (f.type) {
    case 'name': return validateFullName(text);
    case 'email': return validateEmail(text);
    case 'phone': return validatePhone(text);
    case 'password': return validateNewPassword(text);
    case 'cui': return validateCui(text);
    case 'onrc': return validateOnrc(text);
    case 'url': return validateWebsite(text);
    case 'number': {
      const n = Number(text);
      return Number.isInteger(n) && n >= (f.min ?? 0) ? null : `Enter a whole number${f.min !== undefined ? ` of ${f.min} or more` : ''}.`;
    }
    case 'select': return f.options?.some((o) => o.value === text) ? null : 'Choose one of the options.';
    case 'boolean': return null;
    default: return text.length > 200 ? 'This is too long.' : null;
  }
}

/** Returns an error message per field key. Empty object = valid. Hidden fields are ignored. */
export function validateForm(form: FormDefinition, answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of getVisibleFields(form, answers)) {
    const v = answers[f.key];
    const required = isFieldRequired(f, answers);
    if (f.type === 'boolean') {
      if (required && v !== true) errors[f.key] = `Please accept to continue.`;
      continue;
    }
    if (isEmpty(v)) {
      if (required) errors[f.key] = f.type === 'select' ? 'Choose an option.' : 'This field is required.';
      continue; // optional and empty
    }
    const error = validateValue(f, v);
    if (error) errors[f.key] = error;
  }
  for (const rule of form.rules ?? []) {
    const visible = rule.fields.filter((k) => form.fields.find((f) => f.key === k && isFieldVisible(f, answers)));
    if (visible.length && visible.every((k) => isEmpty(answers[k])) && !visible.some((k) => errors[k])) {
      errors[visible[0]] = rule.message;
    }
  }
  return errors;
}

/** Keeps only visible fields and normalises values (phone to E.164, CUI/ONRC canonical, trimmed text). */
export function cleanAnswers(form: FormDefinition, answers: Answers): Answers {
  const out: Answers = {};
  for (const f of getVisibleFields(form, answers)) {
    const v = answers[f.key];
    if (isEmpty(v) && f.type !== 'boolean') continue;
    if (typeof v !== 'string') { out[f.key] = v; continue; }
    out[f.key] =
      f.type === 'phone' ? (normalizePhone(v) ?? v.trim())
      : f.type === 'cui' ? normalizeCui(v)
      : f.type === 'onrc' ? (normalizeOnrc(v) ?? v.trim())
      : v.trim();
  }
  return out;
}
