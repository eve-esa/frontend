import { Navigate, Outlet, useLocation } from "react-router-dom";
import { routes } from "@/utilities/routes.tsx";
import {
  LOCAL_STORAGE_ACCESS_TOKEN,
  LOCAL_STORAGE_TOUR_COMPLETED,
} from "@/utilities/localStorage";
import { useIsMobile } from "@/hooks/useIsMobile";

export const PrivateRoute = () => {
  const accessToken = localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN);
  const location = useLocation();
  const isMobile = useIsMobile();

  if (
    !localStorage.getItem(LOCAL_STORAGE_TOUR_COMPLETED) &&
    location.pathname !== routes.ONBOARDING.path &&
    !isMobile
  ) {
    return <Navigate to={routes.ONBOARDING.path} />;
  }

  return accessToken ? <Outlet /> : <Navigate to={routes.LOGIN.path} />;
};
