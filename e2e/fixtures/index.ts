import fs from "node:fs";
import path from "node:path";
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  ApiKeysDialog,
  ChatPage,
  LoginPage,
  ProfileDialog,
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

/**
 * Opens the app and lands on the chat. With a live identity provider session
 * (cookie in the storage state) the redirect comes straight back; without one
 * the hosted login is filled.
 */
export async function signIn(page: Page, appOrigin: string): Promise<void> {
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
}

export type ApiResponse<T> = { status: number; body: T };

export type Api = {
  /** GET `/api<path>` with the bearer the signed-in app holds. */
  get<T = unknown>(path: string): Promise<ApiResponse<T>>;
  /** The OIDC access token from the `oidc.user:` session storage entry. */
  bearer(): Promise<string>;
};

type TestFixtures = {
  authedPage: Page;
  chat: ChatPage;
  settings: SettingsPanel;
  profile: ProfileDialog;
  apiKeys: ApiKeysDialog;
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
      await signIn(page, origin);
      await context.storageState({ path: file });
      await context.close();
      await use(file);
    },
    { scope: "worker" },
  ],

  storageState: async ({ authState }, use) => {
    await use(authState);
  },

  authedPage: async ({ page, context, baseURL }, use) => {
    const origin = new URL(baseURL as string).origin;
    await skipOnboarding(context, origin);
    await signIn(page, origin);
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

  apiKeys: async ({ authedPage, chat }, use) => {
    await use(new ApiKeysDialog(authedPage, chat));
  },

  api: async ({ authedPage, baseURL }, use) => {
    const bearer = async (): Promise<string> => {
      const token = await authedPage.evaluate(() => {
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
    const get = async <T>(apiPath: string): Promise<ApiResponse<T>> => {
      const response = await authedPage.request.get(`${baseURL}/api${apiPath}`, {
        headers: { Authorization: `Bearer ${await bearer()}` },
      });
      const text = await response.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        // Non-JSON body: the raw text is returned so the assertion shows it.
      }
      return { status: response.status(), body: body as T };
    };
    await use({ get, bearer });
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
