import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { DialogOverlay, DialogPortal } from "./Dialog";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Takes focus when the sheet closes: the control that opened it (Safari does not focus a tapped button). */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  "data-testid"?: string;
};

/**
 * A sheet that rises from the bottom edge, for choices on a phone. The Dialog's scrim and focus
 * handling (Esc and a tap outside close it, focus returns to the trigger), a square panel with
 * the card edge and no shadow, as the other surfaces (docs/BRAND.md).
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  returnFocusTo,
  "data-testid": testId,
}: BottomSheetProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={contentRef}
          data-slot="bottom-sheet"
          data-testid={testId}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            const checked = contentRef.current?.querySelector<HTMLElement>(
              "[aria-checked=true]",
            );
            if (!checked) return;
            event.preventDefault();
            checked.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.current) return;
            event.preventDefault();
            returnFocusTo.current.focus();
          }}
          className={cn(
            "text-natural-50 bg-primary-600 fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col border border-b-0 border-primary-400 pb-6 shadow-none outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-200",
            className,
          )}
        >
          <div className="flex h-[64px] flex-none items-center justify-between pr-2 pl-4">
            <DialogPrimitive.Title className="text-lg text-natural-50">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              data-testid="bottom-sheet-close"
              className="flex h-[44px] w-[44px] cursor-pointer items-center justify-center bg-highlight/40 text-natural-50 outline-none focus-visible:ring-[2px] focus-visible:ring-focus in-data-[theme=light]:bg-highlight"
            >
              <FontAwesomeIcon icon={faXmark} className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
