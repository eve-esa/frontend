import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { ConfigKey } from "@/utilities/runtimeConfig";

/**
 * The notice under the composer. Flag off: today's full statement, always. Flag on: none on the
 * empty chat, one short line with Learn more after the first answer; the Learn more dialog holds
 * today's full text word for word. Radix content never renders on the server, so the Dialog kit is
 * replaced by a pass-through that shows the dialog markup inline.
 */
vi.mock("@/components/ui/Dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Title = ({ children }: { children?: ReactNode }) => <h2>{children}</h2>;
  const Text = ({ children }: { children?: ReactNode }) => <p>{children}</p>;
  return {
    Dialog: Pass,
    DialogTrigger: Pass,
    DialogContent: ({ children, ...props }: { children?: ReactNode; "data-testid"?: string }) => (
      <div role="dialog" data-testid={props["data-testid"]}>
        {children}
      </div>
    ),
    DialogHeader: Pass,
    DialogFooter: Pass,
    DialogClose: Pass,
    DialogTitle: Title,
    DialogDescription: Text,
  };
});

const FULL_TEXT =
  "EVE outputs represent an automated synthesis and do not constitute statements by, or endorsements from, the original data providers or authors. EVE could make errors. Always check the content.";

const render = async (
  config: Partial<Record<ConfigKey, string>>,
  props: { show?: boolean } = {},
) => {
  stubRuntimeConfig(config);
  const { ComposerDisclaimer } = await import("./ComposerDisclaimer");
  return renderToStaticMarkup(<ComposerDisclaimer className="w-full" {...props} />);
};

const text = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ComposerDisclaimer", () => {
  it("flag off: the full statement, with or without messages, and no Learn more", async () => {
    for (const show of [false, true]) {
      const html = await render({}, { show });
      expect(text(html)).toBe(FULL_TEXT);
      expect(html).not.toContain("Learn more");
      expect(html).not.toContain("composer-disclaimer");
    }
  });

  it("flag on, empty chat: nothing", async () => {
    const html = await render({ FEATURE_MOBILE_COMPOSER: "true" }, { show: false });
    expect(html).toBe("");
  });

  it("flag on, after the first answer: one short line and a Learn more button", async () => {
    const html = await render({ FEATURE_MOBILE_COMPOSER: "true" }, { show: true });
    const line = html.match(/<p [^>]*data-testid="composer-disclaimer"[^>]*>/)?.[0];
    expect(line).toBeDefined();
    expect(line).toContain("text-xs");
    expect(html).toContain("EVE is AI and can make mistakes.");
    expect(html).toMatch(/<button [^>]*data-testid="disclaimer-learn-more"[^>]*>Learn more<\/button>/);
  });

  it("the dialog shows today's text unchanged, with a title and a Close button", async () => {
    const html = await render({ FEATURE_MOBILE_COMPOSER: "true" }, { show: true });
    expect(html).toContain("About EVE&#x27;s answers");
    expect(html).toContain(FULL_TEXT);
    expect(html).toMatch(/<button [^>]*data-testid="disclaimer-dialog-close"[^>]*>Close<\/button>/);
  });
});
