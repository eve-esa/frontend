import { Button } from "@/components/ui/Button";
import { useNavigate } from "react-router-dom";
import { routes } from "@/utilities/routes";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { LOCAL_STORAGE_ACCESS_TOKEN } from "@/utilities/localStorage";

export const NotFound = () => {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN);

  return (
    <div className="flex h-screen gap-4 w-screen flex-col items-center justify-center bg-gradient-to-b from-primary-500 to-primary-600">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-xl">Page not found</p>
      <Button
        variant="outline"
        onClick={() =>
          navigate(accessToken ? routes.EMPTY_CHAT.path : routes.LOGIN.path)
        }
        className="flex items-center gap-2"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
        {accessToken ? "Go to Chat" : "Go to Login"}
      </Button>
    </div>
  );
};

NotFound.displayName = "NotFound";
