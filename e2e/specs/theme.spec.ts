import type { Locator, Page } from "@playwright/test";
import { type ChatPage, flagOn, ThemeMenu, themeSwitchOn } from "../pages";
import { expect, test } from "../fixtures";
import { contrastRatio, MIN_CONTRAST } from "../fixtures/contrast";
import { QUESTION } from "./conversation";

// The operating system asks for light in every test; the choice in the menu must win over it.
test.use({ colorScheme: "light" });

// The light theme keeps the dark theme's structure: same corner radius, edge widths, shadow
// and blur on every surface; only colours change (owner, 2026-10-28). The agent trace step card
// is the one exception: square in both themes.
//
// docs/BRAND.md, light theme: placeholder #757575, control border Silver +1 #748D9C, focus
// #008E7A (keyboard focus only), card and source card edge Silver #8197A6, user bubble edge Deep
// Space -1 #335E6F, composer a white card with a Deep Space -1 #335E6F edge at 2px, chat ground
// #F5F5F5, sidebar white, menus white, dialog scrim Deep Space at 40 %, primary fill Deep Space
// #003247 (the Trace button too, filled as in dark). Computed styles serialize as rgb() and rgba().
const PLACEHOLDER = "rgb(117, 117, 117)";
const CONTROL = "rgb(116, 141, 156)";
// The model picker trigger edge is control at 60 %, as in dark (`border-control/60`).
const CONTROL_60 = "rgb(116 141 156 / 0.6)";
const WHITE = "rgb(255, 255, 255)";
const SCRIM = "rgba(0, 50, 71, 0.4)";
const DEEP_SPACE = "rgb(0, 50, 71)";
const FOCUS = "rgb(0, 142, 122)";
const CARD_EDGE = "rgb(129, 151, 166)";
const BUBBLE_EDGE = "rgb(51, 94, 111)";
const COMPOSER_EDGE = "rgb(51, 94, 111)";
const CHAT_GROUND = "rgb(245, 245, 245)";
// Computed style reads poll up to this long: a remount or a colour transition settles first.
const READ_TIMEOUT = 10_000;

const style = (
  locator: Locator,
  property:
    | "borderTopColor"
    | "borderTopWidth"
    | "borderLeftColor"
    | "borderTopLeftRadius"
    | "boxShadow"
    | "backgroundColor"
    | "backdropFilter",
) => locator.evaluate((element, property) => getComputedStyle(element)[property], property);

/** What the light theme must copy from dark: corners, edge widths, shadow presence, blur. */
type Shape = { radius: string; edges: string; shadow: boolean; backdrop: string };

/**
 * Where the read lands inside the located element. Two surfaces carry no test id of their own
 * yet: the user bubble is the first child of the message row (`message` > row > bubble) and the
 * scroll-to-bottom button is the chat ground's element with `data-show-scroll-button`.
 */
type Target = "self" | "user-bubble" | "scroll-button";

const shapeOf = (locator: Locator, target: Target = "self"): Promise<Shape | null> =>
  locator.evaluate((element, target) => {
    const node =
      target === "user-bubble"
        ? element.firstElementChild?.firstElementChild
        : target === "scroll-button"
          ? element.querySelector("[data-show-scroll-button]")
          : element;
    if (!node) return null;
    const css = getComputedStyle(node);
    // Same rule as paintsShadow: transparent or zero sized layers paint nothing.
    const shadow =
      css.boxShadow !== "none" &&
      css.boxShadow.split(/,(?![^()]*\))/).some((layer) => {
        const transparent = /rgba\([^()]*,\s*0\)|transparent/.test(layer);
        const sizes = (layer.replace(/\([^()]*\)/g, "").match(/-?[\d.]+px/g) ?? []).map(
          parseFloat,
        );
        return !transparent && sizes.some((size) => size !== 0);
      });
    return {
      radius: [
        css.borderTopLeftRadius,
        css.borderTopRightRadius,
        css.borderBottomRightRadius,
        css.borderBottomLeftRadius,
      ].join(" "),
      edges: [
        css.borderTopWidth,
        css.borderRightWidth,
        css.borderBottomWidth,
        css.borderLeftWidth,
      ].join(" "),
      shadow,
      backdrop: css.backdropFilter,
    };
  }, target);

/**
 * The colour the element stands on: its own background, else the first ancestor's that paints
 * one. A ground can be painted on the element or on a wrapper: either way this is what shows.
 */
const ground = (locator: Locator) =>
  locator.evaluate((element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      if (color !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(color)) return color;
    }
    return "transparent";
  });

/**
 * How far the computed `property` of `locator` is from the `expected` CSS colour: the largest
 * gap over red, green, blue and alpha, in 0 to 255 steps. An alpha mix computes as oklab(), not
 * rgba(), so a string compare cannot work: both colours are painted on a 1x1 canvas and the
 * pixels are compared. Both go through the same premultiplied rounding, which a 1 step tolerance
 * covers.
 */
const colourGap = (locator: Locator, property: "borderTopColor", expected: string) =>
  locator.evaluate(
    (element, [property, expected]) => {
      const pixel = (color: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return [NaN, NaN, NaN, NaN];
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      const actual = pixel(getComputedStyle(element)[property as "borderTopColor"]);
      const wanted = pixel(expected);
      return Math.max(...actual.map((value, index) => Math.abs(value - wanted[index])));
    },
    [property, expected] as const,
  );

/** Keyboard focus on `locator`: Tab away and back, so the browser marks it :focus-visible. */
const keyboardFocus = async (page: Page, locator: Locator) => {
  await locator.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(locator).toBeFocused();
};

/**
 * A turn of this test's own: new chat, a retrieval question, wait for the answer. The newest
 * conversation on the shared account can be one another spec stopped before any answer.
 */
/**
 * Whether the target serves the model picker. Same reading as the other flag specs: the served
 * config, else the code default (on); the dev server injects no config.
 */
const modelPickerOn = async (chat: ChatPage) =>
  flagOn(await chat.servedConfig(), "FEATURE_MODEL_PICKER", true);

const ownTurn = async (chat: ChatPage) => {
  await chat.newChat();
  await chat.composer.send(QUESTION);
  // Stop shows for a moment while the conversation is created, before the stream opens: an
  // idle wait right after send can pass there, and a New chat clicked mid-stream is lost.
  // The answer text proves the stream is open, then the idle wait covers its end.
  await expect(chat.messages.last.getByTestId("message-answer")).toBeVisible({
    timeout: 60_000,
  });
  await chat.composer.waitIdle();
};

test.describe("theme switch", () => {
  test.beforeEach(async ({ chat }) => {
    test.skip(
      !themeSwitchOn(await chat.servedConfig()),
      "FEATURE_THEME_SWITCH is off in the served config",
    );
  });

  test("a light OS with nothing stored opens light before the app renders", async ({
    chat,
    authedPage: page,
  }) => {
    const theme = new ThemeMenu(page, chat);
    await page.evaluate(() => localStorage.removeItem("theme"));
    // Records whether the attribute was set while the React root was still empty: set there,
    // the first paint is already light.
    await page.addInitScript(() => {
      const w = window as unknown as { __themeBeforeApp?: boolean };
      new MutationObserver((_records, observer) => {
        if (!document.documentElement?.hasAttribute("data-theme")) return;
        w.__themeBeforeApp = !document.getElementById("root")?.hasChildNodes();
        observer.disconnect();
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-theme"] });
    });
    await chat.goto();

    await theme.expectTheme("light");
    expect(await theme.stored()).toBeNull();
    const beforeApp = await page.evaluate(
      () => (window as unknown as { __themeBeforeApp?: boolean }).__themeBeforeApp,
    );
    expect(beforeApp, "data-theme set before the app rendered").toBe(true);
  });

  test("Dark stays dark after a reload, on a light OS", async ({ chat, authedPage: page }) => {
    const theme = new ThemeMenu(page, chat);
    await theme.pick("dark");
    await theme.expectTheme("dark");
    expect(await theme.stored()).toBe("dark");

    await page.reload();
    await chat.composer.waitReady();
    await theme.expectTheme("dark");
    expect(await theme.stored()).toBe("dark");
    // ESA guidelines: the white logotype on dark.
    await expect(page.getByTestId("brand-logo").first()).toHaveAttribute("src", /esa_phi_lab_1/);
    await expect(page.getByTestId("sidebar-toggle-icon").first()).toHaveAttribute(
      "src",
      // A file in dev, a data URI in a build (Vite inlines assets under 4 kB).
      /sidebar\.svg|white/,
    );
  });

  test("System follows the OS while the app is open", async ({ chat, authedPage: page }) => {
    const theme = new ThemeMenu(page, chat);
    await theme.pick("system");
    expect(await theme.stored()).toBe("system");
    await theme.expectTheme("light");

    await page.emulateMedia({ colorScheme: "dark" });
    await theme.expectTheme("dark");
    await page.emulateMedia({ colorScheme: "light" });
    await theme.expectTheme("light");
  });

  test("Light keeps text readable on chat, sidebar, composer, menu and toasts", async ({
    chat,
    profile,
    authedPage: page,
  }) => {
    const theme = new ThemeMenu(page, chat);
    await theme.pick("light");
    await theme.expectTheme("light");
    // ESA guidelines: the Deep Space logotype on light.
    await expect(page.getByTestId("brand-logo").first()).toHaveAttribute("src", /esa_phi_lab_ds/);
    await expect(page.getByTestId("sidebar-toggle-icon").first()).toHaveAttribute(
      "src",
      /sidebar_ds|003247/,
    );

    const readable = async (name: string, locator: Parameters<typeof contrastRatio>[0]) => {
      await expect(locator).toBeVisible();
      const ratio = await contrastRatio(locator);
      expect(ratio, `${name}: contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        MIN_CONTRAST,
      );
    };

    await ownTurn(chat);
    await readable("answer text", chat.messages.last.getByTestId("message-answer"));
    // Link text is Pure Teal +2 in light, never Pure Teal. Without a link in this answer, the
    // same token on the trace's tool status.
    const link = chat.messages.last.getByTestId("message-answer").getByTestId("smart-text-link");
    if ((await link.count()) > 0) {
      await readable("answer link", link.first());
    } else {
      const traceButton = chat.messages.last.getByTestId("message-trace-button");
      await expect(traceButton, "the answer has neither a link nor a trace").toBeVisible();
      await traceButton.click();
      await readable(
        "trace tool status",
        page.getByTestId("trace-tool-status").filter({ hasText: "Success" }).first(),
      );
      await traceButton.click();
    }
    await readable("sidebar entry", page.getByTestId("conversation-title").first());
    await readable("composer input", chat.composer.input);

    await chat.userMenu.click();
    await readable("menu item", page.getByTestId("user-menu-profile"));
    await readable("theme option", theme.option("light"));
    await page.keyboard.press("Escape");

    // Toasts from the profile save, answered here so nothing is written.
    let fail = false;
    await page.route(
      (url) => url.pathname.endsWith("/users"),
      (route) =>
        route.request().method() !== "PATCH"
          ? route.fallback()
          : route.fulfill(
              fail
                ? {
                    status: 500,
                    contentType: "application/json",
                    body: JSON.stringify({ detail: "Profile update failed" }),
                  }
                : { status: 200, contentType: "application/json", body: "{}" },
            ),
    );
    await profile.open();
    await profile.fill({ firstName: `${(await profile.read()).firstName} e2e` });
    await profile.save();
    await readable("success toast", page.getByTestId("toast-profile-updated"));

    fail = true;
    await profile.open();
    await profile.fill({ firstName: `${(await profile.read()).firstName} e2e` });
    await profile.saveButton.click();
    await readable("error toast", page.getByTestId("toast-profile-error"));
    await profile.close();
  });
  test("Light gives fields a readable placeholder, control borders and teal focus on the keyboard only", async ({
    chat,
    profile,
    apiKeys,
    authedPage: page,
  }) => {
    const theme = new ThemeMenu(page, chat);
    await theme.pick("light");
    await theme.expectTheme("light");
    await chat.newChat();

    await test.step("composer placeholder is the light placeholder grey at 4.5:1", async () => {
      await expect(chat.composer.input).toHaveValue("");
      // A detached element computes to "": poll until the mounted composer answers.
      await expect
        .poll(
          () =>
            chat.composer.input.evaluate(
              (element) => getComputedStyle(element, "::placeholder").color,
            ),
          { timeout: READ_TIMEOUT },
        )
        .toBe(PLACEHOLDER);
      let ratio = 0;
      await expect
        .poll(
          async () => (ratio = await contrastRatio(chat.composer.input, "::placeholder")),
          { message: "placeholder contrast", timeout: READ_TIMEOUT },
        )
        .toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(ratio, `placeholder: contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        MIN_CONTRAST,
      );
    });

    await test.step("keyboard focus is teal on a button and on the composer", async () => {
      await keyboardFocus(page, chat.newChatButton);
      await expect
        .poll(() => style(chat.newChatButton, "boxShadow"), { timeout: READ_TIMEOUT })
        .toContain(FOCUS);
      await keyboardFocus(page, chat.composer.input);
      await expect
        .poll(() => style(chat.composer.box, "borderTopColor"), {
          timeout: READ_TIMEOUT,
        })
        .toBe(FOCUS);
      await chat.composer.input.blur();
    });

    await test.step("composer is a white card, edge Deep Space -1 at 2px at rest", async () => {
      const box = chat.composer.box;
      await expect
        .poll(() => style(box, "backgroundColor"), { timeout: READ_TIMEOUT })
        .toBe(WHITE);
      await expect
        .poll(() => style(box, "borderTopColor"), { timeout: READ_TIMEOUT })
        .toBe(COMPOSER_EDGE);
      await expect
        .poll(() => style(box, "borderTopWidth"), { timeout: READ_TIMEOUT })
        .toBe("2px");
    });

    await test.step("chat ground is grey, sidebar ground is white", async () => {
      await expect(chat.chatGround).toBeVisible();
      await expect
        .poll(() => ground(chat.chatGround), { timeout: READ_TIMEOUT })
        .toBe(CHAT_GROUND);
      await expect(chat.sidebarToggleIcon).toBeAttached();
      await expect
        .poll(() => ground(chat.sidebarToggleIcon), { timeout: READ_TIMEOUT })
        .toBe(WHITE);
    });

    await test.step("model picker trigger has the control border at 60 %, as in dark", async () => {
      if (!(await modelPickerOn(chat))) {
        // Off in the served config: the trigger must be absent, nothing else to read.
        await expect(chat.composer.modelPicker).toBeHidden();
        return;
      }
      await expect(chat.composer.modelPicker).toBeVisible();
      await expect
        .poll(() => colourGap(chat.composer.modelPicker, "borderTopColor", CONTROL_60), {
          message: "model picker edge is control #748D9C at 60 %",
          timeout: READ_TIMEOUT,
        })
        .toBeLessThanOrEqual(1);
    });

    await test.step("a mouse click on Knowledge Base leaves no teal ring, the keyboard does", async () => {
      const trigger = page.getByTestId("knowledge-base-menu");
      const ring = async () => {
        const [shadow, outline] = await Promise.all([
          style(trigger, "boxShadow"),
          trigger.evaluate((element) => getComputedStyle(element).outlineColor),
        ]);
        return shadow.includes(FOCUS) || outline === FOCUS;
      };
      await expect(trigger).toBeVisible();
      await trigger.click();
      // Open first, so the read sees the trigger after the click has fully landed.
      await expect(trigger).toHaveAttribute("data-state", "open");
      expect(await ring(), "teal ring after a mouse click, open").toBe(false);
      // Closed by the mouse too: Escape is a key press and would earn the ring.
      await trigger.click();
      await expect(trigger).toHaveAttribute("data-state", "closed");
      await page.mouse.move(0, 0);
      expect(await ring(), "teal ring after a mouse click, closed").toBe(false);
      await keyboardFocus(page, trigger);
      await expect.poll(ring, { timeout: READ_TIMEOUT }).toBe(true);
      await trigger.blur();
    });

    const institutionShown = await test.step("an input in the profile dialog has the control border", async () => {
      await profile.open();
      await expect(profile.firstName).toBeVisible();
      await profile.firstName.blur();
      await expect
        .poll(() => style(profile.firstName, "borderTopColor"), { timeout: READ_TIMEOUT })
        .toBe(CONTROL);
      const shown = await profile.institution.isVisible();
      // Without Institution the dialog has no empty field to read: the next step uses another.
      if (!shown) await profile.close();
      return shown;
    });

    await test.step("a field outside the composer keeps the light placeholder grey", async () => {
      // The read needs an empty field with a placeholder attribute: on a filled one the
      // ::placeholder pseudo element is not rendered and the computed style is the text colour.
      // Institution has one but exists only with FEATURE_PROFILE_FIELDS; without it, the name
      // field of the API key create form. Each is left by Cancel or Close, nothing is written.
      const placeholderOf = (field: Locator) =>
        field.evaluate((element) => getComputedStyle(element, "::placeholder").color);
      if (institutionShown) {
        await expect(profile.institution).toHaveAttribute("placeholder", /\S/);
        await profile.institution.fill("");
        await expect(profile.institution).toHaveValue("");
        await expect
          .poll(() => placeholderOf(profile.institution), { timeout: READ_TIMEOUT })
          .toBe(PLACEHOLDER);
        await profile.close();
        return;
      }
      expect(
        await apiKeys.isEntryVisible(),
        "neither the Institution field nor the API keys entry is served",
      ).toBe(true);
      await apiKeys.open();
      await apiKeys.openCreateForm();
      await expect(apiKeys.nameInput).toHaveAttribute("placeholder", /\S/);
      await expect(apiKeys.nameInput).toHaveValue("");
      await expect
        .poll(() => placeholderOf(apiKeys.nameInput), { timeout: READ_TIMEOUT })
        .toBe(PLACEHOLDER);
      // Close lives in the list view only: Cancel the form first.
      await apiKeys.cancelCreateForm();
      await apiKeys.close();
    });
  });

  test("Light keeps menus opaque white and tints the scrim Deep Space", async ({
    chat,
    profile,
    authedPage: page,
  }) => {
    const theme = new ThemeMenu(page, chat);
    await theme.pick("light");
    await theme.expectTheme("light");

    await test.step("model picker menu is opaque white", async () => {
      if (!(await modelPickerOn(chat))) {
        // Off in the served config: the trigger must be absent, nothing else to read.
        await expect(chat.composer.modelPicker).toBeHidden();
        return;
      }
      await expect(chat.composer.modelPicker).toBeVisible();
      await chat.composer.modelPicker.click();
      const menu = page.getByTestId("composer-model-picker-menu");
      await expect(menu).toBeVisible();
      await expect
        .poll(() => style(menu, "backgroundColor"), { timeout: READ_TIMEOUT })
        .toBe(WHITE);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
    });

    await test.step("dialog scrim is Deep Space at 40 %", async () => {
      await profile.open();
      await expect(profile.firstName).toBeVisible();
      await expect
        .poll(() => style(page.getByTestId("dialog-overlay"), "backgroundColor"), {
          timeout: READ_TIMEOUT,
        })
        .toBe(SCRIM);
      await profile.close();
    });
  });

  test("Light mirrors the dark shape of every surface; only colours change", async ({
    chat,
    profile,
    authedPage: page,
  }) => {
    const theme = new ThemeMenu(page, chat);
    // Stored choice plus a reload: the same page in each theme, nothing carried over in memory.
    const switchTo = async (choice: "light" | "dark") => {
      await page.evaluate((choice) => localStorage.setItem("theme", choice), choice);
      await page.reload();
      await chat.composer.waitReady();
      await theme.expectTheme(choice);
      await expect(chat.messages.last).toBeVisible({ timeout: 30_000 });
    };
    // Profile saves answered here, so the toast shows and nothing is written.
    await page.route(
      (url) => url.pathname.endsWith("/users"),
      (route) =>
        route.request().method() !== "PATCH"
          ? route.fallback()
          : route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );

    // A turn of its own: user bubble, footer buttons and a sidebar row to read.
    await ownTurn(chat);

    const trace = chat.messages.last.getByTestId("message-trace-button");
    const report = chat.messages.last.getByTestId("message-report-bug-button");

    /** Every surface's shape in the current theme, and the Trace fill closed and open. */
    const measure = async () => {
      const shapes: Record<string, Shape | null> = {};
      const read = async (
        name: string,
        locator: Locator,
        target: Target = "self",
        optional = false,
      ) => {
        // No hover and no focus ring in the reading: both change the shadow on purpose.
        await page.mouse.move(0, 0);
        await expect(locator).toBeAttached();
        const shape = await shapeOf(locator, target);
        if (shape === null && optional) return;
        expect(shape, `${name}: nothing to read`).not.toBeNull();
        shapes[name] = shape;
      };

      await read("user bubble", chat.messages.last, "user-bubble");
      await read("New chat button", chat.newChatButton);
      await read("sidebar row", chat.conversations.first());
      await read("sidebar row menu trigger", page.getByTestId("conversation-menubar").first());
      await read("Knowledge Base trigger", page.getByTestId("knowledge-base-menu"));
      // Rendered (faded out until the chat scrolls) with a conversation open: read if present.
      await read("scroll-to-bottom button", chat.chatGround, "scroll-button", true);
      if ((await report.count()) > 0) await read("Report a bug button", report);

      const traceFill = { closed: "", open: "" };
      if ((await trace.count()) > 0) {
        await read("Trace button", trace);
        traceFill.closed = await style(trace, "backgroundColor");
        await trace.click();
        await page.mouse.move(0, 0);
        const step = page.getByTestId("trace-step").first();
        await expect(step).toBeVisible();
        // The exception to the mirror: the step card is square in both themes.
        await expect
          .poll(() => style(step, "borderTopLeftRadius"), { timeout: READ_TIMEOUT })
          .toBe("0px");
        await read("agent trace step card", step);
        traceFill.open = await style(trace, "backgroundColor");
        await trace.click();
        await page.mouse.move(0, 0);
      }

      if (await modelPickerOn(chat)) {
        await read("model picker trigger", chat.composer.modelPicker);
        await chat.composer.modelPicker.click();
        const menu = page.getByTestId("composer-model-picker-menu");
        await expect(menu).toBeVisible();
        await read("model picker menu", menu);
        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();
      }

      await profile.open();
      await expect(profile.firstName).toBeVisible();
      await read("dialog scrim", page.getByTestId("dialog-overlay"));
      await read("Profile dialog", profile.root);
      await profile.lastName.focus();
      await read("Profile first name input", profile.firstName);
      await profile.fill({ firstName: `${(await profile.read()).firstName} e2e` });
      await profile.save();
      const toast = page.getByTestId("toast-profile-updated");
      await expect(toast).toBeVisible();
      await read("toast", toast);
      return { shapes, traceFill };
    };

    await switchTo("dark");
    const dark = await measure();
    await switchTo("light");
    const light = await measure();

    await test.step("every surface has the same corners, edges, shadow and blur", () => {
      expect(Object.keys(light.shapes)).toEqual(Object.keys(dark.shapes));
      for (const [name, shape] of Object.entries(dark.shapes)) {
        expect.soft(light.shapes[name], `${name}: light differs from dark`).toEqual(shape);
      }
    });

    await test.step("user bubble edge is Deep Space -1 in light", async () => {
      const bubbleEdge = () =>
        chat.messages.last.evaluate((element) => {
          const bubble = element.firstElementChild?.firstElementChild;
          return bubble ? getComputedStyle(bubble).borderTopColor : "";
        });
      await expect.poll(bubbleEdge, { timeout: READ_TIMEOUT }).toBe(BUBBLE_EDGE);
    });

    await test.step("Trace is filled Deep Space in light, open as dark does it", () => {
      if (!dark.traceFill.closed) return;
      expect(light.traceFill.closed, "Trace fill, closed").toBe(DEEP_SPACE);
      // Dark keeps its fill when the trace opens, or changes it: light does the same.
      if (dark.traceFill.open === dark.traceFill.closed) {
        expect(light.traceFill.open, "Trace fill, open").toBe(light.traceFill.closed);
      } else {
        expect(light.traceFill.open, "Trace fill, open").not.toBe(light.traceFill.closed);
      }
    });
  });

  test("Light draws the source card edge as a card edge", async ({ chat, authedPage: page }) => {
    const theme = new ThemeMenu(page, chat);
    await theme.pick("light");
    await theme.expectTheme("light");
    await ownTurn(chat);
    await expect
      .poll(() => chat.messages.sourcesCount(), {
        message: "the retrieval question returned no sources",
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    await chat.messages.openSources();
    const card = page.getByTestId("source-content").first();
    await expect(card).toBeVisible();
    expect(await style(card, "borderLeftColor")).toBe(CARD_EDGE);
  });
});
