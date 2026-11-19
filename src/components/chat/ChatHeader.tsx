import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useSidebar } from "./DynamicSidebarProvider";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MOBILE_COMPOSER_ENABLED } from "@/utilities/features";
import { routes } from "@/utilities/routes";
import { ModelField } from "./ModelField";

export const ChatHeader = () => {
  const isMobile = useIsMobile();
  const { toggleConversationsSidebar } = useSidebar();
  const navigate = useNavigate();

  if (!isMobile) return null;

  if (MOBILE_COMPOSER_ENABLED) {
    // Hamburger left, the model field centred, New chat right: a 48 / 1fr / 48 grid, so the field
    // has equal space on both sides. The field and New chat are phone only (below md); from md up
    // the header holds the hamburger alone, as before.
    return (
      <div className="grid h-[60px] grid-cols-[48px_1fr_48px] items-center p-2 md:flex md:h-auto md:gap-3 md:p-6 lg:py-8">
        <Button
          variant="icon"
          size="sm"
          onClick={toggleConversationsSidebar}
          aria-label="Open sidebar"
          data-testid="chat-header-menu"
          className="h-[44px] w-[48px] p-0 md:h-auto md:w-auto md:p-2"
        >
          <FontAwesomeIcon icon={faBars} className="size-4 text-natural-50" />
        </Button>
        <ModelField className="md:hidden" />
        <Button
          variant="icon"
          size="sm"
          onClick={() => navigate(routes.EMPTY_CHAT.path)}
          aria-label="New chat"
          data-testid="header-new-chat"
          className="h-[44px] w-[48px] p-0 md:hidden"
        >
          <FontAwesomeIcon icon={faPlus} className="size-4 text-natural-50" />
        </Button>
      </div>
    );
  }

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
