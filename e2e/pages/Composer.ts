import { expect, type Locator, type Page } from "@playwright/test";

/** The message box at the bottom of a conversation. */
export class Composer {
  readonly input: Locator;
  readonly sendButton: Locator;
  readonly stopButton: Locator;
  readonly busyNotice: Locator;
  readonly settingsButton: Locator;
  readonly modelPicker: Locator;
  readonly manageModelsButton: Locator;

  constructor(page: Page) {
    this.input = page.getByTestId("composer-input");
    this.sendButton = page.getByTestId("composer-send");
    this.stopButton = page.getByTestId("composer-stop");
    this.busyNotice = page.getByTestId("composer-busy-notice");
    this.settingsButton = page.getByTestId("composer-settings");
    this.modelPicker = page.getByTestId("composer-model-picker");
    this.manageModelsButton = page.getByTestId("composer-manage-models");
  }

  async waitReady(): Promise<void> {
    await expect(this.input).toBeVisible({ timeout: 30_000 });
  }

  async send(text: string): Promise<void> {
    await this.input.fill(text);
    await expect(this.sendButton).toBeEnabled();
    await this.sendButton.click();
  }

  /** Clicks Stop as soon as the answer is streaming. */
  async stop(): Promise<void> {
    await expect(this.stopButton).toBeVisible({ timeout: 60_000 });
    await this.stopButton.click();
  }

  isGenerating(): Promise<boolean> {
    return this.stopButton.isVisible();
  }

  /** Waits until no answer is in flight (Stop gone, Send back). */
  async waitIdle(timeout = 150_000): Promise<void> {
    await expect(this.stopButton).toBeHidden({ timeout });
    await expect(this.sendButton).toBeVisible({ timeout: 15_000 });
  }

  async busyNoticeText(): Promise<string | null> {
    if (!(await this.busyNotice.isVisible())) return null;
    return (await this.busyNotice.innerText()).trim();
  }
}
