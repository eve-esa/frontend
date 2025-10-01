import { Outlet } from "react-router-dom";
import logo from "@/assets/images/esa_phi_lab_1.svg";

export const AuthLayout = () => {
  return (
    <div className="flex flex-col gap-10 h-full w-full justify-center items-center px-6">
      <img src={logo} alt="logo" className="h-[60px] md:h-[99px]" />

      <div className="flex flex-col gap-6 bg-natural-900 rounded-[20px] px-6 py-10 md:p-16 w-full max-w-[560px]">
        <Outlet />
      </div>
    </div>
  );
};
