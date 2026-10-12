# Moving from the mock layer to Supabase

Nothing here is implemented yet. It records the intended mapping so the swap does not require UI rewrites.

## Principle
Screens use providers and hooks. Providers use repository/service **interfaces**. Mock implementations sit behind them
(`src/services/index.ts` for accounts, verification, plans and forms; `src/data/index.ts` for properties).
Switching means adding a `supabase` branch in those two composition roots. `EXPO_PUBLIC_DATA_SOURCE` already selects the source.
`src/architecture.test.ts` fails if UI code imports storage, mock modules, demo code or the services root directly.

## Interface -> Supabase mapping

| Interface | Mock today | Supabase |
|---|---|---|
| `AccountRepository` | AsyncStorage `accounts` + `session` | Supabase Auth (credentials, session) + `profiles` table (full_name, phone, terms) |
| `VerificationRepository` (read) | AsyncStorage `verification` | `select` on `verification_records` (RLS: own rows only) |
| `VerificationService` | In-memory OTP, simulator outcomes | Edge Functions + Supabase Auth phone/OTP (SMS provider evaluated then); email via Auth confirmation |
| `PlanCatalogRepository` | Static modules | Tables `plans`, `plan_features`, `plan_prices`, `plan_eligibility_rules` (read-only to clients) |
| `FormConfigRepository` | Static definitions | Table `form_definitions` (jsonb) or remote config |
| `PropertyRepository` | Demo data | `properties` + `listings` joined by a view |

## Tables (sketch)
- `profiles(id uuid pk = auth.users.id, full_name, phone_e164 unique null, terms_accepted_at, terms_version, created_at)`
- `student_profiles(user_id pk fk)`, `provider_profiles(user_id pk fk, provider_type, details jsonb)`; modes = which rows exist
- `verification_records(id, user_id fk, kind, subject_id null, status, value, reason, updated_at, unique(user_id, kind, subject_id))`
- `terms_acceptances(user_id, version, accepted_at)` if acceptance history is needed
- Later: `properties`, `listings`, `favourites`, `conversations`, `messages`, `viewing_requests`, `rental_applications`, `subscriptions`

## Row Level Security (to write at migration time)
- `profiles`, `student_profiles`, `provider_profiles`: a user reads/updates only their own row. Provider details are not public.
- `verification_records`: select own rows only. **No insert/update/delete for clients.** Only the service role (Edge Functions) writes.
- Plan and form catalogue tables: select for everyone, write for no client.
- Public listing views expose only listing fields plus the derived "Verified landlord" boolean, never phone, email or document data.

## Server-side validation and decisions (never trust the client)
- Verification outcomes, OTP generation/checking, expiry, resend cooldown and lockout run in the backend. The mock's `OTP_RULES` mirror what must be enforced there.
- Re-check the access rules (verified email before messaging, SMS before the first viewing request, landlord verification before publishing) in database policies or Edge Functions. Client checks are UX only.
- Re-validate phone, CUI/CIF and ONRC format server-side. Format validity is **not** proof of existence or authority: company lookups (for example a provider such as Termene.ro, evaluated later), representative checks and property right-to-let checks are separate backend processes with manual review for exceptions.
- No secrets, service-role keys or provider credentials in the app. Edge Functions hold them.

## Things to decide at migration time
- Phone uniqueness policy (one account per number?) and what happens on number change (the `value` binding already forces re-verification).
- Whether `activeMode` lives in local storage or a `user_preferences` row (it is not authoritative either way).
- Retention of terms-acceptance history; identity documents are intentionally not stored by the app.
- Demo data: stays behind a demo flag only; mock listings must never appear next to real ones.

## Removing the mock and demo layers
1. Implement the Supabase versions of each interface and add the branch in the two composition roots.
2. Delete `src/demo/`, `src/config/demo.ts` and the demo route `src/app/demo-controls.tsx` (details in `src/demo/README.md`).
3. Remove the mock implementations and `src/storage/` once nothing imports them (the architecture test shows what still does).
