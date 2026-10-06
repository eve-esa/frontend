import type { APIRequestContext, PlaywrightWorkerArgs } from "@playwright/test";

/**
 * Support for the first-time user journey (specs/signup.spec.ts) on the local compose
 * stack: the Mailpit API that catches every mail (Keycloak and the backend mailer) and the
 * Keycloak admin API that removes the account afterwards. Defaults are the compose ones.
 */

type RequestFactory = PlaywrightWorkerArgs["playwright"]["request"];

export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://localhost:6080";
export const KEYCLOAK_URL = process.env.E2E_KEYCLOAK_URL ?? "http://localhost:8080";
const KEYCLOAK_REALM = process.env.E2E_KEYCLOAK_REALM ?? "eve";
const KEYCLOAK_ADMIN_USER = process.env.E2E_KEYCLOAK_ADMIN_USER ?? "admin";
const KEYCLOAK_ADMIN_PASSWORD = process.env.E2E_KEYCLOAK_ADMIN_PASSWORD ?? "admin";

export type Mail = { id: string; subject: string; to: string[]; text: string };

type MailpitSummary = { ID: string; Subject: string; To: { Address: string }[] };

/** Mails caught by Mailpit. */
export class Mailbox {
  private constructor(private readonly context: APIRequestContext) {}

  static async open(factory: RequestFactory): Promise<Mailbox> {
    return new Mailbox(await factory.newContext({ baseURL: MAILPIT_URL }));
  }

  /** Every mail to `address`, newest first, with its plain text body. */
  async to(address: string): Promise<Mail[]> {
    const search = await this.context.get("/api/v1/search", {
      params: { query: `to:"${address}"`, limit: 50 },
    });
    if (!search.ok()) throw new Error(`Mailpit search answered ${search.status()}`);
    const { messages } = (await search.json()) as { messages: MailpitSummary[] };
    return Promise.all(
      messages.map(async (summary) => {
        const full = await this.context.get(`/api/v1/message/${summary.ID}`);
        if (!full.ok()) throw new Error(`Mailpit message answered ${full.status()}`);
        const body = (await full.json()) as { Text?: string };
        return {
          id: summary.ID,
          subject: summary.Subject,
          to: summary.To.map((recipient) => recipient.Address),
          text: body.Text ?? "",
        };
      }),
    );
  }

  /** The first mail to `address` whose subject matches, or null. */
  async find(address: string, subject: RegExp): Promise<Mail | null> {
    return (await this.to(address)).find((mail) => subject.test(mail.subject)) ?? null;
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}

/** The Keycloak e-mail verification link in a mail body. */
export function verificationLink(text: string): string | null {
  return /(https?:\/\/\S+\/login-actions\/action-token\?\S+)/.exec(text)?.[1] ?? null;
}

/**
 * Deletes the Keycloak user with this e-mail through the admin API (master realm,
 * admin-cli). Returns whether a user was found and deleted.
 */
export async function deleteKeycloakUser(factory: RequestFactory, email: string): Promise<boolean> {
  const context = await factory.newContext({ baseURL: KEYCLOAK_URL });
  try {
    const token = await context.post("/realms/master/protocol/openid-connect/token", {
      form: {
        grant_type: "password",
        client_id: "admin-cli",
        username: KEYCLOAK_ADMIN_USER,
        password: KEYCLOAK_ADMIN_PASSWORD,
      },
    });
    if (!token.ok()) throw new Error(`Keycloak admin token answered ${token.status()}`);
    const { access_token: accessToken } = (await token.json()) as { access_token: string };
    const headers = { Authorization: `Bearer ${accessToken}` };
    const found = await context.get(`/admin/realms/${KEYCLOAK_REALM}/users`, {
      headers,
      params: { email, exact: "true" },
    });
    if (!found.ok()) throw new Error(`Keycloak user search answered ${found.status()}`);
    const users = (await found.json()) as { id: string }[];
    for (const user of users) {
      const deleted = await context.delete(`/admin/realms/${KEYCLOAK_REALM}/users/${user.id}`, {
        headers,
      });
      if (deleted.status() !== 204) {
        throw new Error(`Keycloak user delete answered ${deleted.status()}`);
      }
    }
    return users.length > 0;
  } finally {
    await context.dispose();
  }
}
