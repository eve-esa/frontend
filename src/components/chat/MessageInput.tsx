import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/TextArea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";
import {
  faArrowRight,
  faPlus,
  faPaperclip,
  faSearch,
  faSliders,
  faStop,
} from "@fortawesome/free-solid-svg-icons";
import { useForm, useWatch } from "react-hook-form";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { useSidebar } from "./DynamicSidebarProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AttachmentPreviewList,
  type PendingAttachment,
} from "./AttachmentPreviewList";
import { useUploadImage } from "@/services/useUploadImage";
import { EsaPhiLabLogo } from "@/components/ui/EsaPhiLabLogo";
import { useTour } from "@/components/onboarding/TourContext";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  getStoredModelSelection,
  modelSelectionToValue,
  parseModelSelectionValue,
  reconcileModelSelection,
  withoutCustomModels,
  setStoredModelSelection,
} from "@/utilities/modelSelection";
import { useListModels } from "@/services/useListModels";
import { updateLastTempMessage } from "@/services/agenticMessage";
import { CustomModelsDialog } from "./CustomModelsDialog";
import {
  ATTACHMENTS_ENABLED,
  CONVERSATION_DOCUMENTS_ENABLED,
  CUSTOM_MODELS_ENABLED,
  MOBILE_COMPOSER_ENABLED,
  MODEL_PICKER_ENABLED,
  SETTINGS_PAGE_ENABLED,
} from "@/utilities/features";
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  ACCEPTED_UPLOAD_MIME_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_IMAGE_SIZE_BYTES,
  type ChaMessageType,
  type ImageAttachment,
  type MessageType,
} from "@/types";
import { generatePath, useNavigate, useParams } from "react-router-dom";
import api from "@/services/axios";
import {
  documentErrorMessage,
  isConversationDocument,
  MAX_CONVERSATION_DOCUMENT_BYTES,
  type SentDocuments,
  uploadConversationDocuments,
} from "@/services/useConversationDocuments";
import {
  cancelDocumentWait,
  isDocumentWaitActive,
} from "@/services/documentWait";
import { httpCreateConversation } from "@/services/useCreateConversation";
import { LOCAL_STORAGE_DRAFT_NEW_CONVERSATION } from "@/utilities/localStorage";
import { serializeDraftNewConversation } from "@/utilities/draftNewConversation";
import { StagedDocuments } from "./StagedDocuments";

// The chat route's path, as in useReportBug.ts. Importing @/utilities/routes here would pull every
// page (and the OIDC module) into the composer and close an import cycle through ChatPage.
const CHAT_PATH = "/chat/:conversationId";
import { abortCurrentStream } from "@/services/streaming";
import {
  cancelBusyWait,
  clearBusyNotice,
  isBusyWaitActive,
  takeBusyDraft,
  useBusyNotice,
} from "@/services/serviceBusy";
import { ComposerBusyNotice } from "./ComposerBusyNotice";
import {
  releaseSentAttachments,
  restoreSentAttachments,
  stashSentAttachments,
} from "@/utilities/busyAttachments";
import { stopConversation as stopConversationApi } from "@/services/stopConversation";
import { rememberStoppedMessageId } from "@/utilities/stoppedPartials";
import { Tooltip } from "@/components/ui/Tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { MUTATION_KEYS, QUERY_KEYS } from "@/services/keys";
import { isRunningRow, stopRunningTurn } from "@/services/stopRunningTurn";
import { useTokenUsage } from "@/services/useTokenUsage";
import { useIsPhone } from "@/hooks/useIsPhone";
import { MODEL_SELECTION_EVENT } from "@/hooks/useModelSelection";
import { ComposerDisclaimer } from "./ComposerDisclaimer";
import { composerButtonClasses } from "./composerButtons";


/**
 * FEATURE_MOBILE_COMPOSER, below md: the suggestion rows live outside the composer. A tap on one
 * dispatches this event on `window` with the suggestion as `detail`, and the composer fills its
 * input with it and takes focus.
 */
export const COMPOSER_FILL_EVENT = "eve:composer-fill";

const TOKEN_RING_R = 7;
const TOKEN_RING_C = 2 * Math.PI * TOKEN_RING_R;

function TokenUsageRing({
  usedRatio,
  unlimited,
  className,
}: {
  usedRatio: number | null;
  unlimited: boolean;
  className?: string;
}) {
  const ratio =
    unlimited || usedRatio == null ? 0 : Math.min(1, Math.max(0, usedRatio));
  const dash = ratio * TOKEN_RING_C;

  return (
    <svg
      viewBox="0 0 20 20"
      className={cn("h-6 w-6 shrink-0", className)}
      aria-hidden
      focusable="false"
    >
      <g transform="rotate(-90 10 10)">
        <circle
          cx="10"
          cy="10"
          r={TOKEN_RING_R}
          fill="none"
          // Dark: the ring colour at 32 %. Light: a full track in the chip
          // fill (#E0E4E7), so the focus arc reads 3.2:1 against it.
          className="stroke-token-ring [stroke-opacity:0.32] in-data-[theme=light]:stroke-primary-500 in-data-[theme=light]:[stroke-opacity:1]"
          strokeWidth="2.5"
        />
        {ratio > 0 && (
          <circle
            cx="10"
            cy="10"
            r={TOKEN_RING_R}
            fill="none"
            // Light: the focus colour, a mark that carries meaning (3:1).
            className="stroke-token-ring in-data-[theme=light]:stroke-focus"
            strokeOpacity={1}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${TOKEN_RING_C}`}
          />
        )}
      </g>
    </svg>
  );
}

export type MessageInputProps = {
  variant?: "primary" | "secondary";
  isLoading: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  sendRequest?: (
    input: string,
    attachments?: ImageAttachment[],
    sentDocuments?: SentDocuments,
  ) => void;
  suggestions?: string[];
  /**
   * True once the conversation holds a message. With FEATURE_MOBILE_COMPOSER on, the notice under
   * the composer shows only then; off, the full statement always shows and this is ignored.
   */
  showDisclaimer?: boolean;
};

export const MessageInput = ({
  variant = "primary",
  className,
  placeholder = "Ask something ...",
  isLoading,
  disabled,
  sendRequest,
  suggestions,
  showDisclaimer = false,
}: MessageInputProps) => {
  const { isRunning, currentStep, totalSteps } = useTour();
  // FEATURE_MOBILE_COMPOSER, below md: the model picker is in the header (K2), and the logo and
  // the suggestions are rendered above the composer by the empty chat (K3), not inside this box.
  const isPhone = useIsPhone();
  const phone = MOBILE_COMPOSER_ENABLED && isPhone;
  const buttons = composerButtonClasses();
  const { handleSubmit, reset, setValue, getValues, control } = useForm({
    defaultValues: {
      input: "",
    },
  });

  const { openDynamicSidebar } = useSidebar();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { conversationId } = useParams();

  const inputValue = useWatch({ control, name: "input" });

  const maxCharacters = 100000;
  const inputLengthWithoutNewlines = inputValue.replace(/\n/g, "").length;
  const isOverLimit = inputLengthWithoutNewlines > maxCharacters;

  // ─── File attachments ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const { mutateAsync: uploadImage } = useUploadImage();
  const navigate = useNavigate();
  // PDF, TXT and MD become documents of this conversation. They stay here,
  // removable and not uploaded, until Send: then they are uploaded, parsed in
  // the background, and the question waits for them.
  const [stagedDocuments, setStagedDocuments] = useState<File[]>([]);
  const [isSendingDocuments, setIsSendingDocuments] = useState(false);

  const stageDocuments = useCallback((files: File[]) => {
    const fitting = files.filter((file) => {
      if (file.size <= MAX_CONVERSATION_DOCUMENT_BYTES) return true;
      toast.error(`${file.name}: file exceeds 10 MB`);
      return false;
    });
    setStagedDocuments((prev) => [
      ...prev,
      ...fitting.filter(
        (file) =>
          !prev.some((p) => p.name === file.name && p.size === file.size),
      ),
    ]);
  }, []);

  const unstageDocument = useCallback((file: File) => {
    setStagedDocuments((prev) => prev.filter((p) => p !== file));
  }, []);

  const isUploading =
    isSendingDocuments || attachments.some((a) => a.status === "uploading");

  // A refused send (overloaded backend, twice, or Stop during the countdown)
  // comes back here: text and attachments return to the composer, ahead of
  // anything added during the countdown.
  const busyNotice = useBusyNotice(conversationId);
  useEffect(() => {
    if (!conversationId || !busyNotice || busyNotice.phase === "waiting") return;
    const draft = takeBusyDraft(conversationId);
    if (draft === null) return;
    const typed = getValues("input");
    setValue("input", typed.trim() ? `${draft.text}\n\n${typed}` : draft.text);
    const restored = restoreSentAttachments(conversationId, draft.attachments);
    if (restored.length > 0) {
      setAttachments((prev) => [...restored, ...prev]);
    }
  }, [busyNotice, conversationId, getValues, setValue]);

  // Previews kept for a possible busy refusal go with the composer.
  useEffect(() => {
    if (!conversationId) return;
    return () => releaseSentAttachments(conversationId);
  }, [conversationId]);

  const uploadOne = useCallback(
    async (item: PendingAttachment) => {
      setAttachments((prev) =>
        prev.map((a) =>
          a.localId === item.localId
            ? { ...a, status: "uploading", progress: 0 }
            : a,
        ),
      );
      try {
        const data = await uploadImage({
          file: item.file,
          onUploadProgress: (event) => {
            const progress = event.total
              ? Math.round((event.loaded / event.total) * 100)
              : 0;
            setAttachments((prev) =>
              prev.map((a) =>
                a.localId === item.localId ? { ...a, progress } : a,
              ),
            );
          },
        });
        const uploaded: ImageAttachment = {
          id: data.id,
          url: data.url,
          filename: data.filename,
          content_type: data.content_type,
          size: data.size_bytes,
        };
        setAttachments((prev) =>
          prev.map((a) =>
            a.localId === item.localId
              ? { ...a, status: "done", progress: 100, uploaded }
              : a,
          ),
        );
      } catch {
        // Error is toasted/logged by useUploadImage; mark item for retry.
        setAttachments((prev) =>
          prev.map((a) =>
            a.localId === item.localId ? { ...a, status: "error" } : a,
          ),
        );
      }
    },
    [uploadImage],
  );

  const addFiles = useCallback(
    (dropped: File[]) => {
      const documents = CONVERSATION_DOCUMENTS_ENABLED
        ? dropped.filter(isConversationDocument)
        : [];
      if (documents.length > 0) stageDocuments(documents);
      const files = dropped.filter((file) => !documents.includes(file));
      if (files.length === 0) return;
      const accepted: File[] = [];
      let slots = MAX_ATTACHMENTS_PER_MESSAGE - attachments.length;

      for (const file of files) {
        const name = file.name.toLowerCase();
        const isAccepted =
          ACCEPTED_UPLOAD_MIME_TYPES.includes(file.type) ||
          ACCEPTED_UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext));
        if (!isAccepted) {
          toast.error(`${file.name}: unsupported file type`);
          continue;
        }
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          toast.error(`${file.name}: file exceeds 10 MB`);
          continue;
        }
        if (slots <= 0) {
          toast.error(
            `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files`,
          );
          break;
        }
        accepted.push(file);
        slots -= 1;
      }

      if (accepted.length === 0) return;

      const newItems: PendingAttachment[] = accepted.map((file) => ({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        // Only images get a thumbnail; other types render as a file chip.
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : "",
        filename: file.name,
        status: "uploading",
        progress: 0,
      }));

      setAttachments((prev) => [...prev, ...newItems]);
      newItems.forEach((item) => void uploadOne(item));
    },
    [attachments.length, uploadOne, stageDocuments],
  );

  const removeAttachment = useCallback((localId: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.localId !== localId);
    });
  }, []);

  const retryAttachment = useCallback(
    (localId: string) => {
      const target = attachments.find((a) => a.localId === localId);
      if (target) void uploadOne(target);
    },
    [attachments, uploadOne],
  );

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      return [];
    });
  }, []);

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Third of the four ways in. Returning early leaves the paste as a normal
    // text paste rather than swallowing the event.
    if (!ATTACHMENTS_ENABLED) return;

    const images = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (images.length > 0) {
      event.preventDefault();
      addFiles(images);
    }
  };

  // Revoke any outstanding preview object URLs on unmount.
  useEffect(() => {
    return () => {
      setAttachments((prev) => {
        prev.forEach((a) => URL.revokeObjectURL(a.previewUrl));
        return prev;
      });
    };
  }, []);

  const onSubmit = async (data: { input: string }) => {
    const inputLengthWithoutNewlines = data.input.replace(/\n/g, "").length;
    if (inputLengthWithoutNewlines > maxCharacters || isUploading) return;

    const uploaded = attachments
      .filter((a) => a.status === "done" && a.uploaded)
      .map((a) => a.uploaded as ImageAttachment);

    // Staged documents go up now. The turn waits for their background job
    // (useSendRequest), so the answer can search them.
    let sentDocuments: SentDocuments | undefined;
    if (stagedDocuments.length > 0) {
      setIsSendingDocuments(true);
      let created: string | undefined;
      try {
        let target = conversationId;
        if (!target) {
          created = (await httpCreateConversation(data.input)).id as string;
          target = created;
        }
        sentDocuments = await uploadConversationDocuments(
          target,
          stagedDocuments,
        );
        setStagedDocuments([]);
        if (created) {
          // New chat: Chat replays the draft once the conversation opens.
          localStorage.setItem(
            LOCAL_STORAGE_DRAFT_NEW_CONVERSATION,
            serializeDraftNewConversation({
              input: data.input,
              attachments: uploaded.length > 0 ? uploaded : undefined,
              sentDocuments,
            }),
          );
          clearAttachments();
          reset();
          void queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.conversationsList],
          });
          navigate(generatePath(CHAT_PATH, { conversationId: created }));
          return;
        }
      } catch (error) {
        toast.error(
          documentErrorMessage(error, "The documents could not be uploaded."),
        );
        // An empty conversation made only for this upload is not kept.
        if (created) {
          void api.delete(`/conversations/${created}`).catch(() => undefined);
        }
        return;
      } finally {
        setIsSendingDocuments(false);
      }
    }

    if (conversationId) {
      clearBusyNotice(conversationId);
      // Kept, previews alive, in case the backend is busy and the send comes
      // back; released at the next send.
      const sentItems = attachments.filter(
        (a) => a.status === "done" && a.uploaded,
      );
      stashSentAttachments(conversationId, sentItems);
      setAttachments((prev) => {
        prev
          .filter((a) => !sentItems.includes(a))
          .forEach((a) => URL.revokeObjectURL(a.previewUrl));
        return [];
      });
    } else {
      clearAttachments();
    }
    sendRequest?.(
      data.input,
      uploaded.length > 0 ? uploaded : undefined,
      sentDocuments,
    );
    reset();
  };

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: addFiles,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
      "image/gif": [".gif"],
      "application/pdf": [".pdf"],
      "text/csv": [".csv"],
      "text/plain": [".txt"],
      ...(CONVERSATION_DOCUMENTS_ENABLED ? { "text/markdown": [".md"] } : {}),
      "application/json": [".json"],
      "application/geo+json": [".geojson"],
    },
    multiple: true,
    noClick: true,
    noKeyboard: true,
    // Same option DocumentUploader uses: the root props stay in place, the drop
    // is inert and the drag highlight never turns on.
    disabled: !ATTACHMENTS_ENABLED,
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [modelSelectionValue, setModelSelectionValue] = useState<string>(() =>
    modelSelectionToValue(getStoredModelSelection()),
  );
  const [customModelsOpen, setCustomModelsOpen] = useState(false);
  const { data: listedModels } = useListModels();
  // Custom models are listed, and reconciled against, only where they are
  // enabled: off (or with agentic chat off) a stored custom selection falls
  // back to the default platform model instead of naming a hidden entry.
  const models = useMemo(
    () =>
      CUSTOM_MODELS_ENABLED ? listedModels : withoutCustomModels(listedModels),
    [listedModels],
  );
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const modelsRef = useRef(models);
  useEffect(() => {
    modelsRef.current = models;
  }, [models]);

  // The header field (phone) writes the choice to storage and says so: follow it, so the picker
  // shown after a resize past md is not stale.
  // Below md the suggestions are rows above the composer, outside this component: a tap there
  // announces its text and the input takes it.
  useEffect(() => {
    if (!MOBILE_COMPOSER_ENABLED) return;
    const onFill = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      if (typeof text !== "string") return;
      setValue("input", text);
      textareaRef.current?.focus();
    };
    window.addEventListener(COMPOSER_FILL_EVENT, onFill);
    return () => window.removeEventListener(COMPOSER_FILL_EVENT, onFill);
  }, [setValue]);

  useEffect(() => {
    if (!MOBILE_COMPOSER_ENABLED) return;
    // Same reconcile as the [models] effect, so a deleted custom model is never shown.
    const onChange = () => {
      const currentModels = modelsRef.current;
      const stored = getStoredModelSelection(currentModels);
      setModelSelectionValue(
        modelSelectionToValue(
          currentModels
            ? reconcileModelSelection(stored, currentModels)
            : stored,
        ),
      );
    };
    window.addEventListener(MODEL_SELECTION_EVENT, onChange);
    return () => window.removeEventListener(MODEL_SELECTION_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!models) return;
    const stored = getStoredModelSelection(models);
    const reconciled = reconcileModelSelection(stored, models);
    if (
      reconciled.type !== stored.type ||
      reconciled.id !== stored.id
    ) {
      setStoredModelSelection(reconciled);
    }
    setModelSelectionValue(modelSelectionToValue(reconciled));
  }, [models]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  const {
    data: tokenUsage,
    isPending: tokenUsagePending,
    isError: tokenUsageError,
  } = useTokenUsage();

  const tokenUsageTooltip = tokenUsagePending ? (
    <>Loading token usage…</>
  ) : tokenUsageError ? (
    <>Could not load token usage.</>
  ) : tokenUsage ? (
    tokenUsage.unlimited ? (
      <>No fixed token limit for this window.</>
    ) : tokenUsage.max_tokens != null ? (
      <>
        {tokenUsage.used_tokens.toLocaleString()} /{" "}
        {tokenUsage.max_tokens.toLocaleString()} tokens used
      </>
    ) : (
      <>Token usage.</>
    )
  ) : (
    <>Token usage</>
  );

  const tokenRing = (
    <Tooltip content={tokenUsageTooltip} disableClick={true} side="top">
      <div
        className={
          MOBILE_COMPOSER_ENABLED
            ? "flex h-8 w-8 cursor-default items-center justify-center max-md:h-[44px] max-md:w-[36px]"
            : "flex h-8 w-8 cursor-default items-center justify-center"
        }
        aria-label="Token usage for this billing period"
      >
        <TokenUsageRing
          usedRatio={tokenUsage?.used_ratio ?? null}
          unlimited={tokenUsage?.unlimited ?? true}
          className={MOBILE_COMPOSER_ENABLED ? "max-md:h-[28px] max-md:w-[28px]" : undefined}
        />
      </div>
    </Tooltip>
  );

  const handleStop = async () => {
    // Stop during the busy countdown: nothing is streaming yet, so there is
    // nothing to abort or to stop on the backend. Canceling the wait ends the
    // turn and returns the text to the composer.
    if (conversationId && isBusyWaitActive(conversationId)) {
      cancelBusyWait(conversationId);
      return;
    }
    // Stop while the sent documents are still processing: the question has
    // not reached the model yet, so the wait is canceled and nothing else.
    if (conversationId && isDocumentWaitActive(conversationId)) {
      cancelDocumentWait(conversationId);
      return;
    }
    // Position of the turn this Stop is for, read before anything awaits: the
    // Stop response binds its message id to this turn, not to whichever stop
    // is pending when the response lands.
    const cached = conversationId
      ? queryClient.getQueryData<ChaMessageType>([
          QUERY_KEYS.conversation,
          conversationId,
        ])
      : undefined;
    const lastIndex = (cached?.messages?.length ?? 0) - 1;
    // A turn this page does not stream (reloaded mid-turn): only the backend
    // Stop for this conversation. The stream controller is global, aborting
    // it would end another conversation's live stream.
    const last = cached?.messages?.[lastIndex];
    const sending =
      queryClient.isMutating({
        mutationKey: [MUTATION_KEYS.sendRequest, conversationId],
      }) > 0;
    if (conversationId && last && !sending && isRunningRow(last)) {
      await stopRunningTurn(queryClient, conversationId, lastIndex, last.id);
      return;
    }
    const stoppedIndex = cached?.messages?.[lastIndex]?.id?.startsWith("temp-")
      ? lastIndex
      : -1;
    try {
      abortCurrentStream();
      // Immediately mark the in-flight optimistic message as stopped to halt
      // the smoothing UI. Temp-scoped on purpose: a stop clicked right after
      // completion must not stamp "stopped" onto a finished answer.
      if (conversationId) {
        updateLastTempMessage(queryClient, conversationId, (message) => ({
          ...message,
          stopped: true,
        }));
      }
      if (conversationId) {
        const result = await stopConversationApi({ conversationId });
        const stoppedId = result?.message_id as
          | string
          | undefined;
        if (stoppedId) {
          rememberStoppedMessageId(conversationId, stoppedIndex, stoppedId);
          queryClient.setQueryData<ChaMessageType>(
            [QUERY_KEYS.conversation, conversationId],
            (old) => {
              if (!old || !old.messages?.length) return old;
              const newMessages = old.messages.map((m) => {
                if ((m as MessageType).id === stoppedId) {
                  return {
                    ...(m as MessageType),
                    stopped: true,
                  } as MessageType;
                }
                return m as MessageType;
              });
              return { ...old, messages: newMessages };
            },
          );
        }
      }
    } catch (_e) {
      console.error("Error stopping conversation", _e);
    }
  };

  useEffect(() => {
    // The last step is the "start new chat" one, wherever it lands: the tour is
    // shorter when private collections are off, so its index is derived, not 9.
    if (currentStep === totalSteps - 1 && isRunning) {
      setShowSuggestions(true);
    }
  }, [currentStep]);

  const hideSuggestions = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsAnimatingOut(true);
    timeoutRef.current = setTimeout(() => {
      setShowSuggestions(false);
      setIsAnimatingOut(false);
      timeoutRef.current = null;
    }, 200); // Match animation duration
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const controlPanelButton = (
    <Tooltip content={<>Control Panel</>} disableClick={true}>
      <Button
        type="button"
        variant="icon"
        size="sm"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openDynamicSidebar({ type: "settings" });
        }}
        onClick={(e) => {
          if (e.detail === 0) openDynamicSidebar({ type: "settings" });
        }}
        className={cn(buttons.quietWide, "settings-button-tour")}
        data-tour="settings-button"
        data-testid="composer-settings"
        aria-label="Control Panel"
      >
        <FontAwesomeIcon icon={faSliders} className="size-4" />
        {MOBILE_COMPOSER_ENABLED && <span>Control Panel</span>}
      </Button>
    </Tooltip>
  );

  const attachButton = ATTACHMENTS_ENABLED ? (
    <Tooltip content={<>Attach files</>} disableClick={true}>
      <Button
        type="button"
        variant="icon"
        size="sm"
        aria-label="Attach files"
        data-testid="attach-image-button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
        onClick={(e) => {
          if (e.detail === 0) fileInputRef.current?.click();
        }}
        className={buttons.quiet}
      >
        <FontAwesomeIcon icon={faPaperclip} className="size-4" />
      </Button>
    </Tooltip>
  ) : null;

  return (
    <div
      className={cn(
        `flex flex-col gap-6 mx-auto h-full w-full overflow-hidden ${
          variant === "secondary"
            ? MOBILE_COMPOSER_ENABLED
              ? "md:pb-40"
              : "pb-40"
            : ""
        }`,
        // The notice sits in the padding under the composer, outside this box.
        MOBILE_COMPOSER_ENABLED && "max-md:overflow-visible!",
      )}
    >
      {suggestions && !phone && (
        <EsaPhiLabLogo className="h-[60px] md:h-[110px]" />
      )}

      <div
        className={cn(
          "flex flex-col gap-2 h-full",
          MOBILE_COMPOSER_ENABLED && "max-md:relative",
        )}
      >
        <ComposerBusyNotice notice={busyNotice} />
        {/* Sending runs from the button handlers and the Enter key, never from a
            native submit: without this, any click that lands on the Send button
            submits the form with a GET and reloads the whole page. */}
        <form
          className={`flex gap-4  ${className || ""} h-full`}
          onSubmit={(e) => e.preventDefault()}
        >
          <div
            {...getRootProps()}
            className={cn(
              "w-full  flex-none border-composer-edge border-2 flex flex-col bg-primary-900 relative start-new-chat-tour",
              isDragActive
                ? "border-dashed bg-primary-800 in-data-[theme=light]:border-control"
                : "in-data-[theme=light]:focus-within:border-focus",
            )}
            data-tour="start-new-chat-tour"
            data-testid="composer-box"
          >
            {ATTACHMENTS_ENABLED && (
              <input
                ref={fileInputRef}
                type="file"
                accept={`image/png,image/jpeg,image/webp,image/gif,application/pdf,text/csv,text/plain,application/json,.pdf,.csv,.txt,.json,.geojson${CONVERSATION_DOCUMENTS_ENABLED ? ",.md,text/markdown" : ""}`}
                multiple
                className="hidden"
                data-testid="attach-image-input"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            )}
            <Textarea
              ref={textareaRef}
              data-testid="composer-input"
              data-private
              value={inputValue}
              onChange={(e) => setValue("input", e.target.value)}
              onPaste={handlePaste}
              onFocus={() => {
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
                setShowSuggestions(true);
                setIsAnimatingOut(false);
              }}
              onBlur={() => {
                if (showSuggestions && !isAnimatingOut) {
                  hideSuggestions();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (
                    inputValue.trim().length > 0 &&
                    !isOverLimit &&
                    !disabled &&
                    !isUploading
                  ) {
                    handleSubmit(onSubmit)();
                  }
                }
              }}
              placeholder={placeholder}
            />

            <StagedDocuments
              files={stagedDocuments}
              onRemove={unstageDocument}
              disabled={isSendingDocuments}
            />

            <AttachmentPreviewList
              attachments={attachments}
              onRemove={removeAttachment}
              onRetry={retryAttachment}
            />

            {isOverLimit && (
              <div className="text-sm 3xl:text-lg text-danger-400 px-4 md:px-8">
                Character limit exceeded ({inputLengthWithoutNewlines}/
                {maxCharacters})
              </div>
            )}

            <div className="flex items-center justify-between pointer-events-none p-2 md:p-6 pt-0 md:pt-1">
              <div className="pointer-events-auto flex items-center gap-2">
                {MODEL_PICKER_ENABLED && !phone && (
                    <div className="min-w-[140px]">
                      <Select
                        value={modelSelectionValue}
                        onValueChange={(value) => {
                          // Radix's hidden native select emits "" on remount.
                          // No item carries that value, so persisting it would
                          // record a selection the user never made and blank
                          // the trigger.
                          if (!value) return;
                          setModelSelectionValue(value);
                          setStoredModelSelection(
                            parseModelSelectionValue(value),
                          );
                        }}
                      >
                        {/* Bordered with control/60 in both themes, so in
                            light it keeps its own white fill and the shared
                            placeholder grey instead of the trigger's light
                            highlight fill. */}
                        <SelectTrigger
                          data-testid="composer-model-picker"
                          size="sm"
                          className="bg-primary-900/60 border border-control/60 in-data-[theme=light]:bg-primary-900/60 in-data-[theme=light]:[--color-placeholder:inherit]"
                        >
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        {/* Opaque in both themes: at 60 % and frosted, the
                            text under the menu showed through. */}
                        <SelectContent
                          data-testid="composer-model-picker-menu"
                          className="bg-primary-900 border-control/60"
                        >
                          {models?.platform.map((model) => (
                            <SelectItem
                              key={model.id}
                              value={modelSelectionToValue({
                                type: "platform",
                                id: model.id,
                              })}
                            >
                              {model.display_name}
                            </SelectItem>
                          ))}
                          {(models?.custom?.length ?? 0) > 0 ? (
                            <>
                              {models?.custom.map((model) => (
                                <SelectItem
                                  key={model.id}
                                  value={modelSelectionToValue({
                                    type: "custom",
                                    id: model.id,
                                  })}
                                >
                                  {model.display_name}
                                </SelectItem>
                              ))}
                            </>
                          ) : null}
                        </SelectContent>
                      </Select>
                    </div>
                )}
                {/* With the Settings page on, custom models live in Settings, Models. */}
                {CUSTOM_MODELS_ENABLED && !SETTINGS_PAGE_ENABLED && (
                  <>
                    <Tooltip
                      content={<>Manage custom models</>}
                      disableClick={true}
                    >
                      <Button
                        type="button"
                        variant="icon"
                        size="sm"
                        className="h-8 w-8 p-0 cursor-pointer"
                        onClick={() => setCustomModelsOpen(true)}
                        aria-label="Manage custom models"
                        data-testid="composer-manage-models"
                      >
                        <FontAwesomeIcon icon={faPlus} className="size-4" />
                      </Button>
                    </Tooltip>
                    <CustomModelsDialog
                      isOpen={customModelsOpen}
                      onOpenChange={setCustomModelsOpen}
                    />
                  </>
                )}
                {/* Attach first when the composer is redesigned, so the tab order reads
                    the way the buttons do. */}
                {MOBILE_COMPOSER_ENABLED ? (
                  <>
                    {attachButton}
                    {controlPanelButton}
                  </>
                ) : (
                  <>
                    {controlPanelButton}
                    {attachButton}
                  </>
                )}
              </div>
              <div className="pointer-events-auto flex items-center gap-1">
                {tokenRing}
                {/* Distinct keys so React mounts a new button instead of turning
                    Stop into Send in place: Stop fires on mousedown, and the
                    click that follows must not land on the Send button. The
                    onClick handlers only serve keyboard activation (detail 0);
                    mouse presses are handled on mousedown. */}
                {isLoading ? (
                  <Button
                    key="composer-stop"
                    type="button"
                    variant="icon"
                    size="sm"
                    aria-label="Stop generating"
                    data-testid="composer-stop"
                    className={buttons.filled}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStop();
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) handleStop();
                    }}
                  >
                    <FontAwesomeIcon icon={faStop} className="size-4" />
                  </Button>
                ) : (
                  <Button
                    key="composer-send"
                    type="submit"
                    disabled={
                      !inputValue.trim().length ||
                      isOverLimit ||
                      disabled ||
                      isUploading
                    }
                    variant="icon"
                    size="sm"
                    aria-label="Send message"
                    data-testid="composer-send"
                    className={buttons.filled}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSubmit(onSubmit)();
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) handleSubmit(onSubmit)();
                    }}
                  >
                    <FontAwesomeIcon icon={faPaperPlane} className="size-4 " />
                  </Button>
                )}
              </div>
            </div>
            {suggestions && showSuggestions && !phone && (
              <div className="h-full flex flex-col gap-2 border-t-2 overflow-y-auto border-primary-400 ">
                <div
                  className={`bg-primary-900 flex flex-col gap-4 p-4 md:p-8 ${
                    isAnimatingOut ? "animate-fade-out" : "animate-fade-in"
                  }`}
                >
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setValue("input", suggestion);
                        textareaRef.current?.focus();
                      }}
                      className="group w-full flex justify-between gap-4 cursor-pointer bg-primary-900 text-natural-200 p-2 hover:text-natural-50 hover:bg-primary-400/20 border-2 border-primary-400 transition-colors duration-200"
                    >
                      <div className="flex items-start gap-2">
                        <FontAwesomeIcon
                          icon={faSearch}
                          className="size-4 mt-1"
                        />
                        <p>{suggestion}</p>
                      </div>

                      <div className="hidden group-hover:block text-end rotate-[-45deg]">
                        <FontAwesomeIcon
                          icon={faArrowRight}
                          className="size-4"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        <ComposerDisclaimer
          show={showDisclaimer}
          className={className}
          lineClassName="max-md:absolute max-md:inset-x-0 max-md:top-full max-md:mt-1"
        />
      </div>
    </div>
  );
};
