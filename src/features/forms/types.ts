export type FieldType = 'text' | 'name' | 'email' | 'phone' | 'password' | 'number' | 'url' | 'boolean' | 'select' | 'cui' | 'onrc';

export type FieldValue = string | boolean | undefined;
export type Answers = Record<string, FieldValue>;

/** A condition on another field's answer. All conditions in a list must hold. */
export type Condition = { field: string; op: 'eq' | 'neq' | 'in'; value: string | boolean | (string | boolean)[] };

export type FieldDefinition = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  min?: number;
  /** Always required (when visible). */
  required?: boolean;
  /** Required (when visible) only if all these conditions hold. */
  requiredWhen?: Condition[];
  /** Shown only if all these conditions hold; hidden fields are neither validated nor kept. */
  visibleWhen?: Condition[];
};

/** Cross-field rule: at least one of these fields must have a value. */
export type AtLeastOneRule = { type: 'at_least_one'; fields: string[]; message: string };

export type FormDefinition = {
  id: string;
  title: string;
  fields: FieldDefinition[];
  rules?: AtLeastOneRule[];
};
