import { ChatPage, LoginPage, ProfileRequiredDialog, flagOn } from "../pages";
import { canWrite, expect, pageApi, skipOnboarding, test } from "../fixtures";
import { Mailbox, deleteKeycloakUser, verificationLink } from "../fixtures/signup";
import { lastPersistedTurn } from "./conversation";

/**
 * The first-time user journey: a brand-new account signs up, meets the required profile
 * dialog, gets the account mail and a first answer.
 *
 * Local compose stack (`local` project): the account registers through Keycloak
 * self-registration and the mails are read from Mailpit, so every step runs here.
 *
 * Other environments: the identity provider cannot be driven from here (Cognito sign-up
 * needs a mailbox). Provision a fresh, confirmed account outside the suite and pass it as
 * E2E_SIGNUP_EMAIL and E2E_SIGNUP_PASSWORD (docs/features/e2e.md, "First-time user"):
 * the spec then signs in, fills the profile dialog and asks the question; the mail checks
 * run only where E2E_MAILPIT_URL points at a mail catcher. Deleting that account is the
 * provisioner's job.
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

test.describe("first-time user journey @local", () => {
  // A fresh account: no test-account session, and the worker sign-in never runs.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a fresh account signs up, completes the profile, gets its mail and an answer", async ({
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
    const readMail = selfRegister || MAIL_CATCHER;

    const stamp = Date.now();
    const account = selfRegister
      ? {
          email: `e2e-signup-${stamp}@eve-e2e.dev`,
          password: `E2e-signup-${stamp}!`,
          firstName: "E2E",
          lastName: `Signup ${stamp}`,
        }
      : { email: PROVISIONED_EMAIL, password: PROVISIONED_PASSWORD, firstName: "", lastName: "" };
    const institution = `EVE e2e signup ${stamp}`;

    const context = await browser.newContext({ baseURL });
    await skipOnboarding(context, origin);
    const page = await context.newPage();
    const login = new LoginPage(page);
    const chat = new ChatPage(page);
    const required = new ProfileRequiredDialog(page);
    const pending = page.getByTestId("pending-approval-page");
    const api = pageApi(page, baseURL as string, testInfo.project.name);
    const mailbox = readMail ? await Mailbox.open(playwright.request) : null;
    let conversationId: string | null = null;

    try {
      // 1 and 2: register, then follow the verification link the identity provider mails.
      await page.goto("/");
      await login.expectForm(origin);
      if (selfRegister) {
        await login.register(account);
        let link: string | null = null;
        await expect
          .poll(
            async () => {
              const mail = await mailbox?.find(account.email, VERIFY_SUBJECT);
              link = mail ? verificationLink(mail.text) : null;
              return link;
            },
            { timeout: 30_000, message: "the verification mail reaches the mail catcher" },
          )
          .not.toBeNull();
        await page.goto(link as unknown as string);
        // Keycloak continues to the app, after a password when registration asked for none;
        // on a new browser session it asks to proceed first.
        await page.waitForLoadState("networkidle");
        await login.setPasswordIfAsked(account.password);
        const proceed = page.getByRole("link", { name: /proceed/i });
        if (await proceed.isVisible()) await proceed.click();
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
            (await pending.isVisible()) ||
            (await required.isOpen()) ||
            (await chat.composer.input.isVisible()),
          { timeout: 45_000 },
        )
        .toBe(true);

      if (await pending.isVisible()) {
        testInfo.annotations.push({ type: "approval", description: "pending: on hold page" });
        if (mailbox) {
          const onHold = await pollMail(mailbox, account.email, ON_HOLD_SUBJECT);
          expect(onHold.to).toContain(account.email);
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
      } else if (await required.isOpen()) {
        throw new Error("the required profile dialog is up while FEATURE_PROFILE_FIELDS reads off");
      }

      const me = await api.get<Me>("/users/me");
      expect(me.status).toBe(200);
      expect(me.body.email).toBe(account.email);
      expect(me.body.approval_status).toBe("approved");
      if (profileFields) {
        expect(me.body.country).toBe("Italy");
        expect(me.body.institution).toBe(institution);
      }

      // 4: the backend welcome mail, sent once on provisioning.
      if (mailbox) {
        const welcome = await pollMail(mailbox, account.email, WELCOME_SUBJECT);
        expect(welcome.to).toEqual([account.email]);
        expect(welcome.text).toContain(`Your EVE account ${account.email} is now active.`);
        expect(await mailbox.to(account.email)).not.toContainEqual(
          expect.objectContaining({ subject: expect.stringMatching(ON_HOLD_SUBJECT) }),
        );
      }

      // 5: the first question is answered and the turn is persisted.
      await chat.composer.send(QUESTION);
      conversationId = await chat.waitForConversationId();
      await chat.composer.waitIdle();
      expect((await chat.messages.lastAnswerText()).length).toBeGreaterThan(0);
      const id = conversationId;
      await expect
        .poll(async () => (await lastPersistedTurn(api, id)).outputChars, { timeout: 30_000 })
        .toBeGreaterThan(0);
      const turn = await lastPersistedTurn(api, id);
      expect(turn.messages).toBe(1);
      expect(turn.stopped ?? false).toBe(false);
      const persisted = await api.get<{ messages?: { metadata?: { error?: unknown } }[] }>(
        `/conversations/${id}`,
      );
      expect(persisted.body.messages?.[0]?.metadata?.error ?? null).toBeNull();
      console.log(
        `signup: ${account.email} approval=${me.body.approval_status} conversation=${id} ` +
          `pipeline=${turn.pipeline} documents=${turn.documents} output_chars=${turn.outputChars}`,
      );
    } finally {
      // 6: the conversation and the identity provider user go; the app user row and its
      // external identity stay (no API deletes them, docs/features/e2e.md).
      if (conversationId) await api.delete(`/conversations/${conversationId}`).catch(() => null);
      if (selfRegister) await deleteKeycloakUser(playwright.request, account.email);
      await mailbox?.dispose();
      await context.close();
    }
  });
});

async function pollMail(mailbox: Mailbox, address: string, subject: RegExp) {
  await expect
    .poll(async () => (await mailbox.find(address, subject)) !== null, {
      timeout: 30_000,
      message: `a mail matching ${subject} reaches ${address}`,
    })
    .toBe(true);
  const mail = await mailbox.find(address, subject);
  if (!mail) throw new Error(`no mail matching ${subject} to ${address}`);
  return mail;
}
