import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";
import { routes } from "./utilities/routes";
import { SELF_SIGNUP_ENABLED } from "./utilities/features";
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
          <Route {...routes.ARTIFACTS} />
          <Route {...routes.ONBOARDING} />
        </Route>
      </Route>
      <Route element={<PublicRoute />}>
        <Route element={<PublicLayout />}>
          <Route element={<AuthLayout />}>
            <Route {...routes.LOGIN} />
            {/* Not merely hidden: when self-signup is off the route is never
                registered, so /signup 404s instead of rendering a form whose
                submission the backend refuses. */}
            {SELF_SIGNUP_ENABLED && <Route {...routes.SIGN_UP} />}
            <Route {...routes.FORGOT_PASSWORD} />
            <Route {...routes.RESET_PASSWORD} />
            <Route {...routes.VERIFY} />
          </Route>
        </Route>
      </Route>
      <Route {...routes.NOT_FOUND} />
    </Route>
  )
);
