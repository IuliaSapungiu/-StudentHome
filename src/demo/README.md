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
