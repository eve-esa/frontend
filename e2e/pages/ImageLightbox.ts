import { expect, type Locator, type Page } from "@playwright/test";

/** Zoom and pan offset the lightbox applies to its image (src/utilities/lightboxTransform.ts). */
export type LightboxState = { zoom: number; x: number; y: number };

/** The full-size image preview with zoom, pan and reset (src/components/ui/ImageLightbox.tsx). */
export class ImageLightbox {
  readonly root: Locator;
  readonly image: Locator;
  readonly viewport: Locator;
  readonly stage: Locator;
  readonly zoomInButton: Locator;
  readonly zoomOutButton: Locator;
  readonly resetButton: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId("image-lightbox");
    this.image = this.root.getByTestId("lightbox-image");
    this.viewport = this.root.getByTestId("lightbox-viewport");
    this.stage = this.root.getByTestId("lightbox-transform");
    this.zoomInButton = this.root.getByTestId("lightbox-zoom-in");
    this.zoomOutButton = this.root.getByTestId("lightbox-zoom-out");
    this.resetButton = this.root.getByTestId("lightbox-reset");
  }

  /** Waits until the dialog shows the image decoded at `width` pixels. */
  async waitOpen(width: number): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.image).toHaveJSProperty("tagName", "IMG");
    await expect(this.image).toHaveJSProperty("naturalWidth", width);
  }

  /** The transform as rendered: `translate(Xpx, Ypx) scale(Z)` on the stage. */
  async state(): Promise<LightboxState> {
    const transform = await this.stage.evaluate((el) => (el as HTMLElement).style.transform);
    const match = transform.match(
      /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\((-?[\d.]+)\)/,
    );
    if (!match) throw new Error(`unexpected lightbox transform: ${transform}`);
    return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
  }

  async zoom(): Promise<number> {
    return (await this.state()).zoom;
  }

  async zoomIn(): Promise<void> {
    await this.zoomInButton.click();
  }

  async reset(): Promise<void> {
    await this.resetButton.click();
  }

  /** Drags the image from the middle of the canvas by (dx, dy) with the mouse. */
  async pan(dx: number, dy: number): Promise<void> {
    const box = await this.viewport.boundingBox();
    if (!box) throw new Error("the lightbox canvas has no box");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x + dx, y + dy, { steps: 8 });
    await this.page.mouse.up();
  }

  /** Closes with Escape, the way the dialog documents it. */
  async close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.root).toBeHidden();
  }
}
