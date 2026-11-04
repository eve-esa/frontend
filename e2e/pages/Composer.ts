import { expect, type Locator, type Page } from "@playwright/test";
import type { FilePayload } from "../fixtures/png";

/** The message box at the bottom of a conversation. */
export class Composer {
  /** The card around the input and its controls. */
  readonly box: Locator;
  readonly input: Locator;
  readonly sendButton: Locator;
  readonly stopButton: Locator;
  readonly busyNotice: Locator;
  readonly settingsButton: Locator;
  readonly modelPicker: Locator;
  readonly manageModelsButton: Locator;
  readonly lastTurnEnded: Locator;
  /** The hidden file input behind the paperclip, rendered with FEATURE_ATTACHMENTS on. */
  readonly attachInput: Locator;
  readonly attachButton: Locator;
  readonly attachmentPreviews: Locator;
  readonly attachmentUploading: Locator;

  constructor(private readonly page: Page) {
    this.box = page.getByTestId("composer-box");
    this.input = page.getByTestId("composer-input");
    this.sendButton = page.getByTestId("composer-send");
    this.stopButton = page.getByTestId("composer-stop");
    this.busyNotice = page.getByTestId("composer-busy-notice");
    this.settingsButton = page.getByTestId("composer-settings");
    this.modelPicker = page.getByTestId("composer-model-picker");
    this.manageModelsButton = page.getByTestId("composer-manage-models");
    this.attachInput = page.getByTestId("attach-image-input");
    this.attachButton = page.getByTestId("attach-image-button");
    this.attachmentPreviews = page.getByTestId("attachment-preview");
    this.attachmentUploading = page.getByTestId("attachment-uploading");
    const last = page.getByTestId("message").last();
    this.lastTurnEnded = last
      .getByTestId("message-copy")
      .or(last.getByTestId("message-error"))
      .or(last.getByTestId("message-stopped"));
  }

  async waitReady(): Promise<void> {
    await expect(this.input).toBeVisible({ timeout: 30_000 });
  }

  async send(text: string): Promise<void> {
    await this.input.fill(text);
    await expect(this.sendButton).toBeEnabled();
    await this.sendButton.click();
  }

  /**
   * Picks a file through the composer's file input and waits for its upload (`POST /artifacts`)
   * and its preview. Returns the artifact id the backend gave it.
   */
  async attach(file: FilePayload): Promise<string> {
    const uploaded = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/artifacts"),
      { timeout: 60_000 },
    );
    await this.attachInput.setInputFiles(file);
    const response = await uploaded;
    expect(response.status(), `upload of ${file.name}`).toBe(200);
    const { id } = (await response.json()) as { id?: string };
    if (!id) throw new Error(`the upload of ${file.name} returned no id`);
    await expect(this.attachmentPreviews).toHaveCount(1);
    await expect(this.attachmentUploading).toHaveCount(0);
    return id;
  }

  /** Clicks Stop as soon as the answer is streaming. */
  async stop(): Promise<void> {
    await expect(this.stopButton).toBeVisible({ timeout: 60_000 });
    await this.stopButton.click();
  }

  isGenerating(): Promise<boolean> {
    return this.stopButton.isVisible();
  }

  /**
   * Waits until the turn just sent has ended. Stop hidden alone passes before
   * the stream starts (Stop not rendered yet, Send already gone), so this first
   * waits for Stop or for an ended last turn (answer footer, error or stopped),
   * then for Stop to go within `timeout`, then for Send to come back.
   */
  async waitIdle(timeout = 240_000): Promise<void> {
    await expect(this.stopButton.or(this.lastTurnEnded).first()).toBeVisible({ timeout: 60_000 });
    await expect(this.stopButton).toBeHidden({ timeout });
    await expect(this.sendButton).toBeVisible({ timeout: 30_000 });
  }

  async busyNoticeText(): Promise<string | null> {
    if (!(await this.busyNotice.isVisible())) return null;
    return (await this.busyNotice.innerText()).trim();
  }
}
