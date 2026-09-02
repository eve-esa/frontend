import { NotFound } from "@/pages/not-found/NotFound";
import { ChatPage } from "@/pages/chat/ChatPage";
import { Callback } from "@/pages/callback/Callback";
import { EmptyChat } from "@/pages/empty-chat/EmptyChat";
import { OnboardingPage } from "@/pages/onboarding/OnboardingPage";
import { ArtifactsPage } from "@/pages/artifacts/ArtifactsPage";
import { CALLBACK_PATH } from "@/services/oidc";

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
  NOT_FOUND: {
    path: "*",
    element: <NotFound />,
  },
};
