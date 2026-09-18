import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type SidebarResizeHandleProps = ComponentProps<"div"> & {
  isResizing: boolean;
};

/**
 * The drag edge of a right-anchored sidebar: a focusable vertical separator
 * straddling its left border. The hit area is wider than the line it shows,
 * and the line only appears on hover, focus and while dragging. Behaviour
 * comes from useResizableSidebar.
 */
export const SidebarResizeHandle = ({
  isResizing,
  className,
  ...props
}: SidebarResizeHandleProps) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize sidebar"
    title="Drag to resize, double-click to reset"
    tabIndex={0}
    data-testid="sidebar-resize-handle"
    className={cn(
      "group absolute inset-y-0 -left-1 z-20 w-2.5 cursor-col-resize touch-none outline-none",
      className,
    )}
    {...props}
  >
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 left-1 w-0.5 bg-primary-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:bg-natural-200 group-focus-visible:opacity-100",
        isResizing && "bg-natural-200 opacity-100",
      )}
    />
  </div>
);
