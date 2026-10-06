import fs from "node:fs";
import path from "node:path";
import {
  test as base,
  expect,
  type APIResponse,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import {
  ApiKeysDialog,
  ChatPage,
  LoginPage,
  MyCollectionsPanel,
  ProfileDialog,
  ProfileRequiredDialog,
  SettingsPanel,
} from "../pages";

const E2E_EMAIL = process.env.E2E_EMAIL ?? "";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "";
const AUTH_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "..", ".auth");

/**
 * Local storage the app reads on start: no product tour, no welcome dialog.
 * Set on the app origin only, before any app script runs (keys from
 * src/utilities/localStorage.ts).
 */
export async function skipOnboarding(context: BrowserContext, appOrigin: string): Promise<void> {
  await context.addInitScript((origin) => {
    if (window.location.origin !== origin) return;
    try {
      localStorage.setItem("tour_completed", "true");
      localStorage.setItem("welcome_dialog_viewed", "true");
    } catch {
      // Storage blocked: the first click the test needs fails with a clear locator error.
      return;
    }
  }, appOrigin);
}

/** Production hosts: nothing in the suite writes there, whatever the project or E2E_TARGET. */
const PROD_HOSTS = new Set(["eve-chat.chat", "app.eve-chat.chat"]);

/**
 * Whether the suite may write to the target: never on a production host, never in the
 * `prod-readonly` project. Read from the resolved base URL, so an E2E_TARGET pointing a dev
 * project at production is refused too.
 */
export function canWrite(appOrigin: string, projectName: string): boolean {
  return projectName !== "prod-readonly" && !PROD_HOSTS.has(new URL(appOrigin).hostname);
}

/** What the sign-in fills when the required profile dialog blocks the chat. */
export const E2E_PROFILE_FIELDS = { country: "Italy", institution: "EVE e2e" };

/**
 * Opens the app and lands on the chat. With a live identity provider session
 * (cookie in the storage state) the redirect comes straight back; without one
 * the hosted login is filled. With FEATURE_PROFILE_FIELDS on and the test
 * account lacking country or institution, the required profile dialog covers
 * the chat: it is filled with E2E_PROFILE_FIELDS, except where the project
 * must not write (`writable` false, see canWrite), which fails with the reason instead.
 */
export async function signIn(page: Page, appOrigin: string, writable = true): Promise<void> {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must be set to run the suite");
  }
  await page.goto("/");
  const chat = new ChatPage(page);
  const login = new LoginPage(page);
  await expect
    .poll(
      async () =>
        login.isOnIdentityProvider(appOrigin) || (await chat.composer.input.isVisible()),
      { timeout: 45_000 },
    )
    .toBe(true);
  if (login.isOnIdentityProvider(appOrigin)) {
    await login.signIn(E2E_EMAIL, E2E_PASSWORD);
    await page.waitForURL(
      (url) => url.origin === appOrigin && !url.pathname.startsWith("/callback"),
      { timeout: 45_000 },
    );
  }
  await chat.composer.waitReady();
  // The profile has loaded before the chat renders, so the dialog is already
  // up when the composer is.
  const required = new ProfileRequiredDialog(page);
  if (await required.isOpen()) {
    if (!writable) {
      throw new Error(
        "the required profile dialog blocks the chat: set country and institution on the test account",
      );
    }
    await required.fill(E2E_PROFILE_FIELDS);
    await required.save();
  }
}

export type ApiResponse<T> = { status: number; body: T };

export type Api = {
  /** GET `/api<path>` with the bearer the signed-in app holds. */
  get<T = unknown>(path: string): Promise<ApiResponse<T>>;
  /** PATCH `/api<path>` with a JSON body and the same bearer. Throws on a production target. */
  patch<T = unknown>(path: string, body: unknown): Promise<ApiResponse<T>>;
  /** DELETE `/api<path>` with the same bearer, for cleanup. Throws on a production target. */
  delete<T = unknown>(path: string): Promise<ApiResponse<T>>;
  /** The OIDC access token from the `oidc.user:` session storage entry. */
  bearer(): Promise<string>;
};

/**
 * Where the API answers: `E2E_API_URL` when set; the compose backend for the `local` project
 * (the Vite dev server answers every path with index.html, and the backend serves its routes
 * without the `/api` prefix there); `<baseURL>/api` everywhere else (CloudFront strips it).
 */
export function apiBaseURL(baseURL: string, projectName: string): string {
  if (process.env.E2E_API_URL) return process.env.E2E_API_URL.replace(/\/$/, "");
  if (projectName === "local") return "http://localhost:8000";
  return `${baseURL}/api`;
}

/**
 * `Api` on a signed-in page: the bearer is read from the page's OIDC session storage on
 * every call, so a token renewal is picked up. Writes are refused on a production target.
 */
export function pageApi(page: Page, baseURL: string, projectName: string): Api {
  const apiBase = apiBaseURL(baseURL, projectName);
  const bearer = async (): Promise<string> => {
    const token = await page.evaluate(() => {
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i);
        if (!key?.startsWith("oidc.user:")) continue;
        const raw = sessionStorage.getItem(key);
        return raw ? (JSON.parse(raw) as { access_token?: string }).access_token ?? null : null;
      }
      return null;
    });
    if (!token) throw new Error("no oidc.user: entry in session storage");
    return token;
  };
  const toApiResponse = async <T>(response: APIResponse): Promise<ApiResponse<T>> => {
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Non-JSON body: the raw text is returned so the assertion shows it.
    }
    return { status: response.status(), body: body as T };
  };
  const get = async <T>(apiPath: string): Promise<ApiResponse<T>> =>
    toApiResponse<T>(
      await page.request.get(`${apiBase}${apiPath}`, {
        headers: { Authorization: `Bearer ${await bearer()}` },
      }),
    );
  const refuseOnProd = (method: string, apiPath: string) => {
    if (!canWrite(new URL(baseURL).origin, projectName)) {
      throw new Error(`refusing ${method} ${apiPath}: ${baseURL} is a production target`);
    }
  };
  const patch = async <T>(apiPath: string, data: unknown): Promise<ApiResponse<T>> => {
    refuseOnProd("PATCH", apiPath);
    return toApiResponse<T>(
      await page.request.patch(`${apiBase}${apiPath}`, {
        headers: { Authorization: `Bearer ${await bearer()}` },
        data,
      }),
    );
  };
  const del = async <T>(apiPath: string): Promise<ApiResponse<T>> => {
    refuseOnProd("DELETE", apiPath);
    return toApiResponse<T>(
      await page.request.delete(`${apiBase}${apiPath}`, {
        headers: { Authorization: `Bearer ${await bearer()}` },
      }),
    );
  };
  return { get, patch, delete: del, bearer };
}

type TestFixtures = {
  authedPage: Page;
  chat: ChatPage;
  settings: SettingsPanel;
  profile: ProfileDialog;
  profileRequired: ProfileRequiredDialog;
  apiKeys: ApiKeysDialog;
  myCollections: MyCollectionsPanel;
  api: Api;
};

type WorkerFixtures = { authState: string };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // One hosted login per worker; tests reuse its cookies.
  authState: [
    async ({ browser }, use, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL as string;
      const file = path.join(AUTH_DIR, `${workerInfo.project.name}-${workerInfo.workerIndex}.json`);
      fs.mkdirSync(AUTH_DIR, { recursive: true });
      const context = await browser.newContext({ baseURL });
      const origin = new URL(baseURL).origin;
      await skipOnboarding(context, origin);
      const page = await context.newPage();
      await signIn(page, origin, canWrite(origin, workerInfo.project.name));
      await context.storageState({ path: file });
      await context.close();
      await use(file);
    },
    { scope: "worker" },
  ],

  storageState: async ({ authState }, use) => {
    await use(authState);
  },

  authedPage: async ({ page, context, baseURL }, use, testInfo) => {
    const origin = new URL(baseURL as string).origin;
    await skipOnboarding(context, origin);
    await signIn(page, origin, canWrite(origin, testInfo.project.name));
    await use(page);
  },

  chat: async ({ authedPage }, use) => {
    await use(new ChatPage(authedPage));
  },

  settings: async ({ authedPage, chat }, use) => {
    await use(new SettingsPanel(authedPage, chat.composer));
  },

  profile: async ({ authedPage, chat }, use) => {
    await use(new ProfileDialog(authedPage, chat));
  },

  profileRequired: async ({ authedPage }, use) => {
    await use(new ProfileRequiredDialog(authedPage));
  },

  apiKeys: async ({ authedPage, chat }, use) => {
    await use(new ApiKeysDialog(authedPage, chat));
  },

  myCollections: async ({ authedPage }, use) => {
    await use(new MyCollectionsPanel(authedPage));
  },

  api: async ({ authedPage, baseURL }, use, testInfo) => {
    await use(pageApi(authedPage, baseURL as string, testInfo.project.name));
  },
});

export { expect };

/** Walks a JSON value and reports whether `key` appears at any depth. */
export function hasKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasKey(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([k, v]) => k === key || hasKey(v, key));
  }
  return false;
}
