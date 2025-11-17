import { MessageInput } from "@/components/chat/MessageInput";
import { suggestions } from "@/utilities/suggestions";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { useSidebar } from "../chat/DynamicSidebarProvider";
import { useEffect, useState } from "react";
import { useTour } from "@/components/onboarding/TourContext";
import { WelcomeDialog } from "@/components/onboarding/WelcomeDialog";

export const OnboardingContent = () => {
  const {
    openDynamicSidebar,
    closeDynamicSidebar,
    isOpenDynamicSidebar,
    content,
  } = useSidebar();
  const { currentStep } = useTour();

  const [isOpenWelcomeDialog, setIsOpenWelcomeDialog] = useState(true);

  const handleWelcomeDialogClose = () => {
    setIsOpenWelcomeDialog(false);
    // Signal joyride to start without persisting any state
    window.dispatchEvent(new CustomEvent("welcome-dialog-closed"));
  };

  useEffect(() => {
    openDynamicSidebar({ type: "settings" });

    return () => {
      closeDynamicSidebar();
    };
  }, []);

  const getSidebarType = (currentStep: number) => {
    // Steps 0-4: settings sidebar
    // Steps 5+: my-collections sidebar
    if (currentStep <= 3) {
      return "settings";
    } else {
      return "my-collections";
    }
  };

  useEffect(() => {
    const sidebarType = getSidebarType(currentStep);

    if (!isOpenDynamicSidebar || content?.type !== sidebarType) {
      openDynamicSidebar({ type: sidebarType });
    }
  }, [currentStep, isOpenDynamicSidebar, content?.type]);

  return (
    <div className="flex h-full w-full flex-col bg-natural-900 relative">
      <div className="flex-none">
        <ChatHeader />
      </div>
      <div className="w-full flex flex-col items-center justify-center mt-10 md:mt-50 2xl:mt-80 gap-4 px-container-responsive px-4 md:px-6">
        <div className="w-full pb-20">
          <MessageInput
            suggestions={suggestions}
            isLoading={false}
            disabled={false}
            className="w-full max-w-[760px] @6xl:max-w-[900px] @8xl:max-w-[1000px] @9xl:max-w-[1200px] @10xl:max-w-[1400px] mx-auto new-chat-input-tour"
            data-tour="new-chat-input"
          />
        </div>
      </div>
      {isOpenWelcomeDialog && (
        <WelcomeDialog
          isOpen={isOpenWelcomeDialog}
          onOpenChange={handleWelcomeDialogClose}
        />
      )}
    </div>
  );
};
