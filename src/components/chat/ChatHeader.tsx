import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useSidebar } from "./DynamicSidebarProvider";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useIsPhone } from "@/hooks/useIsPhone";
import { MOBILE_COMPOSER_ENABLED } from "@/utilities/features";
import { routes } from "@/utilities/routes";
import { ModelField } from "./ModelField";

/**
 * Below md with FEATURE_MOBILE_COMPOSER: hamburger left, the model field centred, New chat right.
 * A 48 / 1fr / 48 grid gives the field the same space on both sides.
 */
const PhoneHeader = ({ onOpenSidebar }: { onOpenSidebar: () => void }) => {
  const navigate = useNavigate();
  return (
    <div className="grid h-[60px] grid-cols-[48px_1fr_48px] items-center p-2">
      <Button
        variant="icon"
        size="sm"
        onClick={onOpenSidebar}
        aria-label="Open sidebar"
        data-testid="chat-header-menu"
        className="h-[44px] w-[48px] p-0"
      >
        <FontAwesomeIcon icon={faBars} className="size-4 text-natural-50" />
      </Button>
      <ModelField />
      <Button
        variant="icon"
        size="sm"
        // The sidebar's New chat: its icon and its handler (open the empty chat).
        onClick={() => navigate(routes.EMPTY_CHAT.path)}
        aria-label="New chat"
        data-testid="header-new-chat"
        className="h-[44px] w-[48px] p-0"
      >
        <FontAwesomeIcon icon={faPlus} className="size-4 text-natural-50" />
      </Button>
    </div>
  );
};

export const ChatHeader = () => {
  const isMobile = useIsMobile();
  const isPhone = useIsPhone();
  const { toggleConversationsSidebar } = useSidebar();

  if (!isMobile) return null;

  // From md up, and with the flag off, the header is the one on main.
  if (MOBILE_COMPOSER_ENABLED && isPhone) {
    return <PhoneHeader onOpenSidebar={toggleConversationsSidebar} />;
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
