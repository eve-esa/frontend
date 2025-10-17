import { faUser } from "@fortawesome/free-regular-svg-icons";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/Menubar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "../ui/Tooltip";

type ProfileMenubarProps = {
  email?: string;
  className?: string;
  isOpen: boolean;
  onProfileClick: () => void;
  onCO2eqClick: () => void;
  onLogoutClick: () => void;
  isLoadingProfile: boolean;
};

export const ProfileMenubar = ({
  email,
  className = "",
  isOpen,
  onProfileClick,
  onCO2eqClick,
  onLogoutClick,
  isLoadingProfile,
}: ProfileMenubarProps) => {
  const onContactClick = () => {
    window.open(import.meta.env.VITE_CONTACT_URL, "_blank");
  };

  const onPrivacyPolicyClick = () => {
    window.open(import.meta.env.VITE_PRIVACY_POLICY_URL, "_blank");
  };

  const onAboutUsClick = () => {
    window.open(import.meta.env.VITE_ABOUT_US_URL, "_blank");
  };

  const triggerContent = (
    <MenubarTrigger
      className={`flex items-center gap-2 rounded-lg hover:bg-primary-400 p-2 text-natural-50 hover:text-white cursor-pointer ${className}`}
    >
      <FontAwesomeIcon
        icon={faUser}
        className="w-4 h-4 flex items-center justify-center shrink-0"
      />

      {isOpen && (
        <span className="text-lg truncate line-height-[1.4rem] tracking-wider min-w-0 text-left">
          {isLoadingProfile ? (
            <Skeleton className="h-[20px]  w-full" />
          ) : (
            <span className="whitespace-nowrap mt-[2px] overflow-hidden text-ellipsis">
              {email}
            </span>
          )}
        </span>
      )}
    </MenubarTrigger>
  );

  return (
    <Menubar>
      <MenubarMenu>
        {!isOpen ? (
          <Tooltip
            side="right"
            disableClick={true}
            content={<>{email}</>}
            className="max-w-[280px] md:max-w-[350px]"
          >
            <div className="inline-block">{triggerContent}</div>
          </Tooltip>
        ) : (
          triggerContent
        )}
        <MenubarContent side="bottom">
          <MenubarItem onClick={onProfileClick}>
            <span>Profile</span>
          </MenubarItem>
          <MenubarItem onClick={onCO2eqClick}>
            <span>CO2eq</span>
          </MenubarItem>
          <MenubarItem onClick={onAboutUsClick}>
            <span>About Us</span>
          </MenubarItem>
          <MenubarItem onClick={onContactClick}>
            <span>Contact Us</span>
          </MenubarItem>
          <MenubarItem onClick={onPrivacyPolicyClick}>
            <span>Privacy Policy</span>
          </MenubarItem>
          <MenubarItem onClick={onLogoutClick}>
            <span className="text-danger-300">Logout</span>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};
