import { createDemoExchangeRateSource, parseRateSetting } from '../features/currency/exchangeRate';

// Where the app gets its exchange rate. For Step 3b this is a fixed DEMO rate: it is not live, not
// current and not authoritative, and no network request is made. To try a different demo value:
//   EXPO_PUBLIC_DEMO_EUR_TO_RON=4.97
// (an unusable value falls back to the default of 5.00). A real provider can replace this single
// export later; Search, Filters, Map and Property Detail only call `exchangeRateSource.getRate()`.
export const exchangeRateSource = createDemoExchangeRateSource(parseRateSetting(process.env.EXPO_PUBLIC_DEMO_EUR_TO_RON));
