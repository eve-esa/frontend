import { useAuth } from "react-oidc-context";
import { useLocation } from "react-router-dom";
import logo from "@/assets/images/esa_phi_lab_1.svg";
import { Button } from "@/components/ui/Button";
import { clearSignedOutElsewhere } from "@/services/oidc";

/**
 * Shown instead of the chat tree once another tab signed out. Signing in
 * again is the user's choice: an automatic redirect from here would race the
 * other tab's sign-out at the identity provider.
 */
export const SignedOutPage = () => {
  const auth = useAuth();
  const location = useLocation();

  const signIn = () => {
    clearSignedOutElsewhere();
    void auth.signinRedirect({
      state: { returnTo: location.pathname + location.search },
    });
  };

  return (
    <div
      data-testid="signed-out-page"
      className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary-500 to-primary-600 px-4"
    >
      <img src={logo} alt="logo" className="h-[48px]" />
      <div className="flex max-w-[480px] flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-bold">You are signed out</h1>
        <p className="text-sm text-natural-200">
          You signed out of EVE in another tab or window.
        </p>
      </div>
      <Button
        data-testid="signed-out-sign-in"
        variant="outline"
        size="md"
        onClick={signIn}
      >
        Sign in
      </Button>
    </div>
  );
};

SignedOutPage.displayName = "SignedOutPage";
