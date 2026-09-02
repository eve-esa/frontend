import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";
import { routes } from "./utilities/routes";
import { PrivateRoute } from "./route-guards/private-route/PrivateRoute";
import { ChatLayout } from "./layouts/chat-layout/ChatLayout";
import { ARTIFACTS_ENABLED } from "./utilities/features";

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route element={<PrivateRoute />}>
        <Route element={<ChatLayout />}>
          <Route {...routes.EMPTY_CHAT} />
          <Route {...routes.CHAT} />
          {/* Off, the path falls through to the catch-all below and shows
              Not found. Artifact links inside old messages go through the
              API, not this route, so they keep working. */}
          {ARTIFACTS_ENABLED && <Route {...routes.ARTIFACTS} />}
          <Route {...routes.ONBOARDING} />
        </Route>
      </Route>
      {/* Outside PrivateRoute: the guard must never start a second sign-in
          while the code/state exchange on this route is in flight. */}
      <Route {...routes.CALLBACK} />
      <Route {...routes.NOT_FOUND} />
    </Route>
  )
);
