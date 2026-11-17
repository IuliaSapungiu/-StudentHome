# Demo-only features

Everything here exists only to let you preview the app without a backend.

## Turn the demo account shortcuts off (no code change)
Release builds already have them off. They only appear in development builds, or when a build
sets `EXPO_PUBLIC_ALLOW_DEMO_ACCOUNTS=true`. When off, any demo account left on a device is
ignored and cleaned up the next time the app starts.

## Remove them permanently
1. Delete the `src/demo/` folder.
2. Delete `src/config/demo.ts`.
3. In `src/app/(auth)/login.tsx`, delete the `DemoAccountShortcuts` import and its one line of JSX.
4. In `src/app/_layout.tsx`, delete the `demoAccountsEnabled` import and pass `allowDemoAccounts={false}`
   (or remove that prop and the `isDemo` checks in `SessionProvider`).
5. Optional: remove `signInAsMockUser` from `SessionProvider` and the `isDemo` field from `MockUser`.

Registration, login, the session, and mode switching do not depend on anything in this folder.

## Demo verification simulator (Step 3a)
Simulated email-link, SMS-code and verification-status controls. Everything is flagged `simulated` and is never real verification.

- **Where:** `src/demo/VerificationSimulator.tsx`, `DemoEmailSimulation.tsx`, `demoVerificationControls.ts`, `demoControls.ts`; the route `src/app/demo-controls.tsx`; the flag `demoVerificationEnabled` in `src/config/demo.ts`.
- **Turn off without code changes:** release builds have it off. It appears only in development builds, or when a build sets `EXPO_PUBLIC_ALLOW_DEMO_VERIFICATION=true`. When off, the mock verification service answers "not available in this build", the demo-controls route redirects away, and the Profile row and the email simulation buttons are hidden.
- **Remove permanently:** delete the simulator files and `src/app/demo-controls.tsx`; remove the `demoVerificationEnabled` uses in `ProfileScreen.tsx` and `verify-email.tsx`; remove `seedDemoAccount` from `DemoAccountShortcuts.tsx` (or the whole shortcuts, as above). The real verification service replaces `mockVerificationService`.
- **Production safety:** screens only ever read verification status. No client code can write a status; only the mock service and this simulator can, and the simulator refuses when disabled.

## Demo landlord and sample data (Step 3c)
There are no landlord accounts yet, so these explicit buttons play the landlord's side. Nothing happens automatically, and every simulated action is marked `simulated` and shown as "Demo" in the app.

- **Where:** `src/demo/demoCommunication.ts` (sample conversations, viewings and one application, plus a clear function), `demoLandlord.ts` (the simulated landlord, calling the same owner-side repository methods the future landlord screens will use), `demoLandlordActions.ts` (the demo landlord and sample-data helpers the screen calls), `DemoLandlordControls.tsx` (the screen content); the route `src/app/demo-landlord.tsx`; the Profile button; the flag `demoLandlordEnabled` in `src/config/demo.ts`. Fictional addresses live in `src/data/mockAddresses.ts`.
- **Turn off without code changes:** release builds have it off. It appears only in development builds, or when a build sets `EXPO_PUBLIC_ALLOW_DEMO_LANDLORD=true`. When off, the route redirects away, the Profile button is hidden and the responder refuses.
- **Remove permanently:** delete the files above, the route, the Profile button and `demoLandlordEnabled`. The messaging, viewing and application repositories keep working; real landlord accounts then switch `ownerActionsSimulated` off (see `docs/supabase-migration.md`).
- **Notifications and history (corrections round):** the demo landlord's actions create the same in-app notifications a real landlord's would (marked "Demo"), the sample data includes one unread notification, and "Landlord suggests another time" can be pressed repeatedly to build a viewing history. Nothing is sent anywhere.
- **Hide / Delete testing (corrections round 2):** the demo landlord's conversation list comes from each landlord's own participant list, shows whether the student has the conversation visible, hidden or deleted, and a demo reply brings it back into the student's inbox. It uses the same repository calls the future landlord screens will use.
