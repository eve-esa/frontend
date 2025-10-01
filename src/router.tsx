import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";
import { routes } from "./utilities/routes";
import { PrivateRoute } from "./route-guards/private-route/PrivateRoute";
import { PublicRoute } from "./route-guards/public-route/PublicRoute";
import { PublicLayout } from "./layouts/public-layout/PublicLayout";
import { ChatLayout } from "./layouts/chat-layout/ChatLayout";
import { AuthLayout } from "./layouts/auth-layout/AuthLayout";

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route element={<PrivateRoute />}>
        <Route element={<ChatLayout />}>
          <Route {...routes.EMPTY_CHAT} />
          <Route {...routes.CHAT} />
          <Route {...routes.ONBOARDING} />
        </Route>
      </Route>
      <Route element={<PublicRoute />}>
        <Route element={<PublicLayout />}>
          <Route element={<AuthLayout />}>
            <Route {...routes.LOGIN} />
            <Route {...routes.SIGN_UP} />
            <Route {...routes.FORGOT_PASSWORD} />
            <Route {...routes.RESET_PASSWORD} />
          </Route>
        </Route>
      </Route>
      <Route {...routes.NOT_FOUND} />
    </Route>
  )
);
