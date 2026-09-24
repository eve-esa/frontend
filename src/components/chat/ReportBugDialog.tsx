import { useEffect, useRef, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faXmark } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Textarea } from "../ui/TextArea";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/types";
import {
  BUG_REPORT_DESCRIPTION_MAX,
  ReportBugSchema,
  collectBugReportContext,
  reportBugErrorMessage,
  useReportBug,
  type BugReportContext,
  type BugReportTarget,
  type ReportBugValidation,
} from "@/services/useReportBug";
import {
  ScreenshotError,
  captureScreenshot,
  isScreenshotSupported,
} from "@/observability/screenshot";

export const useReportBugForm = () =>
  useForm<ReportBugValidation>({
    mode: "onChange",
    resolver: zodResolver(ReportBugSchema),
    defaultValues: { description: "" },
  });

/**
 * The only thing the user is told about the context. The ids, the session,
 * the trace and the page are for whoever triages the report, not for the
 * person filing it, so none of them is rendered.
 */
export const contextNote = (context: BugReportContext): string =>
  context.conversation_id
    ? "Technical details about this conversation are attached automatically to help us investigate."
    : "Technical details about this page are attached automatically to help us investigate.";

type ReportBugFormProps = {
  form: UseFormReturn<ReportBugValidation>;
  context: BugReportContext;
  screenshot: Blob | null;
  screenshotError: string | null;
  isCapturing: boolean;
  isSubmitting: boolean;
  /** Why the last send failed, shown above the buttons. */
  submitError?: string | null;
  canCapture: boolean;
  onCaptureScreenshot: () => void;
  onRemoveScreenshot: () => void;
  onSubmit: (values: ReportBugValidation) => void;
  onCancel: () => void;
};

export const ReportBugForm = ({
  form,
  context,
  screenshot,
  screenshotError,
  isCapturing,
  isSubmitting,
  submitError,
  canCapture,
  onCaptureScreenshot,
  onRemoveScreenshot,
  onSubmit,
  onCancel,
}: ReportBugFormProps) => {
  const {
    handleSubmit,
    setValue,
    watch,
    formState: { isValid, errors },
  } = form;
  const description = watch("description");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 h-full overflow-y-auto"
    >
      <div className="flex flex-col gap-2 flex-none">
        <label htmlFor="report-bug-description" className="text-sm">
          What went wrong?
        </label>
        <div className="w-full border-primary-400 border-2 flex flex-col bg-primary-900">
          {/* data-private: session replay never records the description,
              same as the chat composer. */}
          <Textarea
            id="report-bug-description"
            ref={textareaRef}
            data-private
            value={description}
            maxLength={BUG_REPORT_DESCRIPTION_MAX}
            aria-invalid={!!errors?.description}
            onChange={(e) =>
              setValue("description", e.target.value, {
                shouldValidate: true,
              })
            }
            placeholder="Describe what you did, what you expected and what happened instead..."
            className={cn(
              "border-none focus:ring-0 flex items-center justify-center !p-4 min-h-[90px] !max-h-[200px] !bg-primary-600",
            )}
          />
        </div>
        <div className="flex justify-between gap-2 text-xs">
          {errors?.description ? (
            <p className="text-sm text-red-500" role="alert">
              {errors.description.message}
            </p>
          ) : (
            <span />
          )}
          <span className="text-natural-200 shrink-0">
            {description.length}/{BUG_REPORT_DESCRIPTION_MAX}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {canCapture ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onCaptureScreenshot}
              disabled={isCapturing || isSubmitting}
            >
              <FontAwesomeIcon icon={faCamera} />
              {screenshot ? "Retake screenshot" : "Add screenshot"}
            </Button>
            {screenshot && (
              <span
                data-testid="report-bug-screenshot"
                className="flex items-center gap-2 text-sm text-natural-200"
              >
                Screenshot attached ({Math.ceil(screenshot.size / 1024)} KB)
                <Button
                  type="button"
                  variant="icon"
                  size="sm"
                  aria-label="Remove screenshot"
                  onClick={onRemoveScreenshot}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </Button>
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-natural-200">
            Screenshots are not available in this browser.
          </p>
        )}
        {screenshotError && (
          <p className="text-sm text-red-500" role="alert">
            {screenshotError}
          </p>
        )}
      </div>

      <p data-testid="report-bug-context-note" className="text-xs text-natural-200">
        {contextNote(context)}
      </p>

      {submitError && (
        <p className="text-sm text-red-500" role="alert">
          {submitError}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="md" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={!isValid || isSubmitting}
          variant="primary"
          size="md"
          type="submit"
          className="min-w-[100px]"
        >
          {isSubmitting ? "Sending..." : "Send"}
        </Button>
      </div>
    </form>
  );
};

type ReportBugDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The conversation and message the report is about, when known. */
  target?: BugReportTarget;
  /** Overrides the collected context. For tests and stories. */
  context?: BugReportContext;
};

/**
 * "Report a bug": a description and an optional screenshot from the user, plus
 * the telemetry context (session, replay link, trace, conversation and message
 * ids, build, browser), sent to POST /bug-reports. The context is read once
 * when the dialog opens and is never shown: the user only reads that technical
 * details are attached.
 */
export const ReportBugDialog = ({
  isOpen,
  onOpenChange,
  target,
  context: contextOverride,
}: ReportBugDialogProps) => {
  const queryClient = useQueryClient();
  const form = useReportBugForm();
  const [context, setContext] = useState<BugReportContext | null>(null);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const { reset } = form;

  const { mutate, isPending, error, reset: resetMutation } = useReportBug(() =>
    onOpenChange(false),
  );

  useEffect(() => {
    if (isOpen) {
      setContext(
        contextOverride ?? collectBugReportContext(queryClient, target),
      );
    } else {
      reset();
      resetMutation();
      setContext(null);
      setScreenshot(null);
      setScreenshotError(null);
      setIsCapturing(false);
    }
    // Read once per opening: the target of an open dialog does not change.
  }, [isOpen, contextOverride, queryClient, reset]);

  // Not async, and captureScreenshot() comes first: getDisplayMedia must run
  // inside this click, before anything awaits. The dialog is hidden while the
  // browser asks what to share, so the frame shows the page, not the dialog.
  const onCaptureScreenshot = () => {
    setScreenshotError(null);
    const pending = captureScreenshot();
    setIsCapturing(true);
    pending
      .then((blob) => setScreenshot(blob))
      .catch((reason: unknown) => {
        setScreenshotError(
          reason instanceof ScreenshotError
            ? reason.message
            : "The screenshot could not be taken.",
        );
      })
      .finally(() => setIsCapturing(false));
  };

  const onSubmit = ({ description }: ReportBugValidation) => {
    if (!context) return;
    mutate({ description: description.trim(), context, screenshot });
  };

  return (
    <Dialog open={isOpen && !isCapturing} onOpenChange={onOpenChange}>
      <DialogContent className="md:!max-w-[720px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Report a bug</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Tell us what happened, in your own words.
        </DialogDescription>
        {context && (
          <ReportBugForm
            form={form}
            context={context}
            screenshot={screenshot}
            screenshotError={screenshotError}
            isCapturing={isCapturing}
            isSubmitting={isPending}
            submitError={error ? reportBugErrorMessage(error as ApiError) : null}
            canCapture={isScreenshotSupported()}
            onCaptureScreenshot={onCaptureScreenshot}
            onRemoveScreenshot={() => setScreenshot(null)}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
