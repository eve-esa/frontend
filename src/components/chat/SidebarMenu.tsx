import { LogoutDialog } from "@/components/auth/LogoutDialog";
import { useState } from "react";
import { ProfileMenubar } from "./ProfileMenubar";
import { ProfileDialog } from "@/components/profile/ProfileDialog";
import { CO2eqDialog } from "@/components/profile/CO2eqDialog";
import { useGetProfile } from "@/services/useMe";
import { KnowledgeBaseMenuBar } from "./KnowledgeBaseMenuBar";

type SidebarMenuProps = {
  isOpen: boolean;
};

export const SidebarMenu = ({ isOpen }: SidebarMenuProps) => {
  const [isOpenLogoutDialog, setIsOpenLogoutDialog] = useState(false);
  const [isOpenProfileDialog, setIsOpenProfileDialog] = useState(false);
  const [isOpenCO2eqDialog, setIsOpenCO2eqDialog] = useState(false);

  const { data: profile, isLoading: isLoadingProfile } = useGetProfile();

  const email = profile?.email;

  const baseStyles =
    "grid items-center gap-2 rounded-lg hover:bg-primary-500 p-2 w-full cursor-pointer";

  const layoutStyles = isOpen
    ? "grid-cols-[auto_1fr]"
    : "grid-cols-1 justify-items-center";

  return (
    <div className="flex flex-col gap-4">
      <KnowledgeBaseMenuBar
        isOpen={isOpen}
        className={`${baseStyles} ${layoutStyles} text-natural-50 hover:text-white`}
      />

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
    </div>
  );
};
