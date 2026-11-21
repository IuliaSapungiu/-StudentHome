# Moving from the mock layer to Supabase

Nothing here is implemented yet. It records the intended mapping so the swap does not require UI rewrites.

## Principle
Screens use providers and hooks. Providers use repository/service **interfaces**. Mock implementations sit behind them
(`src/services/index.ts` for accounts, verification, plans, forms, saved homes, conversations, viewing requests and applications; `src/data/index.ts` for properties).
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
| `SavedRepository` | AsyncStorage `saved` | `favourites` table (RLS: own rows only) |
| `ConversationRepository` (+ `ViewingEventSink`) | AsyncStorage `messaging.*` | `conversations`, `messages`, `conversation_participants`; send / edit / delete / hide via RPCs that check participation and the gate; viewing cards written by the viewing transition function; Realtime for new messages |
| `ViewingRepository` | AsyncStorage `viewings` | `viewing_requests` + `viewing_time_proposals` + `viewing_request_events`; transitions via RPCs; exact address via a restricted function |
| `NotificationRepository` / `NotificationSink` | AsyncStorage `notifications` | `notifications` table; rows written only by the transition functions / triggers (idempotent on `(user_id, event_id)`); Realtime or polling for the unread badge |
| `ApplicationRepository` | AsyncStorage `applications` | `rental_applications` + `rental_application_events`; transitions via RPCs |

## Tables (sketch)
- `profiles(id uuid pk = auth.users.id, full_name, phone_e164 unique null, terms_accepted_at, terms_version, created_at)`
- `student_profiles(user_id pk fk)`, `provider_profiles(user_id pk fk, provider_type, details jsonb)`; modes = which rows exist
- `verification_records(id, user_id fk, kind, subject_id null, status, value, reason, updated_at, unique(user_id, kind, subject_id))`
- `terms_acceptances(user_id, version, accepted_at)` if acceptance history is needed
- Later: `properties`, `listings`, `subscriptions`
- Step 3c tables (full field list, constraints and indexes: `docs/data-model.md`):
  - `favourites(user_id fk, property_id fk, created_at, pk(user_id, property_id))`
  - `conversations(id, property_id fk, student_id fk, owner_id fk, origin, listing_plan_id, created_at, last_message_at, unique(property_id, student_id))`
  - `messages(id, conversation_id fk, sender_id fk, kind, body null, viewing_request_id null, event_code null, event_id null unique, event_start null, event_related_start null, event_status null, created_at, edited_at null)`: **no `deleted_at`** (deleting a message removes the row)
  - `conversation_participants(conversation_id fk, user_id fk, last_read_at, hidden_at null, deleted_at null, cleared_at null, pk(conversation_id, user_id))`
  - `viewing_requests(id, property_id, student_id, owner_id, status, current_proposal_id, student_note, origin, listing_plan_id, created_at, updated_at)` with a partial unique index on open requests per (student, property)
  - `viewing_time_proposals(id, viewing_request_id fk, sequence, start_local, start_at timestamptz, time_zone, proposed_by, kind, outcome, proposed_at, resolved_at null, resolved_by null, simulated)`: append-only; `outcome` only moves from `active` to a final value
  - `viewing_request_events(id, viewing_request_id, event, status, actor_id, actor_role, start null, related_start null, proposal_id null, at)` (append-only; the id is the stable event id used for cards and notifications)
  - `viewing_addresses(property_id pk, address)`: **restricted table**, no client select; served only by `get_confirmed_viewing_address(viewing_id)`
  - `rental_applications(id, property_id, student_id, owner_id, applicant_name, applicant_email, applicant_phone, preferred_move_in, lease_months, occupants, university, study_status, message, consent_accepted_at, status, origin, listing_plan_id, created_at, updated_at)` with a partial unique index on open applications per (student, property)
  - `rental_application_events(id, application_id, status, actor_id, actor_role, at)` (append-only)
  - `notifications(id, user_id fk, kind, entity_type, entity_id, property_id, property_title, event_id, title, body, action_required, created_at, read_at null, deleted_at null, simulated, unique(user_id, event_id))` (the unique key is kept after deletion so a processed event is never recreated)
- Future (not Step 3c): `property_availability` (real landlord viewing slots) and `rental_confirmations` + `rental_confirmation_events` (see "Future: rental confirmation" in `docs/data-model.md`)

## Row Level Security (to write at migration time)
- `profiles`, `student_profiles`, `provider_profiles`: a user reads/updates only their own row. Provider details are not public.
- `verification_records`: select own rows only. **No insert/update/delete for clients.** Only the service role (Edge Functions) writes.
- Plan and form catalogue tables: select for everyone, write for no client.
- `favourites`: select/insert/delete own rows only.
- `conversations`, `messages`, `conversation_participants`: select only where the user is the conversation's `student_id` or `owner_id`. Inserts only through the send function (never direct), which verifies participation and, for a student, the verified-email gate. A participant may update only their own `last_read_at`, never move it backwards.
- `viewing_requests`, `viewing_request_events`, `rental_applications`, `rental_application_events`: select only for the student and the owner of the row. **No direct update of `status` or time columns by any client**: students and landlords change state only through functions that check the actor's role, the allowed transition (tables in `docs/data-model.md`) and the access gate. History tables are insert-only through those functions.
- `messages`: a participant may change only their own `text` rows, only through the edit / delete functions, and **only while `now() - created_at <= 20 minutes`** (the deadline is anchored on `created_at`; an edit does not move it). Edit updates `body` + `edited_at`; delete is a **hard `DELETE` of that one row** (also remove any attachment objects in Storage in the same function; keep the last-message time consistent). Never a `viewing_event` row. There is no per-message hide. `conversation_participants`: a participant updates only their own `last_read_at`, `hidden_at`, `deleted_at` and `cleared_at` (deleting sets `deleted_at` and `cleared_at` together, and `cleared_at` never moves backwards); hiding or deleting a conversation changes only that participant's row, is invisible to the other participant, and never deletes conversation or message rows. Policies: select/update `where user_id = auth.uid()`. The message-insert and viewing-event functions clear `hidden_at` and `deleted_at` for the participants a new message or card reaches (not the actor, unless the actor wrote a text message) but never `cleared_at`; every read of messages, previews and unread counts for a participant adds `created_at > coalesce(cleared_at, '-infinity')`, and the insert functions give a new message a `created_at` strictly after every participant's `cleared_at`.
- `notifications`: select only where `user_id = auth.uid()`; the only client writes are setting `read_at` and `deleted_at` on own rows (or "mark all read" / "mark entity read" / "delete all" functions that touch only `user_id = auth.uid()`; mark-entity-read is `update ... where entity_type = $1 and entity_id = $2 and read_at is null and deleted_at is null`). **No client insert**, and the functions that create notifications use `on conflict (user_id, event_id) do nothing`, which also covers deleted rows. **No client insert or delete**: rows are written by the transition functions with the service role.
- `viewing_time_proposals`: same visibility as the viewing; no client writes.
- `viewing_addresses`: no select for any client role. `get_confirmed_viewing_address` returns the address only to the student or owner of a viewing whose status is `confirmed`.
- A landlord can read a student's contact details (`applicant_*`) only from an application that student submitted to them, and only after consent (`consent_accepted_at` set).
- Public listing views expose only listing fields plus the derived "Verified landlord" boolean, never phone, email or document data.

## Server-side validation and decisions (never trust the client)
- Verification outcomes, OTP generation/checking, expiry, resend cooldown and lockout run in the backend. The mock's `OTP_RULES` mirror what must be enforced there.
- Re-check the access rules (verified email before messaging, SMS before the first viewing request or application, landlord verification before publishing) in database policies or Edge Functions. Client checks are UX only. The mock repositories already enforce the same rules (`src/features/verification/accessChecker.ts`), which is the behaviour the functions must reproduce.
- Step 3c rules the backend must enforce, not the app: only public listings can be messaged, requested or applied to; never your own listing; one conversation per (student, property); one open viewing request and one open application per (student, property); message and note length limits; viewing slot validation (grid, minimum lead time, horizon); an alternative time only confirms after the **student** accepts it; the exact address is released only while a viewing is `confirmed`; accepting an application changes nothing about the listing.
- Unread counts are computed from `last_read_at` (other person's, non-deleted messages). Every viewing transition function, in ONE transaction, (1) appends the event and updates proposals, (2) for landlord `confirmed` / `alternative_proposed` **upserts the conversation** `(property_id, student_id)` (never a duplicate) and inserts the status card with `event_id`, (3) for other events inserts a card only if a conversation already exists, (4) inserts the student's notification for landlord actions with `on conflict (user_id, event_id) do nothing`, (5) clears `hidden_at` on the conversation participants. A student's own request never creates a conversation. Application status functions do the same for notifications.
- Enforce in the functions: an alternative can only be confirmed by the **student**; a proposal may only change from `active` once; times must be real future date-times (two-year sanity bound); only the author can edit or delete a text message; status cards are immutable.
- Realtime: subscribe to `messages` (by conversation) and `notifications` (by user); the unread badge is `count(*) where read_at is null`.
- Viewing times: store `timestamptz` and the property's IANA time zone (the mock uses local wall-clock strings). The student's date and time (any minute) is a **preference**, not availability; real landlord availability (`property_availability`) is a later feature and must not be implied until it exists.
- Re-validate phone, CUI/CIF and ONRC format server-side. Format validity is **not** proof of existence or authority: company lookups (for example a provider such as Termene.ro, evaluated later), representative checks and property right-to-let checks are separate backend processes with manual review for exceptions.
- No secrets, service-role keys or provider credentials in the app. Edge Functions hold them.

## Things to decide at migration time
- Phone uniqueness policy (one account per number?) and what happens on number change (the `value` binding already forces re-verification).
- Whether `activeMode` lives in local storage or a `user_preferences` row (it is not authoritative either way).
- Retention of terms-acceptance history; identity documents are intentionally not stored by the app.
- Demo data: stays behind a demo flag only; mock listings must never appear next to real ones.
- Who the "landlord" is: until landlord accounts and landlord screens exist (Step 7) the mock marks everything done as the owner as `simulated`. Real landlord accounts switch `ownerActionsSimulated` off in the repository factories.
- Rental confirmation (landlord marks rented, student confirms or disputes; only bilateral confirmation counts), push / email / SMS delivery of notifications (in-app only today), retention of edited and deleted message text and an edit audit table, retention of messages and applications, and moderation / reporting of messages.

## Removing the mock and demo layers
1. Implement the Supabase versions of each interface and add the branch in the two composition roots.
2. Delete `src/demo/`, `src/config/demo.ts` and the demo routes `src/app/demo-controls.tsx` and `src/app/demo-landlord.tsx`, and the "Demo landlord" button in `ProfileScreen` (details in `src/demo/README.md`). Also remove `src/data/mockAddresses.ts` (fictional addresses) and the `simulated` marking of owner-side actions.
3. Remove the mock implementations and `src/storage/` once nothing imports them (the architecture test shows what still does).

## Step 3c corrections: implemented now, future-compatible, deferred
- **Implemented (local mock, behind the repository interfaces):** exact date-time viewing requests with an append-only proposal history; automatic or reused conversation on landlord confirm / alternative; one status card per event; message edit and soft delete; per-participant hiding; shared in-app notifications for viewing and application events with idempotent ids and account isolation. The local store is **neither secure nor synchronised across devices**.
- **Future-compatible (documented above, not created):** every table, index, RLS policy, function and Realtime subscription listed in this file and `docs/data-model.md`. Nothing connects to Supabase yet and no tables exist.
- **Deferred:** landlord screens and real landlord accounts (Step 7), real viewing availability, push / email / SMS delivery, message edit audit and moderation, rental confirmation.
- **Migration of earlier local data:** viewing records saved by the first Step 3c build (three loose times, no proposals) are converted on read into proposals; no data migration step is needed for the mock.

## Images (property photos)
The app loads every property photo through one component with a disk and memory cache, automatic retry and a tap-to-retry fallback. With Supabase Storage:
store the object path, not a long-lived URL; if you serve **signed URLs**, they change per issue, so keep the cache key independent of the token (the app keys the cache on the URL without its query string) and refresh expired URLs when a photo fails; generate thumbnail sizes (or use image transformations) instead of loading full-size photos for small thumbnails; remove the Storage object when a photo or listing is deleted.
