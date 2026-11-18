import { useState } from "react";
import { LogoutDialog } from "@/components/auth/LogoutDialog";
import { Button } from "@/components/ui/Button";
import { AppVersion } from "@/components/ui/AppVersion";
import { useGetProfile } from "@/services/useMe";
import { SettingsPanel, SettingsSection } from "./SettingsSection";

/** Log out through today's confirm dialog, and the app version. Delete account lands here later. */
export const AccountSection = () => {
  const [isOpenLogoutDialog, setIsOpenLogoutDialog] = useState(false);
  const { data: profile } = useGetProfile();

  return (
    <SettingsSection
      id="account"
      title="Account"
      lead="Session and account actions."
    >
      <SettingsPanel>
        <h2 className="font-['NotesESA'] text-lg text-natural-50">Session</h2>
        {profile?.email && (
          <p className="mt-1 text-md text-natural-200">
            Signed in as {profile.email}.
          </p>
        )}
        <AppVersion className="mt-1 text-left" />
        <Button
          variant="outline"
          size="md"
          className="mt-4"
          data-testid="settings-logout"
          onClick={() => setIsOpenLogoutDialog(true)}
        >
          Log out
        </Button>
      </SettingsPanel>

      <LogoutDialog
        isOpen={isOpenLogoutDialog}
        onOpenChange={setIsOpenLogoutDialog}
      />
    </SettingsSection>
  );
};
