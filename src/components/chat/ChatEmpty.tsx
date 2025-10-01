import { MessageInput } from "./MessageInput";
import { useCreateConversation } from "@/services/useCreateConversation";
import { generatePath, useNavigate } from "react-router-dom";
import { routes } from "@/utilities/routes";
import {
  LOCAL_STORAGE_DRAFT_NEW_CONVERSATION,
  LOCAL_STORAGE_WELCOME_DIALOG_VIEWED,
} from "@/utilities/localStorage";
import { suggestions } from "@/utilities/suggestions";
import { ChatHeader } from "./ChatHeader";
import { useState } from "react";
import { WelcomeDialog } from "../onboarding/WelcomeDialog";

export const ChatEmpty = () => {
  const navigate = useNavigate();
  const welcomeDialogViewed = localStorage.getItem(
    LOCAL_STORAGE_WELCOME_DIALOG_VIEWED
  );
  const [isOpenWelcomeDialog, setIsOpenWelcomeDialog] = useState(
    !welcomeDialogViewed
  );

  const handleWelcomeDialogClose = () => {
    localStorage.setItem(LOCAL_STORAGE_WELCOME_DIALOG_VIEWED, "true");
    setIsOpenWelcomeDialog(false);
  };

  const createConversationSuccess = (conversationId: string) => {
    navigate(generatePath(routes.CHAT.path, { conversationId }));
  };

  const { mutate: createConversation, isPending: isCreatingConversation } =
    useCreateConversation(createConversationSuccess);

  const handleSendRequest = async (input: string) => {
    localStorage.setItem(LOCAL_STORAGE_DRAFT_NEW_CONVERSATION, input);
    await createConversation(input);
  };

  return (
    <div className="flex h-full w-full flex-col bg-natural-900 relative overflow-hidden">
      <div className="flex-none">
        <ChatHeader />
      </div>
      <div className="w-full flex flex-col items-center justify-center mt-10 md:mt-50 2xl:mt-80 3xl:mt-100 gap-4 overflow-hidden px-container-responsive px-4 md:px-6">
        <div className="w-full overflow-y-auto flex flex-col gap-2 overflow-hidden">
          <MessageInput
            variant="secondary"
            suggestions={suggestions}
            isLoading={isCreatingConversation}
            disabled={isCreatingConversation}
            className="w-full max-w-[760px] @6xl:max-w-[900px] @8xl:max-w-[1000px] @9xl:max-w-[1200px] @10xl:max-w-[1400px] mx-auto  overflow-hidden"
            sendRequest={handleSendRequest}
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
