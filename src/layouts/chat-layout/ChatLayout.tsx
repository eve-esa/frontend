import Joyride from "react-joyride";
import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { DynamicSidebarProvider } from "@/components/chat/DynamicSidebarProvider";
import { ConversationsMenuSidebar } from "@/components/chat/ConversationsMenuSidebar";
import { DynamicSidebar } from "@/components/chat/DynamicSidebar";
import { readStoredSettings } from "@/utilities/messageDefaultSettings";
import {
  LOCAL_STORAGE_PRIVATE_COLLECTIONS,
  LOCAL_STORAGE_PUBLIC_COLLECTIONS,
  LOCAL_STORAGE_SETTINGS,
} from "@/utilities/localStorage";
import { TourProvider } from "@/components/onboarding/TourContext";
import { steps } from "@/utilities/onboardingSteps";
import { useJoyride } from "@/hooks/useJoyride";
import { useGetSharedCollection } from "@/services/useGetSharedCollection";
import { useGetMyCollections } from "@/services/useGetMyCollections";
import {
  getCompleteCatalog,
  reconcileCollectionStorage,
} from "@/utilities/collections";

export const ChatLayout = () => {
  const { run, stepIndex, handleJoyrideCallback } = useJoyride();
  const {
    data: publicCollections,
    hasNextPage: publicHasNextPage,
    isFetchingNextPage: publicIsFetchingNextPage,
    fetchNextPage: fetchNextPublicPage,
  } = useGetSharedCollection();
  const {
    data: myCollections,
    hasNextPage: myHasNextPage,
    isFetchingNextPage: myIsFetchingNextPage,
    fetchNextPage: fetchNextMyPage,
  } = useGetMyCollections({});

  // Reconcile only against the full catalog: a partial one would drop the
  // stored ids that live on pages not fetched yet. Pull every page first.
  useEffect(() => {
    if (publicHasNextPage && !publicIsFetchingNextPage) {
      void fetchNextPublicPage();
    }
  }, [publicHasNextPage, publicIsFetchingNextPage, fetchNextPublicPage]);

  useEffect(() => {
    if (myHasNextPage && !myIsFetchingNextPage) {
      void fetchNextMyPage();
    }
  }, [myHasNextPage, myIsFetchingNextPage, fetchNextMyPage]);

  useEffect(() => {
    const catalog = getCompleteCatalog(publicCollections, publicHasNextPage);
    if (!catalog) return;
    reconcileCollectionStorage(LOCAL_STORAGE_PUBLIC_COLLECTIONS, catalog);
  }, [publicCollections, publicHasNextPage]);

  useEffect(() => {
    const catalog = getCompleteCatalog(myCollections, myHasNextPage);
    if (!catalog) return;
    reconcileCollectionStorage(LOCAL_STORAGE_PRIVATE_COLLECTIONS, catalog);
  }, [myCollections, myHasNextPage]);

  useEffect(() => {
    // Seed and repair stored settings: fills missing keys with defaults and
    // clamps out-of-range values, so every reader sees a complete object.
    localStorage.setItem(
      LOCAL_STORAGE_SETTINGS,
      JSON.stringify(readStoredSettings())
    );
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
