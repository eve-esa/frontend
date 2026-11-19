import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouteErrorView } from "./RouteError";

describe("RouteErrorView", () => {
  it("renders the app error page with a reload button", () => {
    const html = renderToStaticMarkup(<RouteErrorView />);
    expect(html).toContain('data-testid="app-error"');
    expect(html).toContain('data-testid="app-error-reload"');
    expect(html).toContain("Something went wrong");
    expect(html).not.toContain("developer");
  });
});
