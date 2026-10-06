import type { APIRequestContext, PlaywrightWorkerArgs } from "@playwright/test";

/**
 * Mail catcher client: the Mailpit API of the local compose stack, which catches every mail
 * (Keycloak and the backend mailer). Used by specs/signup.spec.ts.
 */

type RequestFactory = PlaywrightWorkerArgs["playwright"]["request"];

export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://localhost:6080";

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

  /** Waits for a mail to `address` whose subject matches; throws after `timeoutMs`. */
  async waitFor(address: string, subject: RegExp, timeoutMs = 30_000): Promise<Mail> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const mail = await this.find(address, subject);
      if (mail) return mail;
      if (Date.now() > deadline) {
        throw new Error(`no mail matching ${subject} to ${address} within ${timeoutMs} ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}

/** The Keycloak e-mail verification link in a mail body. */
export function verificationLink(text: string): string | null {
  return /(https?:\/\/\S+\/login-actions\/action-token\?\S+)/.exec(text)?.[1] ?? null;
}
