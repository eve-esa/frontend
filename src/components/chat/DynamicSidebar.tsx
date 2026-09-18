import { Sidebar } from "@/components/ui/Sidebar";
import { SidebarResizeHandle } from "@/components/ui/SidebarResizeHandle";
import { useResizableSidebar } from "@/hooks/useResizableSidebar";
import { useSidebar } from "./DynamicSidebarProvider";
import { useEffect, useRef, useState } from "react";

const DYNAMIC_SIDEBAR_ID = "dynamic-sidebar";

export const DynamicSidebar = () => {
  const { isOpenDynamicSidebar, isMobile, renderSidebarContent } = useSidebar();
  const [shouldRenderContent, setShouldRenderContent] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  // Docked only: on mobile the sidebar is a full-width overlay.
  const isResizable = isOpenDynamicSidebar && !isMobile;
  const { isResizing, style, handleProps } = useResizableSidebar({
    enabled: isResizable,
    sidebarRef,
  });

  useEffect(() => {
    if (isOpenDynamicSidebar) {
      const timer = setTimeout(() => {
        setShouldRenderContent(true);
      }, 200);

      return () => clearTimeout(timer);
    } else {
      setShouldRenderContent(false);
    }
  }, [isOpenDynamicSidebar]);

  return (
    <Sidebar
      ref={sidebarRef}
      id={DYNAMIC_SIDEBAR_ID}
      isOpen={isOpenDynamicSidebar}
      isMobile={isMobile}
      side="right"
      variant="default"
      style={style}
      isResizing={isResizing}
      className={`${
        isOpenDynamicSidebar
          ? "border-l-2 border-primary-400 control-panel-tour my-collections-sidebar-tour my-collections-documents-tour"
          : ""
      }`}
    >
      {isResizable && (
        <SidebarResizeHandle
          aria-controls={DYNAMIC_SIDEBAR_ID}
          isResizing={isResizing}
          {...handleProps}
        />
      )}
      {shouldRenderContent && renderSidebarContent()}
    </Sidebar>
  );
};
