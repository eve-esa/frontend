import { NotFound } from "@/pages/not-found/NotFound";
import { ChatPage } from "@/pages/chat/ChatPage";
import { Login } from "@/pages/login/Login";
import { SignUp } from "@/pages/signup/Signup";
import { ForgotPassword } from "@/pages/forgot-password/ForgotPassword";
import { ResetPassword } from "@/pages/reset-password/ResetPassword";
import { EmptyChat } from "@/pages/empty-chat/EmptyChat";
import { OnboardingPage } from "@/pages/onboarding/OnboardingPage";

export const routes = {
  SIGN_UP: {
    path: "/signup",
    element: <SignUp />,
  },
  LOGIN: {
    path: "/login",
    element: <Login />,
  },
  FORGOT_PASSWORD: {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  RESET_PASSWORD: {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  EMPTY_CHAT: {
    path: "/",
    element: <EmptyChat />,
  },
  CHAT: {
    path: "/chat/:conversationId",
    element: <ChatPage />,
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
