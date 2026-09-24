import { useEffect, useRef, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
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
    ? "We attach the technical details of this conversation to help us fix it."
    : "We attach the technical details of this page to help us fix it.";

/** The character count shows up only when the limit is near. */
const COUNTER_FROM = BUG_REPORT_DESCRIPTION_MAX - 500;

type ReportBugFormProps = {
  form: UseFormReturn<ReportBugValidation>;
  context: BugReportContext;
  isSubmitting: boolean;
  /** Why the last send failed, shown above the buttons. */
  submitError?: string | null;
  onSubmit: (values: ReportBugValidation) => void;
  onCancel: () => void;
};

export const ReportBugForm = ({
  form,
  context,
  isSubmitting,
  submitError,
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
        {(errors?.description || description.length >= COUNTER_FROM) && (
          <div className="flex justify-between gap-2 text-xs">
            {errors?.description ? (
              <p className="text-sm text-red-500" role="alert">
                {errors.description.message}
              </p>
            ) : (
              <span />
            )}
            {description.length >= COUNTER_FROM && (
              <span className="text-natural-200 shrink-0">
                {description.length}/{BUG_REPORT_DESCRIPTION_MAX}
              </span>
            )}
          </div>
        )}
      </div>

      <p
        data-testid="report-bug-context-note"
        className="text-sm text-natural-200"
      >
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
 * "Report a bug": a description from the user plus the telemetry context
 * (session, replay link, trace, conversation and message ids, build, browser),
 * sent to POST /bug-reports. There is no screenshot: the session replay the
 * link opens shows the page. The context is read once when the dialog opens
 * and is never shown: the user only reads that technical details are
 * attached. The replay link is positioned at the moment the report is sent.
 */
export const ReportBugDialog = ({
  isOpen,
  onOpenChange,
  target,
  context: contextOverride,
}: ReportBugDialogProps) => {
  const queryClient = useQueryClient();
  const form = useReportBugForm();
  const [context, setContext] = useState<BugReportContext | null>(() =>
    isOpen
      ? (contextOverride ?? collectBugReportContext(queryClient, target))
      : null,
  );
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
    }
    // Read once per opening: the target of an open dialog does not change.
  }, [isOpen, contextOverride, queryClient, reset]);

  const onSubmit = ({ description }: ReportBugValidation) => {
    if (!context) return;
    mutate({ description: description.trim(), context });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
            isSubmitting={isPending}
            submitError={error ? reportBugErrorMessage(error as ApiError) : null}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
