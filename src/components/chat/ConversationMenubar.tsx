import { faTrashCan } from "@fortawesome/free-regular-svg-icons";
import {
  faEllipsisVertical,
  faPencil,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { SingleConversation } from "@/services/useGetConversationsList";
import { cn } from "@/lib/utils";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/Menubar";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ConversationMenubarProps {
  conversation: SingleConversation;
  isRenameActive: boolean;
  onRename: (conversation: SingleConversation) => void;
  onDelete: (conversation: SingleConversation) => void;
}

export const ConversationMenubar: React.FC<ConversationMenubarProps> = ({
  conversation,
  isRenameActive,
  onRename,
  onDelete,
}) => {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 transition-all duration-200 ease-in-out",
        isRenameActive
          ? "w-0"
          : `w-0 ${
              isMobile ? "w-auto" : "group-hover:w-auto"
            } [&:has([data-state=open])]:w-full`
      )}
    >
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger className="cursor-pointer ">
            <FontAwesomeIcon
              icon={faEllipsisVertical}
              onClick={(e) => {
                e.stopPropagation();
              }}
              className={cn(
                "size-4 transition-colors duration-200 ease-in-out text-natural-50 cursor-pointer",
                isRenameActive
                  ? "opacity-0"
                  : `${
                      isMobile ? "opacity-100" : "opacity-0"
                    } group-hover:opacity-100 [.group:has([data-state=open])_&]:opacity-100`
              )}
            />
          </MenubarTrigger>
          <MenubarContent side={isMobile ? "right" : "bottom"}>
            <MenubarItem
              onClick={(e) => {
                e.stopPropagation();
                onRename(conversation);
              }}
            >
              <FontAwesomeIcon icon={faPencil} />
              Rename
            </MenubarItem>
            <MenubarItem
              className="text-danger-300"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conversation);
              }}
            >
              <FontAwesomeIcon icon={faTrashCan} />
              Delete
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
};
