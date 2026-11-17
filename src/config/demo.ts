// Demo-only account shortcuts ("preview account types" on the login screen).
// Enabled in development builds. In release builds they stay OFF unless a build sets
//   EXPO_PUBLIC_ALLOW_DEMO_ACCOUNTS=true
// To remove the feature for good, see src/demo/README.md.
export const demoAccountsEnabled: boolean = __DEV__ || process.env.EXPO_PUBLIC_ALLOW_DEMO_ACCOUNTS === 'true';

// Demo-only verification simulator and simulated verification outcomes (email link, SMS code, statuses).
// Same rule: on in development builds; in release builds only with EXPO_PUBLIC_ALLOW_DEMO_VERIFICATION=true.
// When off, the mock verification service reports "not available in this build" and the simulator route redirects away.
export const demoVerificationEnabled: boolean = __DEV__ || process.env.EXPO_PUBLIC_ALLOW_DEMO_VERIFICATION === 'true';

// Demo-only landlord responses (explicit "the landlord replies / confirms / accepts" buttons) and sample
// conversations, viewings and applications. There are no real landlord accounts yet, so these are the only way to
// see the other side of a conversation. Every simulated landlord action is labelled "Demo" wherever it shows.
// On in development builds; in release builds only with EXPO_PUBLIC_ALLOW_DEMO_LANDLORD=true.
export const demoLandlordEnabled: boolean = __DEV__ || process.env.EXPO_PUBLIC_ALLOW_DEMO_LANDLORD === 'true';
