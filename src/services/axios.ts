import axios from "axios";
import {
  LOCAL_STORAGE_ACCESS_TOKEN,
  LOCAL_STORAGE_REFRESH_TOKEN,
} from "@/utilities/localStorage";
import { routes } from "@/utilities/routes";

const baseURL = import.meta.env.VITE_API_URL;

// Public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/refresh",
];

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

api.interceptors.request.use(
  async (config) => {
    const isPublicEndpoint = PUBLIC_ENDPOINTS.some((endpoint) =>
      config.url?.includes(endpoint)
    );

    let token = localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN);
    const refreshToken = localStorage.getItem(LOCAL_STORAGE_REFRESH_TOKEN);

    // Skip authentication logic for public endpoints
    if (isPublicEndpoint) {
      return config;
    }

    // For protected endpoints: if no access token but refresh token exists, try to refresh
    if (!token && refreshToken) {
      try {
        token = await refreshAccessToken();
      } catch (error) {
        console.error("Failed to refresh token during request:", error);
        // If refresh fails, redirect to login (refresh token is invalid)
        if (window.location.pathname !== routes.LOGIN.path) {
          window.location.href = routes.LOGIN.path;
        }
        return Promise.reject(new Error("Invalid refresh token"));
      }
    }

    // If no tokens at all for protected endpoints, redirect to login
    if (!token && !refreshToken) {
      if (window.location.pathname !== routes.LOGIN.path) {
        window.location.href = routes.LOGIN.path;
      }
      return Promise.reject(new Error("No authentication tokens available"));
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem(LOCAL_STORAGE_REFRESH_TOKEN);
  if (!refreshToken) {
    console.error("No refresh token available");
    return null;
  }

  try {
    const response = await axios.post(`${baseURL}/refresh`, {
      refresh_token: refreshToken,
    });

    const { access_token } = response.data;
    localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN, access_token);
    return access_token;
  } catch (error) {
    localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN);
    localStorage.removeItem(LOCAL_STORAGE_REFRESH_TOKEN);
    throw error;
  }
};

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      const isPublicEndpoint = PUBLIC_ENDPOINTS.some((endpoint) =>
        originalRequest.url?.includes(endpoint)
      );

      // Skip refresh logic for public endpoints
      if (isPublicEndpoint) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } else {
          localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN);

          if (window.location.pathname !== routes.LOGIN.path) {
            window.location.href = routes.LOGIN.path;
          }
          return Promise.reject(new Error("No refresh token available"));
        }
      } catch (refreshError) {
        if (window.location.pathname !== routes.LOGIN.path) {
          window.location.href = routes.LOGIN.path;
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error("Access forbidden");
    }

    // Handle network errors
    if (!error.response) {
      console.error("Network error:", error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
