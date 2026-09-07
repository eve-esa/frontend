import { useState } from "react";
import { useAuth } from "react-oidc-context";
import logo from "@/assets/images/esa_phi_lab_1.svg";
import { Button } from "@/components/ui/Button";
import { LogoutDialog } from "@/components/auth/LogoutDialog";

/**
 * Shown instead of the chat tree once the backend answers every authenticated
 * call, including /users/me, with a 403 pending_approval. Wording agreed with
 * the product owner: high demand, on hold, we will email you. The user is real
 * and signed in at the identity provider, just not approved yet, so this is
 * not a sign-in failure: it only offers to log out and wait.
 */
export const PendingApprovalPage = () => {
  const auth = useAuth();
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const email = auth.user?.profile?.email;

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary-500 to-primary-600 px-4">
      <img src={logo} alt="logo" className="h-[48px]" />
      <div className="flex max-w-[480px] flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-bold">
          Access to EVE is on hold for now
        </h1>
        <p className="text-sm text-natural-300">
          Apologies, due to high demand we cannot give you access to EVE at
          this time. {email ? `Your account ${email} is` : "Your account is"}{" "}
          registered and on hold. We will email you as soon as you can start.
        </p>
      </div>
      <Button variant="outline" size="md" onClick={() => setIsLogoutOpen(true)}>
        Logout
      </Button>
      <LogoutDialog isOpen={isLogoutOpen} onOpenChange={setIsLogoutOpen} />
    </div>
  );
};

PendingApprovalPage.displayName = "PendingApprovalPage";
