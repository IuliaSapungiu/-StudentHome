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
