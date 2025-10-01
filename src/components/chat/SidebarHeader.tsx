import logo from "@/assets/images/esa_phi_lab_1.svg";
import smallLogo from "@/assets/images/ESA_logo_2020_White_small.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/Button";
import { faClose, faPlus } from "@fortawesome/free-solid-svg-icons";
import sidebar from "@/assets/images/sidebar.svg";
import { Tooltip, TooltipTrigger } from "@/components/ui/Tooltip";
import { Badge } from "./Badge";

type SidebarHeaderProps = {
  isOpen: boolean;
  isMobile: boolean;
  onToggle: () => void;
  handleNewChat: () => void;
};

export const SidebarHeader = ({
  isOpen,
  isMobile,
  onToggle,
  handleNewChat,
}: SidebarHeaderProps) => {
  return (
    <div className="flex flex-col gap-8 px-4">
      {!isOpen && (
        <div className="flex justify-center">
          <div
            className="cursor-pointer flex justify-center group"
            onClick={onToggle}
          >
            <div className="relative">
              <img
                src={smallLogo}
                alt="logo"
                className="h-[32px] 3xl:h-[70px] group-hover:hidden"
              />
              <div className="group-hover:hidden absolute  bottom-[-19px] right-0  3xl:right-[-16px]">
                <Badge />
              </div>
            </div>

            <Tooltip
              side="right"
              content={<>Open sidebar</>}
              className="max-w-[280px] md:max-w-[350px]"
            >
              <img
                src={sidebar}
                alt="sidebar"
                className="h-[32px] hidden group-hover:block cursor-e-resize"
              />
            </Tooltip>
          </div>
        </div>
      )}
      {isOpen && (
        <div className="flex justify-between items-center gap-2 w-full">
          <div className="relative">
            <img src={logo} alt="logo" className="h-[48px] 3xl:h-[70px]" />
            <div className="absolute bottom-[-4px] left-[20px] 3xl:left-[30px] 3xl:bottom-[-10px]">
              <Badge />
            </div>
          </div>

          <div
            className="cursor-pointer flex justify-center"
            onClick={onToggle}
          >
            {isMobile ? (
              <FontAwesomeIcon icon={faClose} className="w-4 h-4" />
            ) : (
              <Tooltip
                side="right"
                content={<>Close sidebar</>}
                className="max-w-[280px] md:max-w-[350px]"
              >
                <img
                  src={sidebar}
                  alt="sidebar"
                  className="h-[32px] cursor-w-resize"
                />
              </Tooltip>
            )}
          </div>
        </div>
      )}

      <div
        className={`flex items-center justify-between px-2 ${
          isOpen ? "flex-row" : "flex-col gap-4"
        }`}
      >
        {isOpen ? (
          <Button
            className="w-full new-chat-button-tour"
            variant="outline"
            size="md"
            onClick={handleNewChat}
            data-tour="new-chat-button"
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
            <span className="whitespace-nowrap mt-[2px] overflow-hidden text-ellipsis font-['NotesESA']">
              NEW CHAT
            </span>
          </Button>
        ) : (
          <Tooltip
            side="right"
            disableClick={!isMobile}
            content={
              <span className="whitespace-nowrap mt-[2px] overflow-hidden text-ellipsis font-['NotesESA']">
                New chat
              </span>
            }
          >
            <TooltipTrigger asChild>
              <Button
                className="w-full"
                variant="outline"
                size="sm"
                onClick={handleNewChat}
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
