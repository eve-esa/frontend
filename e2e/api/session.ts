import type { APIRequestContext, APIResponse, PlaywrightWorkerArgs } from "@playwright/test";

/**
 * API sessions for the specs in e2e/api: no browser. The bearer is a Cognito access token
 * from InitiateAuth USER_PASSWORD_AUTH, which the app client allows in dev, staging and
 * prod. The pool and the client come from the config the target serves, so the suite needs
 * no variable beyond E2E_EMAIL and E2E_PASSWORD.
 *
 * Those tokens carry no openid scope: the backend resolves the account by issuer and
 * subject only after the user signed in once through the hosted page (the browser specs
 * of the same project do that).
 */

type RequestFactory = PlaywrightWorkerArgs["playwright"]["request"];

export type ApiSession = {
  /** Requests to the target with the session bearer. */
  request: APIRequestContext;
  /** Opens a context on the target that sends `bearer` (an `eve_` key, for example). */
  as(bearer: string): Promise<APIRequestContext>;
  /** Disposes every context this session opened. */
  dispose(): Promise<void>;
};

export type Credentials = { email: string; password: string };

const API_TIMEOUT_MS = 60_000;

/** The test account of the target, from E2E_EMAIL and E2E_PASSWORD. */
export function e2eCredentials(): Credentials {
  const email = process.env.E2E_EMAIL ?? "";
  const password = process.env.E2E_PASSWORD ?? "";
  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must be set to run the suite");
  }
  return { email, password };
}

/** `window.__EVE_CONFIG__` as the target serves it in index.html. */
export async function servedConfig(
  factory: RequestFactory,
  baseURL: string,
): Promise<Record<string, string>> {
  const context = await factory.newContext({ baseURL });
  try {
    const response = await context.get("/");
    if (!response.ok()) throw new Error(`GET ${baseURL}/ answered ${response.status()}`);
    const match = /window\.__EVE_CONFIG__=(\{.*?\});<\/script>/s.exec(await response.text());
    if (!match) throw new Error(`no window.__EVE_CONFIG__ in the index.html of ${baseURL}`);
    return JSON.parse(match[1]) as Record<string, string>;
  } finally {
    await context.dispose();
  }
}

/** The Cognito region of an issuer such as https://cognito-idp.eu-west-1.amazonaws.com/<pool>. */
export function cognitoRegion(issuer: string): string | null {
  return /^https:\/\/cognito-idp\.([a-z0-9-]+)\.amazonaws\.com\//.exec(issuer)?.[1] ?? null;
}

/**
 * Signs in without a browser and returns a session on `baseURL`. Throws when the target is
 * not on Cognito (the local compose stack signs in through Keycloak): callers skip first
 * with `cognitoRegion`.
 */
export async function openSession(
  factory: RequestFactory,
  baseURL: string,
  credentials: Credentials = e2eCredentials(),
): Promise<ApiSession> {
  const config = await servedConfig(factory, baseURL);
  const region = cognitoRegion(config.AUTH_ISSUER ?? "");
  if (!region || !config.AUTH_CLIENT_ID) {
    throw new Error(`${baseURL} does not sign in through Cognito (AUTH_ISSUER ${config.AUTH_ISSUER})`);
  }

  const cognito = await factory.newContext();
  let accessToken: string;
  try {
    const response = await cognito.post(`https://cognito-idp.${region}.amazonaws.com/`, {
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      data: JSON.stringify({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: config.AUTH_CLIENT_ID,
        AuthParameters: { USERNAME: credentials.email, PASSWORD: credentials.password },
      }),
    });
    const body = (await response.json()) as {
      __type?: string;
      ChallengeName?: string;
      AuthenticationResult?: { AccessToken?: string };
    };
    // Only the error type and the challenge name are reported, never the request.
    if (!response.ok()) throw new Error(`Cognito InitiateAuth answered ${response.status()} ${body.__type}`);
    const token = body.AuthenticationResult?.AccessToken;
    if (!token) throw new Error(`Cognito InitiateAuth asked for ${body.ChallengeName ?? "no token"}`);
    accessToken = token;
  } finally {
    await cognito.dispose();
  }

  const opened: APIRequestContext[] = [];
  const as = async (bearer: string): Promise<APIRequestContext> => {
    const context = await factory.newContext({
      baseURL,
      timeout: API_TIMEOUT_MS,
      extraHTTPHeaders: { Authorization: `Bearer ${bearer}` },
    });
    opened.push(context);
    return context;
  };
  const request = await as(accessToken);
  const dispose = async (): Promise<void> => {
    await Promise.all(opened.map((context) => context.dispose()));
  };
  return { request, as, dispose };
}

/** The body as JSON, or the raw text when it is not JSON, so a failed assertion shows it. */
export async function bodyOf<T = unknown>(response: APIResponse): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

/** One short non-streaming chat completion through the /v1 gateway. */
export function complete(
  context: APIRequestContext,
  model: string,
  extra: Record<string, unknown> = {},
): Promise<APIResponse> {
  return context.post("/api/v1/chat/completions", {
    data: {
      model,
      messages: [{ role: "user", content: "Reply with the single word: pong" }],
      max_tokens: 10,
      ...extra,
    },
  });
}

/** The `<provider>/...` id `/v1/models` lists for `provider`, if any. */
export async function modelOf(context: APIRequestContext, provider: string): Promise<string | undefined> {
  const response = await context.get("/api/v1/models");
  if (!response.ok()) throw new Error(`GET /api/v1/models answered ${response.status()}`);
  const body = (await response.json()) as { data: { id: string }[] };
  return body.data.map((model) => model.id).find((id) => id.startsWith(`${provider}/`));
}

export type ApiKey = { id: string; token: string; token_suffix: string };

/** Creates a 1 day key and returns it; the caller revokes it in a `finally`. */
export async function createKey(session: ApiSession, label: string): Promise<ApiKey> {
  const response = await session.request.post("/api/users/api-keys", {
    data: { name: `e2e-api ${label} ${Date.now()}`, expires_in_days: 1 },
  });
  if (response.status() !== 201) {
    throw new Error(`POST /api/users/api-keys answered ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as ApiKey;
}

/** Revokes a key; 204 also for an already revoked one. */
export async function revokeKey(session: ApiSession, id: string): Promise<number> {
  return (await session.request.delete(`/api/users/api-keys/${id}`)).status();
}
