/// <reference types="node" />
import assert from 'node:assert/strict';
import { cleanAnswers, getVisibleFields, isFieldRequired, validateForm } from './formRules';
import { PROVIDER_FORMS } from './providerForms';
import { REGISTRATION_FORM } from './registrationForm';
import type { Answers, FormDefinition } from './types';

const required = (form: FormDefinition, a: Answers) => getVisibleFields(form, a).filter((f) => isFieldRequired(f, a)).map((f) => f.key).sort();
const optional = (form: FormDefinition, a: Answers) => getVisibleFields(form, a).filter((f) => !isFieldRequired(f, a)).map((f) => f.key).sort();
const visible = (form: FormDefinition, a: Answers) => getVisibleFields(form, a).map((f) => f.key);
const S = (...k: string[]) => k.sort();

// ---- registration: five common fields, all required
assert.deepEqual(required(REGISTRATION_FORM, {}), S('fullName', 'email', 'phone', 'password', 'acceptTerms'));
{
  const errors = validateForm(REGISTRATION_FORM, {});
  assert.deepEqual(Object.keys(errors).sort(), S('fullName', 'email', 'phone', 'password', 'acceptTerms'));
  const bad = validateForm(REGISTRATION_FORM, { fullName: 'A', email: 'nope', phone: '123', password: 'short', acceptTerms: false });
  assert.deepEqual(Object.keys(bad).sort(), S('fullName', 'email', 'phone', 'password', 'acceptTerms'));
  assert.deepEqual(validateForm(REGISTRATION_FORM, { fullName: 'Ana Popescu', email: 'ana@example.com', phone: '0712 345 678', password: 'longenough1', acceptTerms: true }), {});
  // terms must be accepted, not merely present
  assert.ok(validateForm(REGISTRATION_FORM, { fullName: 'Ana Popescu', email: 'ana@example.com', phone: '+447911123456', password: 'longenough1', acceptTerms: false }).acceptTerms);
  // international numbers are accepted
  assert.equal(validateForm(REGISTRATION_FORM, { fullName: 'Ana Popescu', email: 'ana@example.com', phone: '+447911123456', password: 'longenough1', acceptTerms: true }).phone, undefined);
  // registration collects NO property or company data
  assert.equal(REGISTRATION_FORM.fields.some((f) => ['cui', 'onrc', 'propertyCount', 'cityArea'].includes(f.key)), false);
}

// ---- Private Landlord
{
  const f = PROVIDER_FORMS.private_landlord;
  assert.deepEqual(required(f, { country: 'RO' }), S('country', 'cityArea', 'propertyCount'));
  assert.deepEqual(optional(f, { country: 'RO' }), S('actsThroughBusiness'));
  assert.equal(visible(f, { country: 'RO' }).includes('cui'), false); // no company details for a private individual
  const biz = { country: 'RO', actsThroughBusiness: true };
  assert.deepEqual(required(f, biz), S('country', 'cityArea', 'propertyCount', 'businessName', 'cui', 'onrc', 'registeredOffice'));
  assert.deepEqual(optional(f, biz), S('actsThroughBusiness', 'representativeRole'));
  assert.deepEqual(required(f, { country: 'OTHER', actsThroughBusiness: true }), S('country', 'otherCountry', 'cityArea', 'propertyCount', 'businessName', 'foreignRegistrationNumber', 'registeredOffice'));
}
// ---- Property Manager
{
  const f = PROVIDER_FORMS.property_manager;
  const individual = { legalStructure: 'individual', country: 'RO' };
  assert.deepEqual(required(f, individual), S('legalStructure', 'country', 'operatingAreas', 'propertyCount', 'authorityBasis'));
  assert.deepEqual(optional(f, individual), S('website'));
  assert.equal(visible(f, individual).includes('cui'), false);
  const company = { legalStructure: 'registered_business', country: 'RO' };
  assert.deepEqual(required(f, company), S('legalStructure', 'country', 'operatingAreas', 'propertyCount', 'authorityBasis', 'businessName', 'cui', 'onrc', 'registeredOffice', 'representativeRole'));
  assert.deepEqual(optional(f, company), S('website'));
  assert.deepEqual(required(f, { legalStructure: 'registered_business', country: 'OTHER' }), S('legalStructure', 'country', 'otherCountry', 'operatingAreas', 'propertyCount', 'authorityBasis', 'businessName', 'foreignRegistrationNumber', 'registeredOffice', 'representativeRole'));
}
// ---- Agency: a Romanian company must give its identifiers
{
  const f = PROVIDER_FORMS.agency;
  const ro = { country: 'RO' };
  assert.deepEqual(required(f, ro), S('country', 'businessName', 'cui', 'onrc', 'registeredOffice', 'representativeRole', 'authorityBasis', 'operatingAreas', 'propertyCount'));
  assert.deepEqual(optional(f, ro), S('website'));
  const errors = validateForm(f, ro);
  for (const k of ['businessName', 'cui', 'onrc', 'registeredOffice', 'representativeRole', 'authorityBasis', 'operatingAreas', 'propertyCount']) assert.ok(errors[k], k);
  assert.equal(visible(f, { country: 'OTHER' }).includes('cui'), false);
  assert.ok(required(f, { country: 'OTHER' }).includes('foreignRegistrationNumber'));
  assert.equal(visible(f, ro).includes('foreignRegistrationNumber'), false);
}
// ---- Student Residence: operator type drives the legal identifiers
{
  const f = PROVIDER_FORMS.student_residence;
  const base = ['operatorType', 'country', 'businessName', 'registeredOffice', 'representativeRole', 'authorityBasis', 'city', 'locationCount'];
  assert.deepEqual(required(f, { operatorType: 'company', country: 'RO' }), S(...base, 'cui', 'onrc'));
  assert.deepEqual(required(f, { operatorType: 'university_or_public', country: 'RO' }), S(...base, 'cui'));
  assert.equal(visible(f, { operatorType: 'university_or_public', country: 'RO' }).includes('onrc'), false); // ONRC not applicable
  assert.deepEqual(required(f, { operatorType: 'other_org', country: 'RO' }), S(...base, 'cui'));
  assert.ok(optional(f, { operatorType: 'other_org', country: 'RO' }).includes('onrc')); // optional for other organisations
  assert.ok(required(f, { operatorType: 'company', country: 'OTHER' }).includes('foreignRegistrationNumber'));
  // rooms and/or beds: at least one
  const answers: Answers = { operatorType: 'company', country: 'RO', businessName: 'Operator SRL', cui: '12345674', onrc: 'J40/1234/2020', registeredOffice: 'Str. Exemplu 1, București', representativeRole: 'director', authorityBasis: 'legal_representative', city: 'București', locationCount: '2' };
  assert.equal(validateForm(f, answers).roomsCount, 'Enter the approximate number of rooms or beds.');
  assert.deepEqual(validateForm(f, { ...answers, roomsCount: '120' }), {});
  assert.deepEqual(validateForm(f, { ...answers, bedsCount: '300' }), {});
  assert.ok(validateForm(f, { ...answers, bedsCount: '0' }).bedsCount); // must be a positive whole number
  assert.ok(validateForm(f, { ...answers, roomsCount: '12.5' }).roomsCount);
}
// ---- validation rules apply to the right fields
{
  const f = PROVIDER_FORMS.agency;
  const ok: Answers = { country: 'RO', businessName: 'Agentie SRL', cui: 'RO12345674', onrc: 'J40/1234/2020', registeredOffice: 'Str. Exemplu 1', representativeRole: 'director', authorityBasis: 'legal_representative', operatingAreas: 'București, Cluj', propertyCount: '12' };
  assert.deepEqual(validateForm(f, ok), {});
  assert.ok(validateForm(f, { ...ok, cui: '12345675' }).cui); // bad checksum
  assert.ok(validateForm(f, { ...ok, onrc: 'J99/1/2020' }).onrc);
  assert.ok(validateForm(f, { ...ok, website: 'not a site' }).website);
  assert.equal(validateForm(f, { ...ok, website: 'www.agentie.ro' }).website, undefined);
  assert.ok(validateForm(f, { ...ok, propertyCount: '0' }).propertyCount);
  assert.ok(validateForm(f, { ...ok, representativeRole: 'astronaut' }).representativeRole);
  // hidden fields are not validated: a bad CUI is ignored when the company is not in Romania
  assert.deepEqual(validateForm(f, { ...ok, country: 'OTHER', otherCountry: 'Italy', foreignRegistrationNumber: 'IT-998877', cui: 'garbage', onrc: 'garbage' }), {});
  // and hidden values are dropped from the cleaned answers
  const clean = cleanAnswers(f, { ...ok, country: 'OTHER', otherCountry: 'Italy', foreignRegistrationNumber: 'IT-998877', cui: 'garbage' });
  assert.equal('cui' in clean, false);
  assert.equal(clean.foreignRegistrationNumber, 'IT-998877');
}
// ---- cleanAnswers normalises
{
  const clean = cleanAnswers(REGISTRATION_FORM, { fullName: ' Ana Popescu ', email: ' Ana@Example.com ', phone: '0712 345 678', password: 'longenough1', acceptTerms: true });
  assert.deepEqual([clean.fullName, clean.phone, clean.acceptTerms], ['Ana Popescu', '+40712345678', true]);
  const agency = cleanAnswers(PROVIDER_FORMS.agency, { country: 'RO', businessName: ' X SRL ', cui: 'ro 12345674', onrc: 'j 40 / 1234 / 2020', registeredOffice: 'a', representativeRole: 'owner', authorityBasis: 'owner', operatingAreas: 'x', propertyCount: '3' });
  assert.deepEqual([agency.businessName, agency.cui, agency.onrc], ['X SRL', '12345674', 'J40/1234/2020']);
}
// ---- every provider form is complete and has unique field keys
for (const [type, f] of Object.entries(PROVIDER_FORMS)) {
  assert.equal(new Set(f.fields.map((x) => x.key)).size, f.fields.length, type);
  for (const x of f.fields) if (x.type === 'select') assert.ok(x.options?.length, `${type}.${x.key} needs options`);
}
assert.deepEqual(Object.keys(PROVIDER_FORMS).sort(), ['agency', 'private_landlord', 'property_manager', 'student_residence']);

console.log('forms: all checks passed');
