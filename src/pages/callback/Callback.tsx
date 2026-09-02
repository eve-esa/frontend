import { useAuth } from "react-oidc-context";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Landing page for the OIDC redirect. The code/state exchange itself is done
 * by react-oidc-context (which tolerates React.StrictMode's double mount);
 * this component only shows progress and, on failure, a way back in.
 */
export const Callback = () => {
  const auth = useAuth();

  if (auth.error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary-500 to-primary-600">
        <p className="text-xl">Sign-in failed</p>
        <p className="text-sm text-natural-300">{auth.error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary-500 to-primary-600">
      <Spinner size="md" />
      <p className="text-xl">Signing you in...</p>
    </div>
  );
};

Callback.displayName = "Callback";
