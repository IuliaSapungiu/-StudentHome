import type { ProviderType } from '../plans/types';
import type { Condition, FieldDefinition, FormDefinition } from './types';

// Data, not UI: which fields each provider type sees and when they are required.
// Everything here describes DATA ENTERED BY THE USER. Entering a CUI/ONRC does not verify the
// company, and does not prove the representative may act for it. Those are separate verifications.

const eq = (field: string, value: string | boolean): Condition => ({ field, op: 'eq', value });
const RO = eq('country', 'RO');
const OTHER = eq('country', 'OTHER');

const COUNTRY: FieldDefinition = {
  key: 'country', label: 'Country', type: 'select', required: true,
  options: [{ value: 'RO', label: 'Romania' }, { value: 'OTHER', label: 'Another country' }],
};
const OTHER_COUNTRY: FieldDefinition = { key: 'otherCountry', label: 'Which country?', type: 'text', required: true, visibleWhen: [OTHER] };
const WEBSITE: FieldDefinition = { key: 'website', label: 'Website', type: 'url', placeholder: 'www.example.ro' };
const PROPERTY_COUNT: FieldDefinition = { key: 'propertyCount', label: 'Number of properties', type: 'number', min: 1, required: true };

const ROLE: FieldDefinition = {
  key: 'representativeRole', label: "Your role in the organisation", type: 'select',
  options: [
    { value: 'owner', label: 'Owner' }, { value: 'director', label: 'Director' }, { value: 'manager', label: 'Manager' },
    { value: 'employee', label: 'Employee' }, { value: 'other', label: 'Other' },
  ],
};
const AUTHORITY: FieldDefinition = {
  key: 'authorityBasis', label: 'Your authority to list these properties', type: 'select', required: true,
  hint: 'We may ask for supporting evidence later. This answer alone does not prove authority.',
  options: [
    { value: 'owner', label: 'I own or co-own them' },
    { value: 'legal_representative', label: 'I am the legal representative of the company' },
    { value: 'authorised_by_company', label: 'The company authorised me' },
    { value: 'owner_mandate', label: 'I act for the owners under a mandate' },
  ],
};

/** Legal-entity fields. `when` = the conditions under which the entity fields apply. */
const entityFields = (when: Condition[], requiredRole: boolean, onrcRequiredWhen: Condition[] = [RO]): FieldDefinition[] => [
  { key: 'businessName', label: 'Legal name', type: 'text', required: true, visibleWhen: when },
  { key: 'cui', label: 'CUI / CIF', type: 'cui', placeholder: 'e.g. RO12345678', requiredWhen: [RO], visibleWhen: [...when, RO] },
  { key: 'onrc', label: 'Trade Registry number (ONRC)', type: 'onrc', placeholder: 'J40/1234/2020', requiredWhen: onrcRequiredWhen, visibleWhen: [...when, RO] },
  { key: 'foreignRegistrationNumber', label: 'Company registration number', type: 'text', required: true, visibleWhen: [...when, OTHER] },
  { key: 'registeredOffice', label: 'Registered office address', type: 'text', required: true, visibleWhen: when },
  { ...ROLE, required: requiredRole, visibleWhen: when },
];

const registered = eq('legalStructure', 'registered_business');
const businessYes = eq('actsThroughBusiness', true);

export const PROVIDER_FORMS: Record<ProviderType, FormDefinition> = {
  private_landlord: {
    id: 'provider_private_landlord',
    title: 'Private landlord',
    fields: [
      COUNTRY, OTHER_COUNTRY,
      { key: 'cityArea', label: 'City or area where you rent', type: 'text', required: true },
      PROPERTY_COUNT,
      { key: 'actsThroughBusiness', label: 'I rent through a registered business', type: 'boolean' },
      ...entityFields([businessYes], false),
    ],
  },

  property_manager: {
    id: 'provider_property_manager',
    title: 'Property manager',
    fields: [
      {
        key: 'legalStructure', label: 'How do you operate?', type: 'select', required: true,
        options: [{ value: 'registered_business', label: 'Registered business' }, { value: 'individual', label: 'Individual (no registered business)' }],
      },
      COUNTRY, OTHER_COUNTRY,
      { key: 'operatingAreas', label: 'Cities or areas covered', type: 'text', required: true, hint: 'Separate several with commas.' },
      PROPERTY_COUNT,
      WEBSITE,
      AUTHORITY,
      ...entityFields([registered], true),
    ],
  },

  agency: {
    id: 'provider_agency',
    title: 'Agency',
    fields: [
      COUNTRY, OTHER_COUNTRY,
      { key: 'businessName', label: 'Legal agency name', type: 'text', required: true },
      { key: 'cui', label: 'CUI / CIF', type: 'cui', placeholder: 'e.g. RO12345678', requiredWhen: [RO], visibleWhen: [RO] },
      { key: 'onrc', label: 'Trade Registry number (ONRC)', type: 'onrc', placeholder: 'J40/1234/2020', requiredWhen: [RO], visibleWhen: [RO] },
      { key: 'foreignRegistrationNumber', label: 'Company registration number', type: 'text', required: true, visibleWhen: [OTHER] },
      { key: 'registeredOffice', label: 'Registered office address', type: 'text', required: true },
      { ...ROLE, required: true },
      AUTHORITY,
      { key: 'operatingAreas', label: 'Cities or areas covered', type: 'text', required: true, hint: 'Separate several with commas.' },
      PROPERTY_COUNT,
      WEBSITE,
    ],
  },

  student_residence: {
    id: 'provider_student_residence',
    title: 'Student residence',
    fields: [
      {
        key: 'operatorType', label: 'Who operates the residence?', type: 'select', required: true,
        options: [
          { value: 'company', label: 'A company' },
          { value: 'university_or_public', label: 'A university or public institution' },
          { value: 'other_org', label: 'Another organisation' },
        ],
      },
      COUNTRY, OTHER_COUNTRY,
      { key: 'businessName', label: 'Operator legal name', type: 'text', required: true },
      { key: 'cui', label: 'CUI / CIF', type: 'cui', placeholder: 'e.g. RO12345678', requiredWhen: [RO], visibleWhen: [RO] },
      // ONRC: required for companies, optional for other organisations, not applicable to public institutions.
      { key: 'onrc', label: 'Trade Registry number (ONRC)', type: 'onrc', placeholder: 'J40/1234/2020',
        requiredWhen: [RO, eq('operatorType', 'company')],
        visibleWhen: [RO, { field: 'operatorType', op: 'in', value: ['company', 'other_org'] }] },
      { key: 'foreignRegistrationNumber', label: 'Registration number', type: 'text', required: true, visibleWhen: [OTHER] },
      { key: 'registeredOffice', label: 'Registered office address', type: 'text', required: true },
      { ...ROLE, required: true },
      AUTHORITY,
      { key: 'city', label: 'City of the residence', type: 'text', required: true },
      { key: 'locationCount', label: 'Number of residence locations', type: 'number', min: 1, required: true },
      { key: 'roomsCount', label: 'Approximate number of rooms', type: 'number', min: 1 },
      { key: 'bedsCount', label: 'Approximate number of beds', type: 'number', min: 1 },
      WEBSITE,
    ],
    rules: [{ type: 'at_least_one', fields: ['roomsCount', 'bedsCount'], message: 'Enter the approximate number of rooms or beds.' }],
  },
};
