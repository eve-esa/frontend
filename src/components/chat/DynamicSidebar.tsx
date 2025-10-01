import { Sidebar } from "@/components/ui/Sidebar";
import { useSidebar } from "./DynamicSidebarProvider";
import { useEffect, useState } from "react";

export const DynamicSidebar = () => {
  const { isOpenDynamicSidebar, isMobile, renderSidebarContent } = useSidebar();
  const [shouldRenderContent, setShouldRenderContent] = useState(false);

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
      isOpen={isOpenDynamicSidebar}
      isMobile={isMobile}
      side="right"
      variant="default"
      className={`${
        isOpenDynamicSidebar
          ? "border-l-2 border-primary-400 control-panel-tour my-collections-sidebar-tour my-collections-documents-tour"
          : ""
      }`}
    >
      {shouldRenderContent && renderSidebarContent()}
    </Sidebar>
  );
};
