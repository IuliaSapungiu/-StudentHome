import type { ProviderType } from '../plans/types';
import type { FormDefinition } from './types';

/** Source of form definitions. Mock now (static data); a Supabase table or remote config later. */
export interface FormConfigRepository {
  getRegistrationForm(): Promise<FormDefinition>;
  getProviderForm(type: ProviderType): Promise<FormDefinition>;
}
