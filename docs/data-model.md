# StudentHouse data model (domain view)

How the app's entities relate today (mock, AsyncStorage) and how they will map to Supabase tables.
Updated each step. Step 3a covers accounts, profiles and verification; later steps add the rest.

## Conventions
- **Ids**: opaque strings from `newId()` (UUID-shaped). Never use names, emails or array positions as keys. Demo fixtures use readable ids (`demo-1`, `demo-owner-1`) and are seed data only.
- **Timestamps**: ISO 8601 UTC strings (`updatedAt`, `termsAcceptedAt`). Maps to `timestamptz`.
- **Nullable fields** are explicit `| null` where they will be nullable columns. A missing value is never "empty string".
- **Derived data is not stored.** If it can be computed safely from other rows it is computed (see "Derived").
- **Ownership**: every row belongs to exactly one account, or is shared catalogue data.
- **Passwords are never stored** by the app or the mock layer. Supabase Auth owns credentials in production.

## Entities (Step 3a)

| Entity (type) | Key fields | Relationships / ownership | Mock storage |
|---|---|---|---|
| Account (`MockUser`) | `id`, `email`, `fullName`, `phone` (E.164 or null), `termsAcceptedAt`, `termsVersion`, `profiles`, `activeMode` | Owns its profiles and verification records | key `accounts` |
| Student profile | `profiles.student: boolean` (stub) | 1:0..1 with Account | inside Account |
| Provider profile | `profiles.provider: { onboardingComplete } \| null` (stub; type + company details arrive in Step 4) | 1:0..1 with Account | inside Account |
| Verification record (`VerificationRecord`) | `id`, `userId`, `kind`, `subjectId`, `status`, `value`, `reason`, `updatedAt`, `simulated` | N:1 Account. `subjectId` = property id for `kind = property` | key `verification` |
| Plan catalogue (`PlanCatalog`) | plans, price table, eligibility rules, residence threshold | Shared, read-only for users | static modules |
| Form definitions (`FormDefinition`) | fields, required/visible conditions, cross-field rules | Shared, read-only for users | static modules |
| Property (read model) | `id`, `ownerId`, `status`, `planId`, listing fields | N:1 provider account via `ownerId` | demo data |

Session pointer: key `session` (the signed-in account id). In production this is the Supabase Auth session.

## Verification
Kinds are **independent**: `email`, `phone`, `identity`, `company`, `representative_authority`, `property`.
Completing one never completes another. Statuses: `not_started` (no row), `pending`, `verified`, `rejected`, `failed`, `more_info_required`.

- `value` binds a record to what was verified (email address or E.164 phone). It only counts while it equals the account's **current** value, so changing the phone number automatically requires verification again. No extra "isPhoneVerified" flag exists.
- `simulated = true` marks demo results. They are never real-world verification.
- Rows are written only by a trusted service. The client can read its own rows and start flows; it cannot set a status.
- Property verification (`kind = property`, `subjectId` = property id) is separate from the landlord's identity verification. The **"Verified landlord"** badge depends only on the owner's `identity` record and never on the plan or on property verification.

## Access rules (client UX; enforced again server-side in production)
- Save: any account. Message: verified email. Viewing request / rental application: verified email, then SMS-verified phone the first time only.
- OTP throttling: 6-digit code, 10 min expiry, 30 s resend cooldown, 5 wrong codes lock for 15 min.

## Derived (computed, not stored)
- Verified landlord badge = owner's identity record is `verified`. The mock repository composes `Property.landlordIdentityVerified` at read time.
- Email / phone "verified" = record verified AND value matches the account's current value.
- Available modes = which profiles exist. `activeMode` is a **local UI preference** resolved against them (`resolveActiveMode`); a stored value the account does not have is repaired, not trusted.
- Listing counts, favourite counts, "n homes in city" = queries.

## Planned additions (not built yet)
Step 3b/3c: favourites (student, property), conversations, messages, viewing requests, rental applications. Step 4: provider profile details and company data. Step 5: properties owned by a provider, drafts, media. Step 6: listings (property + plan + publish/expiry dates) and package purchases. Today `Property` merges property and listing state; it will be split into `property` and `listing` when Add Property and plans are built, with the repository still returning the same read model.

## Backward compatibility (mock accounts)
Accounts written by Step 2 have no `phone`, `fullName` or terms fields. `parseUser` upgrades them on read: missing values become `null`, the legacy `displayName` stays readable through `fullNameOf()`, and an impossible `activeMode` is repaired. Corrupt records (no id/email, or no profile at all) are dropped. Storage keys and the `v1` namespace are unchanged.
