import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import App from "./App";
import { NewSession } from "./components/NewSession";
import { SessionPage } from "./components/SessionPage";

const rootRoute = createRootRoute({ component: App });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: NewSession,
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/session/$sessionId",
  component: SessionPage,
});

/** Hash history: the production webview serves the app from a single fixed
 * URL, so real paths would break on a hard reload. */
export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, sessionRoute]),
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
