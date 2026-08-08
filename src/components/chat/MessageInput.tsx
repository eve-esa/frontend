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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AttachmentPreviewList,
  type PendingAttachment,
} from "./AttachmentPreviewList";
import { useUploadImage } from "@/services/useUploadImage";
import logo from "@/assets/images/esa_phi_lab_1.svg";
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
  setStoredModelSelection,
} from "@/utilities/modelSelection";
import { useListModels } from "@/services/useListModels";
import { CustomModelsDialog } from "./CustomModelsDialog";
import {
  CUSTOM_MODELS_ENABLED,
  MODEL_PICKER_ENABLED,
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
import { useParams } from "react-router-dom";
import { abortCurrentStream } from "@/services/streaming";
import { stopConversation as stopConversationApi } from "@/services/stopConversation";
import { Tooltip } from "@/components/ui/Tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/services/keys";
import { useTokenUsage } from "@/services/useTokenUsage";


const TOKEN_RING_R = 7;
const TOKEN_RING_C = 2 * Math.PI * TOKEN_RING_R;
/** Teal ring accent aligned with ESA branding artwork (~#00BFA5) */
const TOKEN_RING_TEAL = "#00BFA5";

function TokenUsageRing({
  usedRatio,
  unlimited,
}: {
  usedRatio: number | null;
  unlimited: boolean;
}) {
  const ratio =
    unlimited || usedRatio == null ? 0 : Math.min(1, Math.max(0, usedRatio));
  const dash = ratio * TOKEN_RING_C;

  return (
    <svg
      viewBox="0 0 20 20"
      className="h-6 w-6 shrink-0"
      aria-hidden
      focusable="false"
    >
      <g transform="rotate(-90 10 10)">
        <circle
          cx="10"
          cy="10"
          r={TOKEN_RING_R}
          fill="none"
          stroke={TOKEN_RING_TEAL}
          strokeOpacity={0.32}
          strokeWidth="2.5"
        />
        {ratio > 0 && (
          <circle
            cx="10"
            cy="10"
            r={TOKEN_RING_R}
            fill="none"
            stroke={TOKEN_RING_TEAL}
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
  sendRequest?: (input: string, attachments?: ImageAttachment[]) => void;
  suggestions?: string[];
};

export const MessageInput = ({
  variant = "primary",
  className,
  placeholder = "Ask something ...",
  isLoading,
  disabled,
  sendRequest,
  suggestions,
}: MessageInputProps) => {
  const { isRunning, currentStep } = useTour();
  const { handleSubmit, reset, setValue, control } = useForm({
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

  const isUploading = attachments.some((a) => a.status === "uploading");

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
    (files: File[]) => {
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
    [attachments.length, uploadOne],
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

  const onSubmit = (data: { input: string }) => {
    const inputLengthWithoutNewlines = data.input.replace(/\n/g, "").length;
    if (inputLengthWithoutNewlines > maxCharacters || isUploading) return;

    const uploaded = attachments
      .filter((a) => a.status === "done" && a.uploaded)
      .map((a) => a.uploaded as ImageAttachment);

    sendRequest?.(data.input, uploaded.length > 0 ? uploaded : undefined);
    reset();
    clearAttachments();
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
      "application/json": [".json"],
      "application/geo+json": [".geojson"],
    },
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [modelSelectionValue, setModelSelectionValue] = useState<string>(() =>
    modelSelectionToValue(getStoredModelSelection()),
  );
  const [customModelsOpen, setCustomModelsOpen] = useState(false);
  const { data: models } = useListModels();
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

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
        className="flex h-8 w-8 cursor-default items-center justify-center"
        aria-label="Token usage for this billing period"
      >
        <TokenUsageRing
          usedRatio={tokenUsage?.used_ratio ?? null}
          unlimited={tokenUsage?.unlimited ?? true}
        />
      </div>
    </Tooltip>
  );

  const handleStop = async () => {
    try {
      abortCurrentStream();
      // Immediately mark the last message as stopped to halt smoothing UI
      if (conversationId) {
        queryClient.setQueryData<ChaMessageType>(
          [QUERY_KEYS.conversation, conversationId],
          (old) => {
            if (!old || !old.messages?.length) return old;
            const newMessages = [...old.messages];
            const lastIndex = newMessages.length - 1;
            if (lastIndex >= 0) {
              const last = newMessages[lastIndex] as MessageType;
              newMessages[lastIndex] = {
                ...last,
                stopped: true,
              } as MessageType;
            }
            return { ...old, messages: newMessages };
          },
        );
      }
      if (conversationId) {
        const result = await stopConversationApi({ conversationId });
        const stoppedId = result?.message_id as
          | string
          | undefined;
        if (stoppedId) {
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
    if (currentStep === 9 && isRunning) {
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

  return (
    <div
      className={cn(
        `flex flex-col gap-6 mx-auto h-full w-full overflow-hidden ${
          variant === "secondary" ? "pb-40" : ""
        }`,
      )}
    >
      {suggestions && (
        <img src={logo} alt="logo" className="h-[60px] md:h-[110px]" />
      )}

      <div className="flex flex-col gap-2 h-full">
        <form className={`flex gap-4  ${className || ""} h-full`}>
          <div
            {...getRootProps()}
            className={cn(
              "w-full  flex-none border-primary-400 border-2 flex flex-col bg-primary-900 relative start-new-chat-tour",
              isDragActive && "border-dashed border-primary-200 bg-primary-800",
            )}
            data-tour="start-new-chat-tour"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/csv,text/plain,application/json,.pdf,.csv,.txt,.json,.geojson"
              multiple
              className="hidden"
              data-testid="attach-image-input"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <Textarea
              ref={textareaRef}
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
                {MODEL_PICKER_ENABLED && (
                    <div className="min-w-[140px]">
                      <Select
                        value={modelSelectionValue}
                        onValueChange={(value) => {
                          setModelSelectionValue(value);
                          setStoredModelSelection(
                            parseModelSelectionValue(value),
                          );
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          className="bg-primary-900/60 border border-primary-400/60"
                        >
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent className="bg-primary-900/60 border-primary-400/60 backdrop-blur-[2px]">
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
                {CUSTOM_MODELS_ENABLED && (
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
                    className="h-8 w-8 p-0 cursor-pointer settings-button-tour"
                    data-tour="settings-button"
                  >
                    <FontAwesomeIcon icon={faSliders} className="size-4" />
                  </Button>
                </Tooltip>
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
                    className="h-8 w-8 p-0 cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faPaperclip} className="size-4" />
                  </Button>
                </Tooltip>
              </div>
              <div className="pointer-events-auto flex items-center gap-1">
                {tokenRing}
                {isLoading ? (
                  <Button
                    type="button"
                    variant="icon"
                    size="sm"
                    className="h-8 w-8 p-0 cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStop();
                    }}
                  >
                    <FontAwesomeIcon icon={faStop} className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={
                      !inputValue.trim().length ||
                      isOverLimit ||
                      disabled ||
                      isUploading
                    }
                    variant="icon"
                    size="sm"
                    className="h-8 w-8 p-0 cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSubmit(onSubmit)();
                    }}
                  >
                    <FontAwesomeIcon icon={faPaperPlane} className="size-4 " />
                  </Button>
                )}
              </div>
            </div>
            {suggestions && showSuggestions && (
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

        <p
          className={`text-sm text-natural-200 text-center ${className || ""} overflow-visible`}
        >
          EVE outputs represent an automated synthesis and do not constitute
          statements by, or endorsements from, the original data providers or
          authors.{" "}
          <span className="text-sm text-natural-200 text-center whitespace-nowrap">
            EVE could make errors. Always check the content.
          </span>
        </p>
      </div>
    </div>
  );
};
