import { ProfileScreen } from '@/components/ProfileScreen';
import { RequireAccount } from '@/features/session/RequireAccount';

export default function ProfileTab() {
  return (
    <RequireAccount>
      <ProfileScreen mode="student" />
    </RequireAccount>
  );
}
