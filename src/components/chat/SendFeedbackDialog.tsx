import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { useForm } from "react-hook-form";
import { Textarea } from "../ui/TextArea";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { feedbackReason } from "@/utilities/feedbackReason";
import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const SendFeedbackSchema = z.object({
  feedback_reason: z.string().min(1, { message: "Feedback text is required" }),
});

type SendFeedbackValidation = z.infer<typeof SendFeedbackSchema>;

type SendFeedbackDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSendFeedback: (feedbackText: string) => void;
};

export const SendFeedbackDialog = ({
  isOpen,
  onOpenChange,
  onSendFeedback,
}: SendFeedbackDialogProps) => {
  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isValid, errors },
  } = useForm<SendFeedbackValidation>({
    mode: "onChange",
    resolver: zodResolver(SendFeedbackSchema),
    defaultValues: {
      feedback_reason: "",
    },
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const feedbackValue = watch("feedback_reason");

  // Auto-focus textarea when dialog opens and reset form when it closes
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure dialog is fully rendered
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    } else {
      // Reset form when dialog closes
      reset();
    }
  }, [isOpen, reset]);

  const onSubmit = (data: SendFeedbackValidation) => {
    onSendFeedback(data.feedback_reason);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="md:!max-w-[800px] max-h-[90vh] overflow-hidden h-full md:h-fit">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          What didn't you like about this response?
        </DialogDescription>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 h-full overflow-hidden"
        >
          <div className="flex flex-col gap-2 flex-none">
            <div className="w-full border-primary-400 border-2 flex flex-col bg-primary-900">
              <Textarea
                ref={textareaRef}
                value={feedbackValue}
                onChange={(e) =>
                  setValue("feedback_reason", e.target.value, {
                    shouldValidate: true,
                  })
                }
                placeholder="What didn't you like about this response? Describe your feedback here..."
                className={cn(
                  "border-none focus:ring-0  flex items-center justify-center !p-4  min-h-[70px] !max-h-[160px] !bg-primary-600"
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && isValid) {
                    e.preventDefault();
                    handleSubmit(onSubmit)();
                  }
                }}
              />
            </div>
            {errors?.feedback_reason && (
              <p className="text-sm text-red-500">
                {errors.feedback_reason.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-1 h-full overflow-y-auto">
            {feedbackReason.map((reason) => (
              <div
                key={reason?.id}
                onClick={() => {
                  setValue("feedback_reason", reason?.reason, {
                    shouldValidate: true,
                  });
                  textareaRef.current?.focus();
                }}
                className="cursor-pointer text-natural-200 py-2 px-4 hover:text-natural-50 hover:bg-primary-400/20 border-2 border-primary-400 transition-colors duration-200"
              >
                {reason?.reason}
              </div>
            ))}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              tabIndex={-1}
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!isValid}
              tabIndex={-1}
              variant="primary"
              size="md"
              type="submit"
              className="min-w-[100px]"
            >
              Send
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
