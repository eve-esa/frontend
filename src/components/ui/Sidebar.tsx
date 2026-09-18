import type { CSSProperties, Ref } from "react";
import { cn } from "@/lib/utils";

type SidebarProps = {
  isOpen: boolean;
  isMobile: boolean;
  children: React.ReactNode;
  side?: "left" | "right";
  variant?: "default" | "icon-only";
  className?: string;
  ref?: Ref<HTMLDivElement>;
  id?: string;
  // A width set by the user (see useResizableSidebar); it overrides the
  // width classes below. Desktop only.
  style?: CSSProperties;
  // True while the edge is being dragged: the width must follow the pointer
  // without easing.
  isResizing?: boolean;
};

export const Sidebar = ({
  isOpen,
  isMobile,
  children,
  side = "left",
  variant = "default",
  className,
  ref,
  id,
  style,
  isResizing = false,
}: SidebarProps) => {
  // Positioning based on side
  const getPositionClasses = () => {
    return side === "left" ? "left-0" : "right-0";
  };

  // Mobile animations
  const getMobileTransformClasses = () => {
    if (!isOpen) {
      return side === "left" ? "-translate-x-full" : "translate-x-full";
    }
    return "translate-x-0";
  };

  // Desktop animations
  const getDesktopWidthClasses = () => {
    if (isOpen) {
      return "min-w-[290px] max-w-[310px] min-[1200px]:w-[310px] min-[1400px]:w-[340px] min-[1920px]:w-[400px] min-[2560px]:w-[480px] min-[3200px]:w-[600px]";
    }

    if (variant === "icon-only") return "w-[80px]";

    return "w-0";
  };

  // Width constraints
  const getWidthConstraintClasses = () => {
    if (isMobile) return "w-full";

    if (isOpen) {
      return "min-w-[290px] max-w-[310px] min-[1200px]:max-w-[310px] min-[1400px]:max-w-[340px] min-[1920px]:max-w-[400px] min-[2560px]:max-w-[480px] min-[3200px]:max-w-[600px]";
    }

    if (variant === "icon-only") return "min-w-[80px] max-w-[80px]";

    return "min-w-0 max-w-0";
  };

  // Base sidebar container classes
  const sidebarClasses = cn(
    // Base styles
    "transition-all duration-200 ease-in-out !bg-primary-900",
    getWidthConstraintClasses(),

    // Mobile
    isMobile && [
      "fixed top-0 h-full z-50",
      getPositionClasses(),
      getMobileTransformClasses(),
    ],

    // Desktop. The right one is positioned so a resize handle can sit on its
    // edge.
    !isMobile && [
      "h-full",
      side === "right" && "relative",
      getDesktopWidthClasses(),
    ],

    isResizing && "transition-none",

    className
  );

  return (
    <>
      {/* Sidebar Container */}
      <div
        ref={ref}
        id={id}
        className={sidebarClasses}
        style={isMobile ? undefined : style}
      >
        {children}
      </div>
    </>
  );
};
