import { expect, type Locator, type Page } from "@playwright/test";
import { Composer } from "./Composer";
import { MessagePanel } from "./MessagePanel";

/** User menu entries that open an external page in a new tab. */
export type UserMenuLink = "user-menu-about" | "user-menu-contact" | "user-menu-privacy";

type UserMenuItem = "user-menu-profile" | "user-menu-logout" | UserMenuLink;

/** The chat layout: conversations sidebar, user menu, composer and messages. */
export class ChatPage {
  readonly composer: Composer;
  readonly messages: MessagePanel;
  readonly newChatButton: Locator;
  readonly conversations: Locator;
  readonly userMenu: Locator;
  readonly userMenuEmail: Locator;
  readonly apiKeysEntry: Locator;

  constructor(readonly page: Page) {
    this.composer = new Composer(page);
    this.messages = new MessagePanel(page);
    this.newChatButton = page.getByTestId("sidebar-new-chat");
    this.conversations = page.getByTestId("conversation-item");
    this.userMenu = page.getByTestId("user-menu");
    this.userMenuEmail = page.getByTestId("user-menu-email");
    this.apiKeysEntry = page.getByTestId("sidebar-api-keys");
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.composer.waitReady();
  }

  async newChat(): Promise<void> {
    await this.newChatButton.click();
    await this.composer.waitReady();
  }

  /** Conversation id from the URL, or null on the empty chat page. */
  conversationId(): string | null {
    const match = new URL(this.page.url()).pathname.match(/\/chat\/([^/]+)/);
    return match ? match[1] : null;
  }

  async waitForConversationId(): Promise<string> {
    await expect.poll(() => this.conversationId(), { timeout: 60_000 }).not.toBeNull();
    return this.conversationId() as string;
  }

  /**
   * Waits until the turn just sent has ended. `Composer.waitIdle` alone can pass
   * before the stream starts (Stop not rendered yet, Send already gone), so this
   * first waits for Stop or for an ended last turn (answer footer, error or
   * stopped), then for Stop to go and Send to come back, all within `timeout`.
   */
  async waitAnswered(timeout = 240_000): Promise<void> {
    const last = this.messages.last;
    const ended = last
      .getByTestId("message-copy")
      .or(last.getByTestId("message-error"))
      .or(last.getByTestId("message-stopped"));
    await expect(this.composer.stopButton.or(ended).first()).toBeVisible({ timeout: 60_000 });
    await expect(this.composer.stopButton).toBeHidden({ timeout });
    await expect(this.composer.sendButton).toBeVisible({ timeout: 30_000 });
  }

  async openConversation(title: string): Promise<void> {
    const item = this.conversations.filter({
      has: this.page.getByTestId("conversation-title").getByText(title, { exact: true }),
    });
    await item.first().click();
    await this.composer.waitReady();
  }

  conversationTitles(): Promise<string[]> {
    return this.page.getByTestId("conversation-title").allInnerTexts();
  }

  /** The newest sidebar item with this title (the list is sorted newest first). */
  private conversationItem(title: string): Locator {
    return this.conversations
      .filter({
        has: this.page.getByTestId("conversation-title").getByText(title, { exact: true }),
      })
      .first();
  }

  /** Opens the item menu; the trigger shows on hover only, on desktop. */
  private async openConversationMenu(title: string): Promise<void> {
    const item = this.conversationItem(title);
    await item.hover();
    await item.getByTestId("conversation-menu-trigger").click();
  }

  /** Renames from the item menu and waits for the inline field to close on save. */
  async renameConversation(title: string, newTitle: string): Promise<void> {
    await this.openConversationMenu(title);
    await this.page.getByTestId("conversation-menu-rename").click();
    const input = this.page.getByTestId("conversation-rename-input");
    await input.fill(newTitle);
    await input.press("Enter");
    await expect(input).toBeHidden({ timeout: 15_000 });
  }

  /** Deletes from the item menu through the confirm dialog. */
  async deleteConversation(title: string): Promise<void> {
    await this.openConversationMenu(title);
    await this.page.getByTestId("conversation-menu-delete").click();
    const confirm = this.page.getByTestId("conversation-delete-confirm");
    await confirm.click();
    await expect(confirm).toBeHidden({ timeout: 15_000 });
  }

  async signedInEmail(): Promise<string> {
    await expect(this.userMenuEmail).toBeVisible();
    return (await this.userMenuEmail.innerText()).trim();
  }

  async openUserMenuItem(testId: UserMenuItem): Promise<void> {
    await this.userMenu.click();
    await this.page.getByTestId(testId).click();
  }

  /**
   * Clicks a user menu link and returns the first http(s) URL the new tab commits, closing
   * the tab. The tab is caught as a page of the context: the link opens with noopener, and
   * its first navigation request has no frame yet when Playwright reports it. The URL is
   * read at commit, so the external page never has to finish loading; a server redirect on
   * the external site is already applied.
   */
  async openedLinkUrl(testId: UserMenuLink): Promise<string> {
    const tab = this.page.context().waitForEvent("page");
    await this.openUserMenuItem(testId);
    const opened = await tab;
    try {
      await opened.waitForURL(/^https?:/, { waitUntil: "commit" });
      return opened.url();
    } finally {
      await opened.close();
    }
  }

  /** The runtime config the release injected, as the app reads it. */
  servedConfig(): Promise<Record<string, string>> {
    return this.page.evaluate(
      () =>
        ((window as unknown as { __EVE_CONFIG__?: Record<string, string> }).__EVE_CONFIG__ ??
          {}) as Record<string, string>,
    );
  }
}

/** Same reading as `isEnabled` in src/utilities/runtimeConfig.ts. */
export function flagOn(config: Record<string, string>, key: string, fallback: boolean): boolean {
  const raw = config[key];
  if (raw === undefined || raw === "") return fallback;
  return raw.trim().toLowerCase() === "true";
}
