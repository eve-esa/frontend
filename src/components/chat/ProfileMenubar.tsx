import { faUser } from "@fortawesome/free-regular-svg-icons";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/Menubar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "../ui/Tooltip";
import { configValue, type ConfigKey } from "@/utilities/runtimeConfig";
import { useTheme } from "@/hooks/useTheme";
import { parseThemeChoice, type ThemeChoice } from "@/utilities/theme";
import {
  SETTINGS_PAGE_ENABLED,
  SETTINGS_USAGE_ENABLED,
} from "@/utilities/features";

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type ProfileMenubarProps = {
  email?: string;
  className?: string;
  isOpen: boolean;
  onProfileClick: () => void;
  /** Opens the Settings page; used with FEATURE_SETTINGS_PAGE on. */
  onSettingsClick?: () => void;
  onCO2eqClick: () => void;
  onLogoutClick: () => void;
  isLoadingProfile: boolean;
};

export const ProfileMenubar = ({
  email,
  className = "",
  isOpen,
  onProfileClick,
  onSettingsClick,
  onCO2eqClick,
  onLogoutClick,
  isLoadingProfile,
}: ProfileMenubarProps) => {
  const theme = useTheme();

  // FEATURE_SETTINGS_PAGE on: Settings replaces Profile and the Theme group, and CO2eq moves to
  // the Usage section when FEATURE_SETTINGS_USAGE is on. Off, the menu is the one it always was.
  const showProfile = !SETTINGS_PAGE_ENABLED;
  const showCO2eq = !SETTINGS_PAGE_ENABLED || !SETTINGS_USAGE_ENABLED;
  const showTheme = !SETTINGS_PAGE_ENABLED && theme.enabled;

  // openLink rather than window.open directly: an unconfigured URL used to open
  // about:blank, which looks like a broken app rather than a missing setting.
  const openLink = (key: ConfigKey) => () => {
    const url = configValue(key);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const onContactClick = openLink("CONTACT_URL");
  const onPrivacyPolicyClick = openLink("PRIVACY_POLICY_URL");
  const onAboutUsClick = openLink("ABOUT_US_URL");

  const triggerContent = (
    <MenubarTrigger
      data-testid="user-menu"
      className={`flex items-center gap-2 rounded-lg hover:bg-highlight p-2 text-natural-50 cursor-pointer ${className}`}
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
            <span
              data-testid="user-menu-email"
              className="whitespace-nowrap mt-[2px] overflow-hidden text-ellipsis text-md"
            >
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
          {SETTINGS_PAGE_ENABLED && (
            <MenubarItem
              data-testid="user-menu-settings"
              onClick={onSettingsClick}
            >
              <span>Settings</span>
            </MenubarItem>
          )}
          {showProfile && (
            <MenubarItem
              data-testid="user-menu-profile"
              onClick={onProfileClick}
            >
              <span>Profile</span>
            </MenubarItem>
          )}
          {showCO2eq && (
            <MenubarItem onClick={onCO2eqClick}>
              <span>CO2eq</span>
            </MenubarItem>
          )}
          <MenubarItem data-testid="user-menu-about" onClick={onAboutUsClick}>
            <span>{SETTINGS_PAGE_ENABLED ? "About us" : "About Us"}</span>
          </MenubarItem>
          <MenubarItem data-testid="user-menu-contact" onClick={onContactClick}>
            <span>{SETTINGS_PAGE_ENABLED ? "Contact us" : "Contact Us"}</span>
          </MenubarItem>
          <MenubarItem data-testid="user-menu-privacy" onClick={onPrivacyPolicyClick}>
            <span>
              {SETTINGS_PAGE_ENABLED ? "Privacy policy" : "Privacy Policy"}
            </span>
          </MenubarItem>
          {showTheme && (
            <>
              <MenubarSeparator />
              <MenubarLabel>Theme</MenubarLabel>
              <MenubarRadioGroup
                aria-label="Theme"
                data-testid="theme-options"
                value={theme.choice}
                onValueChange={(value) =>
                  theme.setChoice(parseThemeChoice(value))
                }
              >
                {THEME_OPTIONS.map((option) => (
                  <MenubarRadioItem
                    key={option.value}
                    value={option.value}
                    data-testid={`theme-option-${option.value}`}
                  >
                    {option.label}
                  </MenubarRadioItem>
                ))}
              </MenubarRadioGroup>
              <MenubarSeparator />
            </>
          )}
          <MenubarItem data-testid="user-menu-logout" onClick={onLogoutClick}>
            <span className="text-danger-300">
              {SETTINGS_PAGE_ENABLED ? "Log out" : "Logout"}
            </span>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};
