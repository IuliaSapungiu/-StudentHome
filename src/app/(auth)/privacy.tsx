import { LegalScreen } from '@/components/LegalScreen';

export default function PrivacyScreen() {
  return (
    <LegalScreen
      title="Privacy Policy"
      paragraphs={[
        'This is placeholder privacy text for the StudentHouse demo.',
        'The final Privacy Policy will explain what personal data is collected, why, how long it is kept, and how to exercise your rights.',
        'The demo stores account details only on this device and never sends real emails or text messages.',
      ]}
    />
  );
}
