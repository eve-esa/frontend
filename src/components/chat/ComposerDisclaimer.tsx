import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";
import { MOBILE_COMPOSER_ENABLED } from "@/utilities/features";

/** The full statement: what the Learn more dialog shows, word for word. */
export const DISCLAIMER_FULL_TEXT =
  "EVE outputs represent an automated synthesis and do not constitute statements by, or endorsements from, the original data providers or authors. EVE could make errors. Always check the content.";

type ComposerDisclaimerProps = {
  /** True once the conversation holds a message. Read only with FEATURE_MOBILE_COMPOSER on. */
  show?: boolean;
  /** Classes of the composer's own width, for the full statement of the flag-off layout. */
  className?: string;
  /** Classes of the short line, for where it sits. */
  lineClassName?: string;
};

/**
 * The notice under the composer. Flag off: the full statement, always, as before. Flag on: nothing
 * on the empty chat; after the first answer one line, "EVE is AI and can make mistakes." with a
 * Learn more button that opens the full statement in a Dialog.
 */
export const ComposerDisclaimer = ({
  show = false,
  className,
  lineClassName,
}: ComposerDisclaimerProps) => {
  if (!MOBILE_COMPOSER_ENABLED) {
    return (
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
    );
  }

  if (!show) return null;

  return (
    <p
      data-testid="composer-disclaimer"
      className={cn(
        "text-center text-[12px] leading-4 whitespace-nowrap text-natural-200",
        lineClassName,
      )}
    >
      EVE is AI and can make mistakes.{" "}
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            data-testid="disclaimer-learn-more"
            className="relative cursor-pointer text-natural-50 underline outline-none after:absolute after:inset-x-0 after:-inset-y-[15px] after:content-[''] focus-visible:ring-[2px] focus-visible:ring-focus"
          >
            Learn more
          </button>
        </DialogTrigger>
        <DialogContent showCloseButton={false} data-testid="disclaimer-dialog">
          <DialogHeader className="text-left">
            <DialogTitle>About EVE&apos;s answers</DialogTitle>
            <DialogDescription>{DISCLAIMER_FULL_TEXT}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                data-testid="disclaimer-dialog-close"
                className="h-[44px] bg-highlight/40 px-5 text-natural-50 in-data-[theme=light]:bg-highlight enabled:hover:bg-highlight/60 in-data-[theme=light]:enabled:hover:bg-primary-500"
              >
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </p>
  );
};
