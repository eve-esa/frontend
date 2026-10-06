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
   * Clicks a user menu link and returns the URL the new tab was asked to load, closing the
   * tab. Read from the tab's first navigation request rather than its final URL, so a
   * redirect on the external site does not change the answer and the page never has to
   * finish loading.
   */
  async openedLinkUrl(testId: UserMenuLink): Promise<string> {
    const context = this.page.context();
    const navigation = context.waitForEvent("request", {
      predicate: (request) =>
        request.isNavigationRequest() && request.frame().page() !== this.page,
    });
    const tab = context.waitForEvent("page");
    await this.openUserMenuItem(testId);
    const [request, opened] = await Promise.all([navigation, tab]);
    await opened.close();
    return request.url();
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
