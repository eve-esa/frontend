import { Button } from "@/components/ui/Button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { routes } from "@/utilities/routes";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

export const NotFound = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  return (
    <div className="flex h-screen gap-4 w-screen flex-col items-center justify-center bg-gradient-to-b from-primary-500 to-primary-600">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-xl">Page not found</p>
      <Button
        variant="outline"
        onClick={() =>
          auth.isAuthenticated
            ? navigate(routes.EMPTY_CHAT.path)
            : void auth.signinRedirect()
        }
        className="flex items-center gap-2"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
        {auth.isAuthenticated ? "Go to Chat" : "Sign in"}
      </Button>
    </div>
  );
};

NotFound.displayName = "NotFound";
