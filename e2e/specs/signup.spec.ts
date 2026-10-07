import type { BrowserContext } from "@playwright/test";
import {
  ChatPage,
  LoginPage,
  PendingApprovalPage,
  ProfileRequiredDialog,
  SignupPage,
  flagOn,
  type NewAccount,
} from "../pages";
import { canWrite, expect, freshContext, pageApi, skipOnboarding, test, type Api } from "../fixtures";
import { deleteKeycloakUser } from "../fixtures/keycloak";
import { Mailbox, verificationLink } from "../fixtures/mailbox";
import { lastPersistedTurn } from "./conversation";

/**
 * The first-time user journey: a brand-new account signs up, meets the required profile
 * dialog, gets the account mail and a first answer.
 *
 * Opt-in (`@signup`): every run creates an account, so the spec runs only with
 * E2E_SIGNUP=1 and never in CI (playwright.config.ts, docs/features/e2e.md).
 *
 * Local compose stack (`local` project): the account registers through Keycloak
 * self-registration and the mails are read from Mailpit, so every step runs here.
 * Other environments: Cognito sign-up cannot be driven from here; a fresh, confirmed
 * account provisioned outside the suite comes in as E2E_SIGNUP_EMAIL and
 * E2E_SIGNUP_PASSWORD, and the mail steps run only where E2E_MAILPIT_URL is set.
 *
 * Cleanup (afterEach, also after a failure): the conversation through the API and, for a
 * self-registered account, the Keycloak user through the admin API. Not deleted, because
 * neither the backend nor the back office has a user delete:
 * - the app user row (`users`, e-mail e2e-signup-<timestamp>@eve-e2e.dev) and its
 *   `external_identities` row: locally with the mongosh command in docs/features/e2e.md;
 * - the mails in Mailpit (the catcher's own retention);
 * - a provisioned account: deleted by its provisioner (admin-delete-user).
 */

type Me = {
  email?: string;
  country?: string | null;
  institution?: string | null;
  approval_status?: string | null;
};

const PROVISIONED_EMAIL = process.env.E2E_SIGNUP_EMAIL ?? "";
const PROVISIONED_PASSWORD = process.env.E2E_SIGNUP_PASSWORD ?? "";
const MAIL_CATCHER = Boolean(process.env.E2E_MAILPIT_URL);
// A short question the classic route answers even without documents in the local Qdrant.
const QUESTION =
  process.env.E2E_SIGNUP_QUESTION ?? "What is the Sentinel-2 mission? Answer in one sentence.";

const WELCOME_SUBJECT = /^Your EVE account is ready$/;
const ON_HOLD_SUBJECT = /^Your EVE account is on hold for now$/;
const VERIFY_SUBJECT = /verify/i;

/** What the test created, recorded as it happens so the cleanup knows what to remove. */
type Created = {
  context?: BrowserContext;
  api?: Api;
  mailbox?: Mailbox;
  keycloakEmail?: string;
  conversationId?: string;
};

let created: Created = {};

test.describe("first-time user journey @signup @local", () => {
  // A fresh account: no test-account session, and the worker sign-in never runs.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(() => {
    created = {};
  });

  test.afterEach(async ({ playwright }) => {
    const failures: string[] = [];
    const attempt = async (what: string, run: () => Promise<unknown>) => {
      try {
        await run();
      } catch (error) {
        failures.push(`${what}: ${String(error).split("\n")[0]}`);
      }
    };
    try {
      const { api, conversationId, keycloakEmail } = created;
      if (api && conversationId) {
        await attempt("conversation", async () => {
          const { status } = await api.delete(`/conversations/${conversationId}`);
          if (status !== 200) throw new Error(`DELETE answered ${status}`);
        });
      }
      if (keycloakEmail) {
        await attempt("Keycloak user", () => deleteKeycloakUser(playwright.request, keycloakEmail));
      }
    } finally {
      await created.mailbox?.dispose().catch(() => undefined);
      await created.context?.close().catch(() => undefined);
    }
    if (failures.length > 0) throw new Error(`cleanup left data behind: ${failures.join("; ")}`);
  });

  test("a fresh account signs up and gets its account mail; approved, it completes the profile and gets an answer", async ({
    browser,
    baseURL,
    playwright,
  }, testInfo) => {
    const origin = new URL(baseURL as string).origin;
    const selfRegister = !PROVISIONED_EMAIL;
    test.skip(
      selfRegister && testInfo.project.name !== "local",
      "self-registration runs on the local stack only; elsewhere set E2E_SIGNUP_EMAIL and E2E_SIGNUP_PASSWORD",
    );
    test.skip(!canWrite(origin, testInfo.project.name), "the journey writes: not on a production target");

    const stamp = Date.now();
    const account: NewAccount = selfRegister
      ? {
          email: `e2e-signup-${stamp}@eve-e2e.dev`,
          password: `E2e-signup-${stamp}!`,
          firstName: "E2E",
          lastName: `Signup ${stamp}`,
        }
      : { email: PROVISIONED_EMAIL, password: PROVISIONED_PASSWORD, firstName: "", lastName: "" };
    const institution = `EVE e2e signup ${stamp}`;

    created.context = await freshContext(browser, baseURL);
    await skipOnboarding(created.context, origin);
    const page = await created.context.newPage();
    const login = new LoginPage(page);
    const signup = new SignupPage(page);
    const chat = new ChatPage(page);
    const required = new ProfileRequiredDialog(page);
    const pending = new PendingApprovalPage(page);
    const api = pageApi(page, baseURL as string, testInfo.project.name);
    created.api = api;
    const mailbox = selfRegister || MAIL_CATCHER ? await Mailbox.open(playwright.request) : null;
    created.mailbox = mailbox ?? undefined;

    // 1 and 2: register, then follow the verification link the identity provider mails.
    await page.goto("/");
    await login.expectForm(origin);
    if (selfRegister && mailbox) {
      created.keycloakEmail = account.email;
      await signup.register(account);
      const verify = await mailbox.waitFor(account.email, VERIFY_SUBJECT);
      const link = verificationLink(verify.text);
      expect(link, "the verification mail carries a link").not.toBeNull();
      await signup.followVerificationLink(link as string, account.password);
    } else {
      await login.signIn(account.email, account.password);
    }
    await page.waitForURL(
      (url) => url.origin === origin && !url.pathname.startsWith("/callback"),
      { timeout: 45_000 },
    );

    // 3: the first sign-in provisions the account; past the approval limit it waits.
    await expect
      .poll(
        async () =>
          (await pending.isOpen()) ||
          (await required.isOpen()) ||
          (await chat.composer.input.isVisible()),
        { timeout: 45_000 },
      )
      .toBe(true);

    if (await pending.isOpen()) {
      testInfo.annotations.push({ type: "approval", description: "pending: on hold page" });
      if (mailbox) {
        const onHold = await mailbox.waitFor(account.email, ON_HOLD_SUBJECT);
        expect(onHold.to).toEqual([account.email]);
        expect(onHold.text).toContain(`Your account ${account.email} is registered and on hold`);
      }
      return;
    }

    await chat.composer.waitReady();
    const profileFields =
      flagOn(await chat.servedConfig(), "FEATURE_PROFILE_FIELDS", false) ||
      process.env.E2E_PROFILE_FIELDS === "true";
    if (profileFields) {
      await expect(required.root).toBeVisible();
      // Nothing reaches the chat before the dialog is saved.
      await page.keyboard.press("Escape");
      await expect(required.root).toBeVisible();
      await expect(required.saveButton).toBeDisabled();
      await required.fill({ country: "Italy", institution });
      await required.save();
    } else {
      expect(await required.isOpen(), "no profile dialog while FEATURE_PROFILE_FIELDS is off").toBe(
        false,
      );
    }

    const me = await api.get<Me>("/users/me");
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(account.email);
    expect(me.body.approval_status).toBe("approved");
    if (profileFields) {
      expect(me.body.country).toBe("Italy");
      expect(me.body.institution).toBe(institution);
    }

    // 4: the backend welcome mail, sent once on provisioning, and no on hold mail.
    if (mailbox) {
      const welcome = await mailbox.waitFor(account.email, WELCOME_SUBJECT);
      expect(welcome.to).toEqual([account.email]);
      expect(welcome.text).toContain(`Your EVE account ${account.email} is now active.`);
      expect(await mailbox.find(account.email, ON_HOLD_SUBJECT)).toBeNull();
    }

    // 5: the first question is answered and the turn is persisted without an error.
    await chat.composer.send(QUESTION);
    const conversationId = await chat.waitForConversationId();
    created.conversationId = conversationId;
    await chat.composer.waitIdle();
    expect((await chat.messages.lastAnswerText()).length).toBeGreaterThan(0);
    await expect
      .poll(async () => (await lastPersistedTurn(api, conversationId)).outputChars, {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
    const turn = await lastPersistedTurn(api, conversationId);
    expect(turn.messages).toBe(1);
    expect(turn.stopped ?? false).toBe(false);
    const persisted = await api.get<{ messages?: { metadata?: { error?: unknown } }[] }>(
      `/conversations/${conversationId}`,
    );
    expect(persisted.body.messages?.[0]?.metadata?.error ?? null).toBeNull();
    console.log(
      `signup: ${account.email} approval=${me.body.approval_status} conversation=${conversationId} ` +
        `pipeline=${turn.pipeline} documents=${turn.documents} output_chars=${turn.outputChars}`,
    );
  });
});
