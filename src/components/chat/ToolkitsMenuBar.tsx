import { faScrewdriverWrench } from "@fortawesome/free-solid-svg-icons";
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
import { useGetMcpServers } from "@/services/useGetMcpServers";
import { enabledToolkits, shouldShowToolkitsEntry } from "@/utilities/toolkits";

type ToolkitsMenuBarProps = {
  isOpen: boolean;
  className?: string;
};

export const ToolkitsMenuBar = ({
  isOpen,
  className,
}: ToolkitsMenuBarProps) => {
  const { openDynamicSidebar, content, isOpenDynamicSidebar } = useSidebar();
  const { isRunning } = useTour();
  const { data, isPending, isError } = useGetMcpServers();

  const isToolkitsSidebarOpen =
    isOpenDynamicSidebar && content?.type === "toolkits";

  // The catalog is per environment, so whether this entry belongs in the sidebar
  // is a runtime question, not a build-time one: the release artifact is promoted
  // unchanged from dev to production. See utilities/toolkits for why a failed
  // request still shows the entry.
  if (
    !shouldShowToolkitsEntry({
      isPending,
      isError,
      enabledCount: enabledToolkits(data?.pages).length,
    })
  ) {
    return null;
  }

  const triggerContent = (
    <MenubarTrigger
      className={`flex items-center gap-2 rounded-lg p-2 text-natural-50 cursor-pointer ${
        isToolkitsSidebarOpen
          ? "bg-primary-600/60 text-white"
          : "hover:bg-primary-400 hover:text-white"
      } ${className}`}
    >
      <FontAwesomeIcon icon={faScrewdriverWrench} className="w-4 h-4" />

      {isOpen && (
        <span className="text-lg truncate line-height-[1.4rem] tracking-wider min-w-0 text-left">
          <span className="whitespace-nowrap mt-[2px] overflow-hidden text-ellipsis">
            Toolkits
          </span>
        </span>
      )}
    </MenubarTrigger>
  );

  return (
    <Menubar>
      <MenubarMenu {...(isRunning && { open: isRunning })}>
        {!isOpen ? (
          <Tooltip
            side="right"
            disableClick={true}
            content={<>Toolkits</>}
            className="max-w-[280px] md:max-w-[350px]"
          >
            <div className="inline-block">{triggerContent}</div>
          </Tooltip>
        ) : (
          triggerContent
        )}

        <MenubarContent side="bottom" className="flex flex-col gap-1">
          <MenubarItem
            onClick={() => openDynamicSidebar({ type: "toolkits" })}
            className={cn(
              content?.type === "toolkits" && "bg-primary-500 text-white"
            )}
          >
            <span>Shared toolkits</span>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};
