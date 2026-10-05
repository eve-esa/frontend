import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useGetProfile } from "@/services/useMe";
import {
  PROFILE_FIELDS_ENABLED,
  WELCOME_DIALOG_ENABLED,
} from "@/utilities/features";
import { LOCAL_STORAGE_WELCOME_DIALOG_VIEWED } from "@/utilities/localStorage";
import {
  isWelcomeDialogPending,
  shouldAskProfileFields,
} from "@/utilities/profileRequired";
import { routes } from "@/utilities/routes";
import { ProfileRequiredDialog } from "./ProfileRequiredDialog";

type ProfileRequiredGateProps = {
  /** The tour is running. */
  tourRunning: boolean;
};

/**
 * Mounted once in the chat layout. With FEATURE_PROFILE_FIELDS on it shows the required profile
 * dialog to a signed-in user whose profile lacks country or institution, after the onboarding
 * page, the tour and the welcome dialog are gone. Off, it renders nothing and reads nothing new:
 * the profile query is the one PrivateRoute already ran.
 */
export const ProfileRequiredGate = ({ tourRunning }: ProfileRequiredGateProps) => {
  const location = useLocation();
  const { data: profile } = useGetProfile({ enabled: PROFILE_FIELDS_ENABLED });
  const [saved, setSaved] = useState(false);
  const [welcomeDialogViewed, setWelcomeDialogViewed] = useState(() =>
    Boolean(localStorage.getItem(LOCAL_STORAGE_WELCOME_DIALOG_VIEWED))
  );

  // ChatEmpty and OnboardingContent fire this when the welcome dialog closes.
  useEffect(() => {
    const onWelcomeClosed = () => setWelcomeDialogViewed(true);
    window.addEventListener("welcome-dialog-closed", onWelcomeClosed);
    return () =>
      window.removeEventListener("welcome-dialog-closed", onWelcomeClosed);
  }, []);

  const open =
    !saved &&
    shouldAskProfileFields({
      enabled: PROFILE_FIELDS_ENABLED,
      profile,
      onboardingOpen:
        tourRunning ||
        location.pathname === routes.ONBOARDING.path ||
        isWelcomeDialogPending({
          welcomeDialogEnabled: WELCOME_DIALOG_ENABLED,
          onEmptyChat: location.pathname === routes.EMPTY_CHAT.path,
          welcomeDialogViewed,
        }),
    });

  if (!open || !profile) return null;
  return (
    <ProfileRequiredDialog profile={profile} onSaved={() => setSaved(true)} />
  );
};
