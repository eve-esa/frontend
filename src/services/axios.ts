import axios, { type InternalAxiosRequestConfig } from "axios";
import { CALLBACK_PATH, renewToken, userManager } from "./oidc";
import { isTrustedRequestUrl, resolveApiOrigin } from "@/utilities/sameOrigin";

const baseURL = import.meta.env.VITE_API_URL;
const PAGE_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "";
const API_ORIGIN = resolveApiOrigin(baseURL, PAGE_ORIGIN);

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

api.interceptors.request.use(
  async (config) => {
    // Defense-in-depth: never attach credentials for requests that don't
    // target our own origin or the API origin. This prevents the bearer token
    // from leaking to a foreign host even if a caller is tricked into
    // requesting a cross-origin/protocol-relative URL.
    if (
      !isTrustedRequestUrl(config.url, config.baseURL, PAGE_ORIGIN, API_ORIGIN)
    ) {
      return config;
    }

    const user = await userManager.getUser();
    if (user && !user.expired) {
      config.headers.Authorization = `Bearer ${user.access_token}`;
    }
    // No stored user, or an expired one: proceed without the header and let
    // the 401 below drive recovery.
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      isTrustedRequestUrl(
        originalRequest.url,
        originalRequest.baseURL,
        PAGE_ORIGIN,
        API_ORIGIN
      )
    ) {
      originalRequest._retry = true;

      try {
        const user = await renewToken();
        if (user) {
          originalRequest.headers.Authorization = `Bearer ${user.access_token}`;
          return api(originalRequest);
        }
      } catch (renewError) {
        console.error("Silent token renew failed:", renewError);
      }

      // Renew failed: only an interactive sign-in can recover. Never start
      // one from the callback route, where the exchange in progress would
      // loop forever.
      if (window.location.pathname !== CALLBACK_PATH) {
        void userManager.signinRedirect({
          state: {
            returnTo: window.location.pathname + window.location.search,
          },
        });
      }
    }

    return Promise.reject(error);
  }
);

export default api;
