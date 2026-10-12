import { useEffect, useState } from 'react';
import { formConfigRepository } from '@/services';
import type { ProviderType } from '../plans/types';
import type { FormDefinition } from './types';

/** Loads the registration form definition (null while loading). Screens never touch the repository directly. */
export function useRegistrationForm(): FormDefinition | null {
  const [form, setForm] = useState<FormDefinition | null>(null);
  useEffect(() => {
    let alive = true;
    formConfigRepository.getRegistrationForm().then((f) => alive && setForm(f));
    return () => {
      alive = false;
    };
  }, []);
  return form;
}

/** Loads a provider onboarding form definition. Rendered by the Step 4 onboarding screens. */
export function useProviderForm(type: ProviderType): FormDefinition | null {
  const [form, setForm] = useState<FormDefinition | null>(null);
  useEffect(() => {
    let alive = true;
    formConfigRepository.getProviderForm(type).then((f) => alive && setForm(f));
    return () => {
      alive = false;
    };
  }, [type]);
  return form;
}
