import { PendingApprovalPage } from "../pages";
import { expect, test } from "../fixtures";

/** WCAG 2.x AA for body text. */
const MIN_CONTRAST = 4.5;

test.describe("on hold page @prod", () => {
  test("a pending account sees the on hold text with readable contrast", async ({
    authedPage: page,
    api,
  }) => {
    // The real account is approved: its profile answers 200 through the API.
    expect((await api.get("/users/me")).status).toBe(200);

    // What the backend answers a signed-in account past the approval limit.
    await page.route(
      (url) => url.pathname.endsWith("/users/me"),
      (route) =>
        route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ detail: { code: "pending_approval" } }),
        }),
    );
    await page.goto("/");
    const pending = new PendingApprovalPage(page);
    await expect(pending.root).toBeVisible({ timeout: 30_000 });
    await expect(pending.message).toContainText("on hold");

    // Worst case of the text color against every color painted behind it (the page is a
    // gradient, so each stop counts). Colors go through a canvas, so any CSS color syntax
    // the build emits (rgb, oklch, color()) ends up as sRGB bytes.
    const ratio = await pending.message.evaluate((element) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
      const rgba = (css: string): [number, number, number, number] => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      const luminance = ([r, g, b]: number[]): number => {
        const lin = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      };
      const colorToken = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi;

      // Nearest ancestor that paints a background: its color or its gradient stops.
      let backgrounds: [number, number, number, number][] = [];
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        const stops = style.backgroundImage.match(colorToken) ?? [];
        const color = rgba(style.backgroundColor);
        if (stops.length) {
          backgrounds = stops.map(rgba);
          break;
        }
        if (color[3] > 0) {
          backgrounds = [color];
          break;
        }
      }
      if (!backgrounds.length) backgrounds = [[255, 255, 255, 1]];

      const text = rgba(getComputedStyle(element).color);
      return Math.min(
        ...backgrounds.map((bg) => {
          // Text with alpha blends over the background.
          const fg = [0, 1, 2].map((i) => text[i] * text[3] + bg[i] * (1 - text[3]));
          const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
          return (hi + 0.05) / (lo + 0.05);
        }),
      );
    });
    expect(ratio, `contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});
