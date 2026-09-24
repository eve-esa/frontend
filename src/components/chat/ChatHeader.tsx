import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/Button";
import { useSidebar } from "./DynamicSidebarProvider";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

type ChatHeaderProps = {
  /** Actions of the current page, right aligned (the conversation ones). */
  actions?: ReactNode;
};

export const ChatHeader = ({ actions }: ChatHeaderProps = {}) => {
  const isMobile = useIsMobile();
  const { toggleConversationsSidebar } = useSidebar();

  if (!isMobile && !actions) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 w-full p-2",
        actions ? "md:px-6 md:py-3" : "md:p-6 lg:py-8",
      )}
    >
      {isMobile && (
        <Button variant="icon" size="sm" onClick={toggleConversationsSidebar}>
          <FontAwesomeIcon icon={faBars} className="size-4 text-natural-50" />
        </Button>
      )}
      {actions && (
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      )}
    </div>
  );
};
