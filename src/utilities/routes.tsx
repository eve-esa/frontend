import { NotFound } from "@/pages/not-found/NotFound";
import { ChatPage } from "@/pages/chat/ChatPage";
import { Callback } from "@/pages/callback/Callback";
import { EmptyChat } from "@/pages/empty-chat/EmptyChat";
import { OnboardingPage } from "@/pages/onboarding/OnboardingPage";
import { ArtifactsPage } from "@/pages/artifacts/ArtifactsPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { SETTINGS_PATH, settingsPath } from "@/pages/settings/sections";
import { CALLBACK_PATH } from "@/services/oidc";
import { Navigate } from "react-router-dom";

export const routes = {
  CALLBACK: {
    path: CALLBACK_PATH,
    element: <Callback />,
  },
  EMPTY_CHAT: {
    path: "/",
    element: <EmptyChat />,
  },
  CHAT: {
    path: "/chat/:conversationId",
    element: <ChatPage />,
  },
  ARTIFACTS: {
    path: "/artifacts",
    element: <ArtifactsPage />,
  },
  ONBOARDING: {
    path: "/onboarding",
    element: <OnboardingPage />,
  },
  // Both only with FEATURE_SETTINGS_PAGE on (router.tsx).
  SETTINGS_INDEX: {
    path: SETTINGS_PATH,
    element: <Navigate to={settingsPath("profile")} replace />,
  },
  SETTINGS: {
    path: `${SETTINGS_PATH}/:section`,
    element: <SettingsPage />,
  },
  NOT_FOUND: {
    path: "*",
    element: <NotFound />,
  },
};
