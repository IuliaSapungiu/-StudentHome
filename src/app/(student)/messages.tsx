import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { RequireAccount } from '@/features/session/RequireAccount';

// Placeholder: this screen gets built from the Figma design in a later step.
export default function MessagesScreen() {
  return (
    <RequireAccount>
      <PlaceholderScreen title="Messages" />
    </RequireAccount>
  );
}
