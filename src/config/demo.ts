// Demo-only account shortcuts ("preview account types" on the login screen).
// Enabled in development builds. In release builds they stay OFF unless a build sets
//   EXPO_PUBLIC_ALLOW_DEMO_ACCOUNTS=true
// To remove the feature for good, see src/demo/README.md.
export const demoAccountsEnabled: boolean = __DEV__ || process.env.EXPO_PUBLIC_ALLOW_DEMO_ACCOUNTS === 'true';
