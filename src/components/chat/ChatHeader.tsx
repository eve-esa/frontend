import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/Button";
import { useSidebar } from "./DynamicSidebarProvider";
import { useIsMobile } from "@/hooks/useIsMobile";

export const ChatHeader = () => {
  const isMobile = useIsMobile();
  const { toggleConversationsSidebar } = useSidebar();

  if (!isMobile) return null;

  return (
    <div className="flex items-center gap-3 w-ful p-2 md:p-6 lg:py-8">
      {isMobile && (
        <Button variant="icon" size="sm" onClick={toggleConversationsSidebar}>
          <FontAwesomeIcon icon={faBars} className="size-4 text-natural-50" />
        </Button>
      )}
    </div>
  );
};
