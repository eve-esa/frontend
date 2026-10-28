import type { Locator } from "@playwright/test";

/** WCAG 2.x AA for body text. */
export const MIN_CONTRAST = 4.5;

/**
 * Worst case contrast of the element's text against every color painted behind it. Walks up
 * the ancestors and stacks each painted background until an opaque one: a translucent fill
 * (`bg-primary-800/40`) blends over what is under it, and a gradient counts every stop. Colors
 * go through a canvas, so any CSS color syntax the build emits (rgb, oklch, color()) ends up
 * as sRGB bytes.
 */
export function contrastRatio(locator: Locator, pseudo?: "::placeholder"): Promise<number> {
  return locator.evaluate((element, pseudo) => {
    type Rgba = [number, number, number, number];
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
    const rgba = (css: string): Rgba => {
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
    const over = (top: Rgba, base: Rgba): Rgba => [
      top[0] * top[3] + base[0] * (1 - top[3]),
      top[1] * top[3] + base[1] * (1 - top[3]),
      top[2] * top[3] + base[2] * (1 - top[3]),
      1,
    ];
    const colorToken = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi;

    // Painted layers from the element outwards, each a list of candidate colors.
    const layers: Rgba[][] = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      const stops = (style.backgroundImage.match(colorToken) ?? []).map(rgba);
      const color = rgba(style.backgroundColor);
      const layer = stops.length ? stops : color[3] > 0 ? [color] : [];
      if (!layer.length) continue;
      layers.push(layer);
      if (layer.every((c) => c[3] === 1)) break;
    }

    // Composite from the outermost layer in, over the white canvas of an unpainted page.
    let backgrounds: Rgba[] = [[255, 255, 255, 1]];
    for (const layer of layers.reverse()) {
      backgrounds = backgrounds.flatMap((base) => layer.map((top) => over(top, base)));
    }

    // With a pseudo element, its text (a placeholder) on the element's own backgrounds.
    const text = rgba(getComputedStyle(element, pseudo ?? null).color);
    return Math.min(
      ...backgrounds.map((bg) => {
        // Text with alpha blends over the background.
        const fg = over(text, bg);
        const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
        return (hi + 0.05) / (lo + 0.05);
      }),
    );
  }, pseudo);
}

/**
 * Alpha a shadow colour needs to show on the dark ground. Tailwind's resting `shadow-xs` is
 * black at 5 %, invisible on dark; the light theme shows what dark shows, so it does not draw
 * it either (owner, 2026-10-28). Above this, a shadow counts as drawn in both themes.
 */
export const VISIBLE_SHADOW_ALPHA = 0.06;

/** Which node the shadow is read on, and how strong a layer must be to count. */
export type ShadowRead = {
  /** A layer counts only with a colour alpha above this; 0 counts any non-transparent layer. */
  minAlpha?: number;
  /** Read the nearest ancestor (or the element) matching this selector, e.g. a Menubar root. */
  closest?: string;
  /** Read every descendant matching this selector; true when any of them paints. */
  inside?: string;
};

/**
 * Whether the element paints a shadow: false for `none` and for a stack of layers that are
 * all transparent, zero sized or not above `minAlpha` (Tailwind's `shadow-none` keeps the ring
 * layers at `0 0 #0000`). Layer colours go through a canvas, so rgba(), oklab() and color()
 * all end up as one alpha byte. Throws when the node to read is missing.
 */
export function paintsShadow(locator: Locator, read: ShadowRead = {}): Promise<boolean> {
  return locator.evaluate(
    (element, { minAlpha = 0, closest, inside }) => {
      const nodes = inside
        ? [...element.querySelectorAll(inside)]
        : [closest ? element.closest(closest) : element];
      if (!nodes.length || nodes.some((node) => !node)) {
        throw new Error(`no node to read the shadow on (${inside ?? closest})`);
      }
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
      const alpha = (css: string): number => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        return ctx.getImageData(0, 0, 1, 1).data[3] / 255;
      };
      const colorToken = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b|transparent/i;
      return nodes.some((node) => {
        const value = getComputedStyle(node as Element).boxShadow;
        if (value === "none") return false;
        return value.split(/,(?![^()]*\))/).some((layer) => {
          const color = layer.match(colorToken)?.[0];
          // A layer without a colour paints in currentColor: opaque text colour, so it shows.
          const visible = color === undefined || alpha(color) > minAlpha;
          const sizes = (layer.replace(/\([^()]*\)/g, "").match(/-?[\d.]+px/g) ?? []).map(
            parseFloat,
          );
          return visible && sizes.some((size) => size !== 0);
        });
      });
    },
    read,
  );
}
