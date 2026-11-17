# StudentHouse data model (domain view)

How the app's entities relate today (mock, AsyncStorage) and how they will map to Supabase tables.
Updated each step. Step 3a covers accounts, profiles and verification; Step 3c adds saved homes, conversations, viewing requests, rental applications and notifications; later steps add the rest.

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

## Saved homes, conversations, viewing requests, rental applications and notifications (Step 3c)

The first three are **independent of each other**. A student can message a landlord and arrange a viewing in the chat
without a formal viewing request or an application; a viewing request or an application can be made without ever
starting a conversation. They connect in exactly one way: **landlord actions on a viewing** (confirm, propose another
time, and the follow-up events) are recorded as status cards in the student's conversation for that home, which is
created on the spot if it does not exist (see "Automatic conversation creation").

| Entity (type) | Key fields | Relationships / ownership | Mock storage |
|---|---|---|---|
| Favourite (`SavedRepository`) | `userId`, `propertyId`, saved order (newest first) | N:1 Account, N:1 Property. Own rows only | key `saved` |
| Conversation (`Conversation`) | `id`, `propertyId`, `studentId`, `ownerId`, `origin`, `listingPlanId`, `createdAt`, `lastMessageAt` | **One per (student, property).** `ownerId` copied from the property. Participants: the student and the owner | `messaging.conversations` |
| Message (`Message`) | `id`, `conversationId`, `senderId`, `kind` (`text` \| `viewing_event`), `body`, `viewingRequestId`, `eventCode`, `eventId`, `eventStart`, `eventRelatedStart`, `eventStatus`, `createdAt`, `editedAt`, `simulated` | N:1 Conversation. `viewing_event` rows are **system status cards** (see below) | `messaging.messages` |
| Participant state (`ParticipantRead`) | `conversationId`, `userId`, `lastReadAt`, `hiddenAt`, `deletedAt` | One row per participant per conversation (future `conversation_participants`) | `messaging.reads` |
| Viewing request (`ViewingRequest`) | `id`, `propertyId`, `studentId`, `ownerId`, `status`, `currentProposalId`, `proposals[]`, `studentNote`, `origin`, `listingPlanId`, `history[]` | N:1 student, N:1 property / owner. Visible to the student and the owner only | `viewings` |
| Time proposal (`ViewingProposal`) | `id`, `start`, `proposedBy`, `kind`, `proposedAt`, `outcome`, `resolvedAt`, `resolvedBy`, `simulated` | N:1 Viewing request (future `viewing_time_proposals`). Append-only | inside the viewing request |
| Viewing history entry | `id`, `event`, `status`, `at`, `actorId`, `actorRole`, `start`, `relatedStart`, `proposalId`, `simulated` | N:1 Viewing request (future `viewing_request_events`). Append-only | inside the viewing request |
| Viewing address | `propertyId` -> exact address | **Not part of the listing or the viewing request.** Released only while the viewing is `confirmed` | static module `mockAddresses` (fictional) |
| Rental application (`RentalApplication`) | `id`, `propertyId`, `studentId`, `ownerId`, `applicant*` (copied at submission), `preferredMoveIn`, `leaseMonths`, `occupants`, `university`, `studyStatus`, `message`, `consentAcceptedAt`, `status`, `origin`, `listingPlanId`, `history[]` | N:1 student, N:1 property / owner. Visible to the student and the owner only | `applications` |
| Application history entry | `id`, `status`, `at`, `actorId`, `actorRole`, `simulated` | N:1 Application (future `rental_application_events`) | inside the application |
| Notification (`AppNotification`) | `id`, `userId`, `kind`, `entityType`, `entityId`, `propertyId`, `propertyTitle`, `eventId`, `title`, `body`, `actionRequired`, `createdAt`, `readAt`, `deletedAt`, `simulated` | N:1 recipient Account. One per (recipient, event) | `notifications` |

All ids are stable internal ids (never names). Ownership and relationships use account ids only.

### Viewing requests: choosing a time
The student picks an **exact date and time, minutes included** (00-59, any minute; no fixed slots, no opening hours). It is a
**preference**: the app never presents it as the landlord's availability, and the landlord can confirm it or propose another time.
Rules: the time must be in the future (no minimum lead time) and within the **shared calendar range**. On the picker, past days and past
times on today are disabled. The earlier 30-day limit and 09:00-18:30 slot list were placeholders for a mock availability system and were
removed; real landlord availability (`property_availability`) is a later feature.

**Shared date range** (`src/lib/dateRange.ts`): from **today** to **the same calendar day two years later** (29 February becomes 28 February in a
non-leap year). It is calculated from the clock every time it is needed, so it is never tied to a particular month or year and it moves forward as
time passes. The viewing calendar, the viewing validator, the move-in date calendar and the application validator all use this one function, so they
always agree. The two-year limit is a technical sanity bound, not a product rule.

### Viewing history: nothing is overwritten
A viewing keeps **every time ever put forward** as a `ViewingProposal`, and a separate append-only event log.
A proposal is never edited or removed; it only receives an `outcome` once, while `active`:

| `kind` | Meaning |
|---|---|
| `request` | the student's first requested time (never changes) |
| `reschedule` | a new time the student asked for later |
| `alternative` | a time the landlord suggested |
| `retained` | the student turned an alternative down, so their last own time is open again (a NEW proposal) |

| `outcome` | Meaning |
|---|---|
| `active` | waiting for an answer |
| `accepted` | agreed (landlord confirmed a student time, or the student accepted an alternative) |
| `rejected` | turned down (landlord declined; student rejected, or ignored-by-rescheduling, a suggestion; a cancelled suggestion) |
| `superseded` | replaced by a newer proposal |
| `withdrawn` | the student's own active time taken back by cancelling |

`currentProposalId` points at the proposal that defines the viewing now (waiting, or agreed). Any other proposal is **inactive**
and shown greyed in the history; proposals whose time has passed are shown disabled and are never actionable. The student sees the full
history on each viewing card ("Show history").

### Status transitions
Viewing request (`pending`, `alternative_proposed`, `confirmed`, `declined`, `cancelled`, `completed`):

| From | Action (who) | Proposal effect | To | Event |
|---|---|---|---|---|
| (new) | request (student) | new `request`, active | `pending` | `requested` |
| `pending` | confirm (landlord; time still in the future) | current -> accepted | `confirmed` | `confirmed` |
| `pending` | decline (landlord) | current -> rejected | `declined` | `declined` |
| `pending`, `alternative_proposed` | propose alternative (landlord; valid future time, different from the current one) | current -> superseded; new `alternative`, active | `alternative_proposed` | `alternative_proposed` |
| `alternative_proposed` | **accept** (student, explicit; time still in the future) | alternative -> accepted | `confirmed` | `alternative_accepted` |
| `alternative_proposed` | **reject** (student) | alternative -> rejected; new `retained` (student's last time), active | `pending` | `alternative_rejected` |
| `pending`, `alternative_proposed`, `confirmed` | reschedule (student; valid future time) | active student time -> superseded, active suggestion -> rejected, an agreed time stays accepted; new `reschedule`, active | `pending` | `rescheduled` |
| `pending`, `alternative_proposed`, `confirmed` | cancel (student) | active student time -> withdrawn, active suggestion -> rejected | `cancelled` | `cancelled` |
| `confirmed` | complete (landlord; only after the time has passed) | unchanged | `completed` | `completed` |

`declined`, `cancelled` and `completed` are final. "Expired" and "Date passed" are **display labels** derived from the clock. One *open*
request per (student, property). A proposed alternative never confirms anything until the student accepts it.

Rental application (`submitted`, `under_review`, `accepted`, `rejected`, `withdrawn`):

| From | Action (who) | To |
|---|---|---|
| (new) | submit (student) | `submitted` |
| `submitted` | start review (landlord) | `under_review` |
| `submitted`, `under_review` | accept / reject (landlord) | `accepted` / `rejected` |
| `submitted`, `under_review`, `accepted` | withdraw (student) | `withdrawn` |

`rejected` and `withdrawn` are final. One *open* application per (student, property); after a final status the student may apply again.
Each application is one home, reviewed and submitted individually (no bulk applications); common answers are only *pre-filled* from the
latest application. An application is an expression of interest: accepting it reserves nothing, holds no room, creates no contract, takes
no payment, never changes availability and never creates a booking. Available on **every plan tier**.

### Automatic conversation creation
- A student's own request never creates a conversation.
- When the **landlord confirms** a viewing or **proposes an alternative time**, the student's conversation for that home is **created if it does not exist** (`origin = viewing_update`, `ownerId` from the viewing) and **reused if it does**. Uniqueness `(property_id, student_id)` guarantees no duplicate; creation is atomic.
- Every viewing event is recorded as its own status card once the conversation exists (later student events, such as a reschedule, an accepted or rejected alternative, a cancellation, are cards too). Events that happened before the conversation existed (for example the initial request) are not back-filled. **Viewings remains the source of truth**; a card shows the event's own time and the viewing's current status.
- Cards are deduplicated by the history event id (`messages.event_id` unique): the same event can never post twice.
- A conversation created this way has no student message; the student can answer normally (needs a verified email to send, like any message).

### System status cards versus user messages
`kind = text` is a user message (author = `senderId`). `kind = viewing_event` is a **system card** created only by the viewing flow: no body, it
references `viewingRequestId` + `eventId` and carries an **immutable snapshot of its own event**, written when the event happened and never updated:
`eventStart` (the date-time the event is about), `eventRelatedStart` (the other time involved: what an alternative or a reschedule replaced, or, for
a rejected alternative, the student's own time that is open again) and `eventStatus` (the viewing's status right after the event). The same three facts
are stored on the viewing's append-only history entry (`start`, `relatedStart`, `status`) under the same event id, so a card and the viewing history
always tell the same story. **A card never reads the viewing's current times or status.** Cards written before snapshots existed are filled from the
immutable history entry of that same event (by event id, or by order for the oldest ones), never from the current proposal. System cards cannot be
edited or deleted by anyone through the messaging API, and count as unread when the other party's action caused them.

### Message editing and deleting: author only, 20 minutes, hard delete
- Only the **author** of a `text` message can edit or delete it, and only within **20 minutes of the ORIGINAL send time** (`created_at`). Editing sets `edited_at` and
  never moves `created_at`, so **editing never extends the deadline**. After 20 minutes both calls fail with `expired`; the UI only hides the swipe actions as well.
  Editing also needs the same verified-email gate as sending; saving identical text changes nothing.
- **Delete is a hard delete.** That one message record is removed: no placeholder, no `deleted_at`, nothing visible to either participant. No other message, status
  card or conversation changes, and the conversation's last-message time follows the remaining messages. A conversation left with no messages is not listed.
- There is **no way to hide an individual message**; hiding exists only for whole conversations.
- System/status cards cannot be edited or deleted.
- Future attachments: deleting a message must also remove its storage objects (in the same server operation), so no orphaned files remain.
- Messages saved by the earlier build as soft-deleted are dropped on read. Edit history is not kept.

### Per-participant conversation hiding and deleting
Both live on the **participant's own row** (`conversation_participants`): `hidden_at` and `deleted_at`. Neither touches the shared conversation or its messages, and neither affects the other participant.
- **Hide** (reversible): the conversation leaves the normal inbox and appears in that person's "Hidden conversations"; **Unhide** restores it.
- **Delete** (no unhide): the conversation leaves both the normal and the hidden lists for that person only. The history stays in the shared conversation and the other participant keeps using it freely.
- **New activity brings it back** to the normal inbox of everyone it reaches: any new message from the other person, and any new viewing status card caused by someone else's action. A person's own new message also brings it back for themselves; a viewing card caused by their own action does not. A revived conversation shows its full history.
- Read positions survive hiding. Hidden and deleted conversations do not count towards the unread total. There is no time limit on hiding or deleting.
- Messages: swipe a conversation row to the right to reveal **Hide** and **Delete** (Delete asks for confirmation). In the Hidden list the actions are **Unhide** and **Delete**.
- Demo landlord: the demo reads conversations through each landlord's own `listForParticipant`, so a student hiding or deleting a conversation never removes it from the landlord side, and a demo reply brings it back into the student's inbox.

### Notifications (shared architecture)
One model and one repository for every kind, in-app only (no push, email or SMS). A notification belongs to exactly **one account** and is created from **one event**.
- **Id** `ntf:<recipientId>:<eventId>`, where `eventId` is the viewing history event id or the application status entry id. Recording the same event again is a no-op (`created: false`): **idempotent** and race-safe.
- **Kinds now:** `viewing_confirmed`, `viewing_alternative_proposed` (`actionRequired = true`: the student must accept or reject), `viewing_declined`, `viewing_completed`, `application_under_review`, `application_accepted`, `application_rejected`. Only **landlord actions** notify; the student's own actions (request, reschedule, cancel, accept, reject, submit, withdraw) do not.
- **Navigation:** resolved from `entityType` + `entityId` (nothing stored as a path): a viewing opens that exact viewing with the right tab selected and the card highlighted; an application opens that application.
- **Read state:** `readAt` null = unread; marking read twice keeps the first time. The Profile tab shows an unread dot; the notifications screen lists newest first.
- **Deleting:** a recipient can delete one notification (swipe right) or all of their own ("Delete all", with confirmation). Deleting sets `deletedAt` on that notification only and never touches the viewing, application or conversation it was about. The row stays as a **tombstone**, so when the same event is processed again `record` still reports `created: false`: a deleted notification is never recreated, while a genuinely new event still notifies. Deleted notifications are never listed or counted.
- **Isolation:** every repository call is scoped to one account id; another account's notification can be neither read nor marked read.
- Adding a kind later = a new value in `NOTIFICATION_KINDS` plus a builder in `notificationLogic.ts`.

### Constraints, rules and indexes (to enforce in the database)
- `favourites`: pk `(user_id, property_id)`; index `(user_id, created_at desc)`.
- `conversations`: **unique `(property_id, student_id)`**; indexes on `student_id`, `owner_id`, `last_message_at desc`.
- `messages`: index `(conversation_id, created_at)`; **unique `event_id` where not null**; `text` body 1-2000 characters; no `deleted_at` (deleting removes the row); `viewing_request_id`, `event_code`, `event_id` required for `viewing_event`; check `edited_at >= created_at`.
- `conversation_participants(conversation_id, user_id, last_read_at, hidden_at, deleted_at)`: pk `(conversation_id, user_id)`. Unread is **derived** (the other person's messages after `last_read_at`), never stored.
- `viewing_requests`: partial unique index on `(student_id, property_id)` where `status in ('pending','alternative_proposed','confirmed')`; indexes on `student_id`, `owner_id`, `(status)`; `current_proposal_id` must reference one of its proposals.
- `viewing_time_proposals`: unique `(viewing_request_id, sequence)`; exactly one `active` proposal while the request is `pending` or `alternative_proposed`; `outcome` may only move from `active` to a final value; start is a real date-time in the future when created.
- `rental_applications`: partial unique index on `(student_id, property_id)` where `status in ('submitted','under_review','accepted')`; indexes on `student_id`, `owner_id`, `(owner_id, status)`; lease 1-36 months, occupants 1-6, message up to 1000 characters, consent timestamp required.
- `notifications`: **pk / unique `(user_id, event_id)`** (kept after deletion, as the tombstone); `deleted_at`; indexes `(user_id, created_at desc)` and partial `(user_id)` where `read_at is null and deleted_at is null`; `entity_type` + `entity_id` identify the target.
- Event and history tables are append-only (insert only; no update or delete).
- A student can neither message, request a viewing of, nor apply to their **own** listing, and only **public** listings can be contacted.
- Access rules (see above) are checked **inside the repositories** as well as in the UI: email for messaging and editing; email plus first-time SMS for viewing requests, rescheduling and applications.

### Order of a gated submission (viewing request, application)
1. The form is validated first; if invalid only the errors show, with **no email or SMS prompt**.
2. Only a valid form runs the existing gate (guest -> sign in; email screen; first-time SMS sheet). The form stays mounted underneath, so its values survive.
3. After verification the submission runs **once**; the confirmation or navigation happens only after the repository reports success.
Opening a form (Property Detail -> "Request viewing" / "Apply to rent") never prompts verification; only guests are sent to sign in. "Message landlord" still checks the email before opening the chat, and sending from the chat resumes automatically after the email is verified.

### Time zones
Viewing times are local wall-clock strings (`YYYY-MM-DDTHH:mm`) because all demo listings are in Romania and the device is assumed to be in the listing's zone. Production stores `timestamptz` plus the property's IANA time zone. Message, history and notification timestamps are ISO UTC.

### Attribution and demo marking
`origin` (`property_detail`, `conversation`, `viewings`, `saved`, `viewing_update`, `other`) and `listingPlanId` are recorded on conversations, viewing requests and applications so a later milestone can attribute outcomes. `simulated = true` on a message, proposal, history entry or notification means a **demo responder** acted as the landlord (there are no landlord accounts yet); it is never real landlord behaviour and the UI labels it "Demo".

### Implemented now / future-compatible / deferred

| Capability | Status |
|---|---|
| Saved homes, conversations, messages, viewing requests, rental applications, in-app notifications (local mock, per-account isolation) | **Implemented** |
| Exact date and time (minutes) picker; proposal history with outcomes; deep link to an exact viewing | **Implemented** |
| Auto-created / reused conversation from landlord confirm or alternative; one card per event | **Implemented** |
| Message edit and hard delete (author, first 20 minutes); per-participant conversation Hide / Unhide / Delete; swipe actions | **Implemented** |
| Landlord actions through repositories (confirm, decline, propose, complete, review, accept, reject) | **Implemented** in repositories; driven only by labelled demo controls |
| Schema, RLS, functions, Realtime for all of the above | **Future-compatible**: documented in `docs/supabase-migration.md`, not created |
| Landlord screens and routes, real landlord accounts | **Deferred** (Step 7) |
| Real landlord availability for viewing times | **Deferred** (`property_availability`) |
| Push, email or SMS notifications; cross-device sync | **Deferred** (local storage is neither secure nor synchronised across devices) |
| Edit history / audit of message changes, moderation, retention rules, message attachments | **Deferred** |
| Rental confirmation (below) | **Deferred**, not built |

### Future: rental confirmation (NOT implemented in Step 3c)
Actually renting a home is a **separate, later process** that is deliberately not an application status. Planned model:
- `rental_confirmations(id, property_id, listing_id, landlord_id, student_id, status, landlord_marked_at, student_responded_at, student_response, attributed_application_id null, attributed_viewing_id null, attributed_conversation_id null, plan_id_at_confirmation, created_at)` plus append-only `rental_confirmation_events(confirmation_id, status, actor_id, actor_role, at, note)`.
- Flow: the landlord marks the property as rented to a named student (`landlord_marked`); that student **confirms** (`confirmed`) or **disputes** (`disputed`, reviewed manually). Only the **bilateral** state `confirmed` counts as a confirmed rental conversion.
- An accepted application, a completed viewing, a conversation or an expired listing **never** counts as a confirmed rental; they are only optional attribution evidence.
- Step 3c prepares for it with stable `studentId` / `ownerId` / `propertyId`, `origin`, `listingPlanId`, and the append-only histories on viewings and applications.

## Derived (computed, not stored)
- Verified landlord badge = owner's identity record is `verified`. The mock repository composes `Property.landlordIdentityVerified` at read time.
- Email / phone "verified" = record verified AND value matches the account's current value.
- Available modes = which profiles exist. `activeMode` is a **local UI preference** resolved against them (`resolveActiveMode`); a stored value the account does not have is repaired, not trusted.
- Listing counts, favourite counts, "n homes in city" = queries.
- Unread counts, "Read" labels, viewing tabs (Upcoming / Pending / Past) and viewing/application display labels are computed from timestamps, participants' `lastReadAt`, statuses and the clock.

## Planned additions (not built yet)
Step 3c (built): favourites, conversations, messages, viewing requests, rental applications. Later: rental confirmation (see above), landlord availability for viewing slots, notifications. Step 4: provider profile details and company data. Step 5: properties owned by a provider, drafts, media. Step 6: listings (property + plan + publish/expiry dates) and package purchases. Today `Property` merges property and listing state; it will be split into `property` and `listing` when Add Property and plans are built, with the repository still returning the same read model.

## Backward compatibility (mock accounts)
Accounts written by Step 2 have no `phone`, `fullName` or terms fields. `parseUser` upgrades them on read: missing values become `null`, the legacy `displayName` stays readable through `fullNameOf()`, and an impossible `activeMode` is repaired. Corrupt records (no id/email, or no profile at all) are dropped. Storage keys and the `v1` namespace are unchanged.

Viewing requests saved by the first Step 3c build (loose `requestedStart` / `proposedStart` / `confirmedStart` times, no proposals) are converted on read into `proposals[]` with sensible outcomes, and history rows without ids receive stable ids; nothing is lost.
