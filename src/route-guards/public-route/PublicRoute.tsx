import { Navigate, Outlet } from "react-router-dom";
import { routes } from "@/utilities/routes.tsx";
import { LOCAL_STORAGE_ACCESS_TOKEN } from "@/utilities/localStorage";

export const PublicRoute = () => {
  const accessToken = localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN);

  return accessToken ? <Navigate to={routes.EMPTY_CHAT.path} /> : <Outlet />;
};
