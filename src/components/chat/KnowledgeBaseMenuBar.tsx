import { faBook } from "@fortawesome/free-solid-svg-icons";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/Menubar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useSidebar } from "./DynamicSidebarProvider";
import { Tooltip } from "../ui/Tooltip";
import { useTour } from "@/components/onboarding/TourContext";
import { cn } from "@/lib/utils";
import { PRIVATE_COLLECTIONS_ENABLED } from "@/utilities/features";

type KnowledgeBaseMenuBarProps = {
  isOpen: boolean;
  className?: string;
};

export const KnowledgeBaseMenuBar = ({
  isOpen,
  className,
}: KnowledgeBaseMenuBarProps) => {
  const { openDynamicSidebar, content, isOpenDynamicSidebar } = useSidebar();
  const { isRunning } = useTour();

  // Check if the dynamic sidebar is open with collections type
  const isCollectionsSidebarOpen =
    isOpenDynamicSidebar &&
    (content?.type === "shared-collections" ||
      content?.type === "my-collections");

  const triggerContent = (
    <MenubarTrigger
      className={`flex items-center gap-2 rounded-lg p-2 text-natural-50 cursor-pointer ${
        isCollectionsSidebarOpen
          ? "bg-primary-600/60 text-white"
          : "hover:bg-primary-400 hover:text-white"
      } ${className}`}
    >
      <FontAwesomeIcon icon={faBook} className="w-4 h-4" />

      {isOpen && (
        <span className="text-lg truncate line-height-[1.4rem] tracking-wider min-w-0 text-left">
          <span className="whitespace-nowrap mt-[2px] overflow-hidden text-ellipsis">
            Knowledge Base
          </span>
        </span>
      )}
    </MenubarTrigger>
  );

  return (
    <Menubar>
      {/* The dropdown is pinned open for the tour because five of its steps
          point inside it. With private collections off those steps are gone,
          and a menu left open would only overlap the steps that remain. */}
      <MenubarMenu
        {...(PRIVATE_COLLECTIONS_ENABLED && isRunning && { open: isRunning })}
      >
        {!isOpen ? (
          <Tooltip
            side="right"
            disableClick={true}
            content={<>Knowledge Base</>}
            className="max-w-[280px] md:max-w-[350px]"
          >
            <div className="inline-block">{triggerContent}</div>
          </Tooltip>
        ) : (
          triggerContent
        )}

        <MenubarContent side="bottom" className="flex flex-col gap-1 ">
          <MenubarItem
            onClick={() => openDynamicSidebar({ type: "shared-collections" })}
            className={
              content?.type === "shared-collections"
                ? "bg-primary-500 text-white"
                : ""
            }
          >
            <span>Shared collections</span>
          </MenubarItem>
          {/* The data-tour wrapper goes with the item: an anchor left behind
              with nothing in it is still a target the tour could point at. */}
          {PRIVATE_COLLECTIONS_ENABLED && (
            <div
              className="my-collections-button-tour"
              data-tour="my-collections-button"
            >
              <MenubarItem
                onClick={() => openDynamicSidebar({ type: "my-collections" })}
                data-tour="my-collections-button"
                className={cn(
                  "my-collections-button-tour ",
                  content?.type === "my-collections"
                    ? "bg-primary-500 text-white"
                    : ""
                )}
              >
                <span>My collections</span>
              </MenubarItem>
            </div>
          )}
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};
