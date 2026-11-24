import { MessageInput } from "./MessageInput";
import { useCreateConversation } from "@/services/useCreateConversation";
import { generatePath, useNavigate } from "react-router-dom";
import { routes } from "@/utilities/routes";
import {
  LOCAL_STORAGE_DRAFT_NEW_CONVERSATION,
  LOCAL_STORAGE_WELCOME_DIALOG_VIEWED,
} from "@/utilities/localStorage";
import { suggestions } from "@/utilities/suggestions";
import { serializeDraftNewConversation } from "@/utilities/draftNewConversation";
import type { ImageAttachment } from "@/types";
import { ChatHeader } from "./ChatHeader";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchTokenUsage } from "@/services/useTokenUsage";
import { WelcomeDialog } from "../onboarding/WelcomeDialog";
import { EsaPhiLabLogo } from "@/components/ui/EsaPhiLabLogo";
import { useIsPhone } from "@/hooks/useIsPhone";
import { SuggestionRows } from "./SuggestionRows";
import {
  MOBILE_COMPOSER_ENABLED,
  WELCOME_DIALOG_ENABLED,
} from "@/utilities/features";

/**
 * Put a suggestion into the composer. The text lives in the composer's own form state, so it goes
 * in the way a keystroke does: the native value setter, then an input event React turns into the
 * textarea's onChange.
 */
const fillComposerInput = (root: HTMLElement | null, text: string) => {
  const textarea = root?.querySelector<HTMLTextAreaElement>(
    '[data-testid="composer-input"]',
  );
  if (!textarea) return;
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  setValue?.call(textarea, text);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
};

export const ChatEmpty = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // FEATURE_MOBILE_COMPOSER, below md: logo and suggestion rows centre in the free space and the
  // composer takes the bottom slot a conversation uses. Anything else renders as before.
  const isPhone = useIsPhone();
  const phone = MOBILE_COMPOSER_ENABLED && isPhone;
  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void prefetchTokenUsage(queryClient);
  }, [queryClient]);
  const welcomeDialogViewed = localStorage.getItem(
    LOCAL_STORAGE_WELCOME_DIALOG_VIEWED,
  );
  const [isOpenWelcomeDialog, setIsOpenWelcomeDialog] =
    useState(!welcomeDialogViewed);

  const handleWelcomeDialogClose = () => {
    localStorage.setItem(LOCAL_STORAGE_WELCOME_DIALOG_VIEWED, "true");
    setIsOpenWelcomeDialog(false);
    // ProfileRequiredGate waits for this before it asks for the profile
    // fields. useJoyride listens for it only on /onboarding, so it starts no
    // tour here.
    window.dispatchEvent(new CustomEvent("welcome-dialog-closed"));
  };

  const createConversationSuccess = (conversationId: string) => {
    navigate(generatePath(routes.CHAT.path, { conversationId }));
  };

  const { mutate: createConversation, isPending: isCreatingConversation } =
    useCreateConversation(createConversationSuccess);

  const handleSendRequest = async (
    input: string,
    attachments?: ImageAttachment[],
  ) => {
    localStorage.setItem(
      LOCAL_STORAGE_DRAFT_NEW_CONVERSATION,
      serializeDraftNewConversation({ input, attachments }),
    );
    await createConversation(input);
  };

  return (
    <div className="flex h-full w-full flex-col bg-natural-900 in-data-[theme=light]:bg-(--color-chat-ground) relative overflow-hidden">
      <div className="flex-none">
        <ChatHeader />
      </div>
      <div
        className={
          phone
            ? // The wrapper fills the screen under the header; 16 px sides and 24 px under the
              // composer, the footer slot of a conversation (Chat.tsx), so the composer keeps its y.
              "w-full flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-4 pb-6"
            : "w-full flex flex-col items-center justify-center mt-10 md:mt-50 2xl:mt-80 3xl:mt-100 gap-4 overflow-hidden px-container-responsive px-4 md:px-6"
        }
      >
        {phone && (
          // Short screens scroll the hero instead of squeezing the composer.
          <div
            data-testid="empty-chat-hero"
            className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto"
          >
            <div className="my-auto flex flex-col gap-[18px] py-2">
              <EsaPhiLabLogo className="h-[60px]" />
              <SuggestionRows
                suggestions={suggestions.slice(0, 3)}
                disabled={isCreatingConversation}
                onPick={(suggestion) =>
                  fillComposerInput(composerRef.current, suggestion)
                }
              />
            </div>
          </div>
        )}
        <div
          ref={composerRef}
          className={
            phone
              ? "w-full overflow-y-auto flex flex-col gap-2 overflow-hidden flex-none"
              : "w-full overflow-y-auto flex flex-col gap-2 overflow-hidden"
          }
        >
          <MessageInput
            variant="secondary"
            suggestions={phone ? undefined : suggestions}
            isLoading={isCreatingConversation}
            disabled={isCreatingConversation}
            className="w-full max-w-[760px] @6xl:max-w-[900px] @8xl:max-w-[1000px] @9xl:max-w-[1200px] @10xl:max-w-[1400px] mx-auto  overflow-hidden"
            sendRequest={handleSendRequest}
          />
        </div>
      </div>

      {WELCOME_DIALOG_ENABLED && isOpenWelcomeDialog && (
        <WelcomeDialog
          isOpen={isOpenWelcomeDialog}
          onOpenChange={handleWelcomeDialogClose}
        />
      )}
    </div>
  );
};
