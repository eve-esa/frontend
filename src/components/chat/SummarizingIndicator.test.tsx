import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SummarizingIndicator } from "./SummarizingIndicator";

describe("SummarizingIndicator", () => {
  it("is a polite status line with a spinner and no answer text", () => {
    const html = renderToStaticMarkup(<SummarizingIndicator />);

    expect(html).toContain('data-testid="summarizing-indicator"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Summarizing earlier messages…");
    expect(html).toContain("animate-spin");
    expect(html).not.toContain('data-testid="message-answer"');
  });
});
