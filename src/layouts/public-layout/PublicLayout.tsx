import { LOCAL_STORAGE_ACCESS_TOKEN } from "@/utilities/localStorage";
import { routes } from "@/utilities/routes";
import { Navigate, Outlet } from "react-router-dom";

export const PublicLayout = () => {
  const isAuth = localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN);

  if (isAuth) {
    return <Navigate to={routes.EMPTY_CHAT.path} />;
  }

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-gradient-to-b from-primary-500 to-primary-600">
      <Outlet />
    </div>
  );
};
