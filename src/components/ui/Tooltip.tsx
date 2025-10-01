import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  delayDuration?: number;
  disableClick?: boolean;
  disableTooltip?: boolean;
}

function Tooltip({
  children,
  content,
  className,
  side = "top",
  delayDuration = 0,
  disableClick = false,
  disableTooltip = false,
}: TooltipProps) {
  const [isForcedOpen, setIsForcedOpen] = React.useState(false);

  const handleClick = () => {
    if (!disableClick) {
      setIsForcedOpen(true);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!disableClick) {
      e.preventDefault();
    }
  };

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root
        open={disableTooltip ? false : isForcedOpen || undefined}
      >
        <TooltipPrimitive.Trigger
          asChild
          onClick={handleClick}
          onPointerDown={handlePointerDown}
        >
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={14}
            onPointerDownOutside={() => setIsForcedOpen(false)}
            className={cn(
              "relative font-['NotesESA'] text-sm 3xl:text-2xl mx-6 bg-natural-900 text-natural-50 border border-primary-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 !z-[50] w-fit origin-[--radix-tooltip-content-transform-origin] rounded-md px-3 py-1.5",
              className
            )}
          >
            <TooltipPrimitive.Arrow className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-primary-50 border-solid z-40" />
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

export { Tooltip, TooltipTrigger };
