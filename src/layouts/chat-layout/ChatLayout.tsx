import { DynamicSidebarProvider } from "@/components/chat/DynamicSidebarProvider";
import { ConversationsMenuSidebar } from "@/components/chat/ConversationsMenuSidebar";
import { DynamicSidebar } from "@/components/chat/DynamicSidebar";
import { Outlet } from "react-router-dom";
import { messageDefaultSettings } from "@/utilities/messageDefaultSettings";
import {
  LOCAL_STORAGE_PUBLIC_COLLECTIONS,
  LOCAL_STORAGE_SETTINGS,
} from "@/utilities/localStorage";
import { useEffect } from "react";
import Joyride from "react-joyride";
import { TourProvider } from "@/components/onboarding/TourContext";
import { steps } from "@/utilities/onboardingSteps";
import { useJoyride } from "@/hooks/useJoyride";
import { useGetSharedCollection } from "@/services/useGetSharedCollection";

export const ChatLayout = () => {
  const { run, stepIndex, handleJoyrideCallback } = useJoyride();
  const storedPublicCollections = localStorage.getItem(
    LOCAL_STORAGE_PUBLIC_COLLECTIONS
  );
  const { data: publicCollections } = useGetSharedCollection();

  useEffect(() => {
    if (publicCollections && !storedPublicCollections) {
      localStorage.setItem(
        LOCAL_STORAGE_PUBLIC_COLLECTIONS,
        JSON.stringify(
          publicCollections?.pages.flatMap((page) =>
            page.data.map((collection) => collection?.name)
          )
        )
      );
    }
  }, [publicCollections]);

  useEffect(() => {
    const settings = localStorage.getItem(LOCAL_STORAGE_SETTINGS);

    if (!settings) {
      localStorage.setItem(
        LOCAL_STORAGE_SETTINGS,
        JSON.stringify(messageDefaultSettings)
      );
    }
  }, []);

  return (
    <div className="h-[100dvh] w-screen overflow-hidden">
      <TourProvider
        isRunning={run}
        currentStep={stepIndex}
        totalSteps={steps.length}
      >
        <DynamicSidebarProvider>
          <div className="flex h-full w-full overflow-hidden relative">
            <Joyride
              callback={handleJoyrideCallback}
              continuous={true}
              run={run}
              scrollToFirstStep={false}
              showProgress
              showSkipButton
              stepIndex={stepIndex}
              steps={steps}
              disableScrolling={true}
              hideCloseButton={true}
              disableOverlayClose={true}
              locale={{
                last: "Start New Chat",
                next: "Next",
                back: "Previous",
                skip: "Skip Tour",
              }}
              styles={{
                options: {
                  primaryColor: "var(--color-primary-500)",
                  zIndex: 10000,
                  arrowColor: "#335e6f",
                },
              }}
            />

            {/* Left Sidebar: Conversations, Menu items, New chat button */}
            <ConversationsMenuSidebar />

            {/* Main content: Chat */}
            <div className="flex-1 h-full flex flex-col @container">
              <Outlet />
            </div>

            {/* Right Dynamic Sidebar: Settings, Sources, Knowledge Base  */}
            <DynamicSidebar />
          </div>
        </DynamicSidebarProvider>
      </TourProvider>
    </div>
  );
};
