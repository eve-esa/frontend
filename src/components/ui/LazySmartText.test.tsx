import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LazySmartText from "./LazySmartText";

/**
 * renderToStaticMarkup in the Node environment, like TraceStepCard.test.tsx: a
 * suspended boundary renders its fallback, and a later render after the module
 * has loaded renders the markdown.
 */
describe("LazySmartText", () => {
  it("shows the raw text with the SmartText wrapper while the renderer loads", () => {
    const html = renderToStaticMarkup(
      <LazySmartText text={"**bold**\nnext line"} className="text-sm" />,
    );
    expect(html).toContain("smarttext");
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("text-sm");
    expect(html).toContain("**bold**\nnext line");
  });

  it("renders markdown once the renderer has loaded", async () => {
    renderToStaticMarkup(<LazySmartText text="**bold**" />);
    await import("./SmartText");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const html = renderToStaticMarkup(<LazySmartText text="**bold**" />);
    expect(html).toContain("<strong");
    expect(html).not.toContain("**bold**");
  });
});
