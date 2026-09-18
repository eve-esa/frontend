import { LogoutDialog } from "@/components/auth/LogoutDialog";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImages, faKey } from "@fortawesome/free-solid-svg-icons";
import { ProfileMenubar } from "./ProfileMenubar";
import { ProfileDialog } from "@/components/profile/ProfileDialog";
import { CO2eqDialog } from "@/components/profile/CO2eqDialog";
import { useGetProfile } from "@/services/useMe";
import { KnowledgeBaseMenuBar } from "./KnowledgeBaseMenuBar";
import { ToolkitsMenuBar } from "./ToolkitsMenuBar";
import { Tooltip } from "@/components/ui/Tooltip";
import { routes } from "@/utilities/routes";
import {
  API_KEYS_ENABLED,
  ARTIFACTS_ENABLED,
  TOOLKITS_ENABLED,
} from "@/utilities/features";
import { ApiKeysDialog } from "@/components/api-keys/ApiKeysDialog";

type SidebarMenuProps = {
  isOpen: boolean;
};

export const SidebarMenu = ({ isOpen }: SidebarMenuProps) => {
  const [isOpenLogoutDialog, setIsOpenLogoutDialog] = useState(false);
  const [isOpenProfileDialog, setIsOpenProfileDialog] = useState(false);
  const [isOpenCO2eqDialog, setIsOpenCO2eqDialog] = useState(false);
  const [isOpenApiKeysDialog, setIsOpenApiKeysDialog] = useState(false);
  const apiKeysButtonRef = useRef<HTMLButtonElement>(null);

  const { data: profile, isLoading: isLoadingProfile } = useGetProfile();
  const navigate = useNavigate();

  const email = profile?.email;

  const baseStyles =
    "grid items-center gap-2 rounded-lg hover:bg-primary-500 p-2 w-full cursor-pointer";

  const layoutStyles = isOpen
    ? "grid-cols-[auto_1fr]"
    : "grid-cols-1 justify-items-center";

  const artifactsItem = (
    <button
      type="button"
      onClick={() => navigate(routes.ARTIFACTS.path)}
      className={`${baseStyles} ${layoutStyles} text-natural-50 hover:text-white`}
    >
      <FontAwesomeIcon icon={faImages} className="w-4 h-4" />
      {isOpen && (
        <span className="text-lg truncate tracking-wider min-w-0 text-left">
          <span className="whitespace-nowrap mt-[2px] overflow-hidden text-ellipsis">
            Artifacts
          </span>
        </span>
      )}
    </button>
  );

  const apiKeysItem = (
    <button
      ref={apiKeysButtonRef}
      type="button"
      data-testid="sidebar-api-keys"
      aria-label="API keys"
      aria-haspopup="dialog"
      onClick={() => setIsOpenApiKeysDialog(true)}
      className={`${baseStyles} ${layoutStyles} text-natural-50 hover:text-white`}
    >
      <FontAwesomeIcon icon={faKey} className="w-4 h-4" />
      {isOpen && (
        <span className="text-lg truncate tracking-wider min-w-0 text-left">
          <span className="whitespace-nowrap mt-[2px] overflow-hidden text-ellipsis">
            API keys
          </span>
        </span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <KnowledgeBaseMenuBar
        isOpen={isOpen}
        className={`${baseStyles} ${layoutStyles} text-natural-50 hover:text-white`}
      />

      {/* Not rendered at all when off, so the entry point disappears together
          with the GET /mcp-servers its catalog check would fire. */}
      {TOOLKITS_ENABLED && (
        <ToolkitsMenuBar
          isOpen={isOpen}
          className={`${baseStyles} ${layoutStyles} text-natural-50 hover:text-white`}
        />
      )}

      {ARTIFACTS_ENABLED &&
        (isOpen ? (
          artifactsItem
        ) : (
          <Tooltip side="right" disableClick={true} content={<>Artifacts</>}>
            <div className="inline-block w-full">{artifactsItem}</div>
          </Tooltip>
        ))}

      {API_KEYS_ENABLED &&
        (isOpen ? (
          apiKeysItem
        ) : (
          <Tooltip side="right" disableClick={true} content={<>API keys</>}>
            <div className="inline-block w-full">{apiKeysItem}</div>
          </Tooltip>
        ))}

      <ProfileMenubar
        isLoadingProfile={isLoadingProfile}
        email={email}
        onProfileClick={() => setIsOpenProfileDialog(true)}
        onCO2eqClick={() => setIsOpenCO2eqDialog(true)}
        onLogoutClick={() => setIsOpenLogoutDialog(true)}
        className={`${baseStyles} ${layoutStyles} text-natural-50 hover:text-white`}
        isOpen={isOpen}
      />

      <LogoutDialog
        isOpen={isOpenLogoutDialog}
        onOpenChange={setIsOpenLogoutDialog}
      />

      <ProfileDialog
        isOpen={isOpenProfileDialog}
        onOpenChange={setIsOpenProfileDialog}
      />

      <CO2eqDialog
        isOpen={isOpenCO2eqDialog}
        onOpenChange={setIsOpenCO2eqDialog}
      />

      {API_KEYS_ENABLED && (
        <ApiKeysDialog
          isOpen={isOpenApiKeysDialog}
          onOpenChange={setIsOpenApiKeysDialog}
          returnFocusRef={apiKeysButtonRef}
        />
      )}
    </div>
  );
};
