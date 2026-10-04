import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComposerBusyNotice } from "./ComposerBusyNotice";

describe("ComposerBusyNotice", () => {
  it("counts down while waiting", () => {
    const html = renderToStaticMarkup(
      <ComposerBusyNotice
        notice={{ conversationId: "c1", phase: "waiting", secondsLeft: 8 }}
      />,
    );
    expect(html).toContain('data-testid="composer-busy-notice"');
    expect(html).toContain("EVE is busy right now. Retrying in 8 s");
  });

  it("shows the final copy once the retry is refused", () => {
    const html = renderToStaticMarkup(
      <ComposerBusyNotice
        notice={{ conversationId: "c1", phase: "stopped", draft: null }}
      />,
    );
    expect(html).toContain("Still busy. Please try again in a moment");
  });

  it("renders nothing without a notice or after a canceled wait", () => {
    expect(renderToStaticMarkup(<ComposerBusyNotice notice={null} />)).toBe("");
    expect(
      renderToStaticMarkup(
        <ComposerBusyNotice
          notice={{ conversationId: "c1", phase: "canceled", draft: { text: "x" } }}
        />,
      ),
    ).toBe("");
  });
});
