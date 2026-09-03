import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * AppVersion reads import.meta.env at MODULE scope, so stubbing has to happen
 * before the module is evaluated: resetModules plus a dynamic import, the same
 * shape src/test-utils/runtimeConfigStub.ts uses for the runtime config.
 *
 * Rendered with renderToStaticMarkup rather than a testing library: vitest runs
 * with environment "node" here and there is no DOM, and the whole component is
 * one string and one conditional.
 */
const renderAppVersion = async (version: string, commit: string) => {
  vi.resetModules();
  vi.stubEnv("VITE_APP_VERSION", version);
  vi.stubEnv("VITE_APP_COMMIT", commit);
  const { AppVersion } = await import("./AppVersion");
  return renderToStaticMarkup(<AppVersion />);
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AppVersion", () => {
  it("shows the version and the shortened commit", async () => {
    const html = await renderAppVersion("v1.2.3", "abc1234def5678");
    expect(html).toContain("v1.2.3 (abc1234)");
  });

  it("shortens the commit to seven characters", async () => {
    const html = await renderAppVersion("v1.2.3", "0123456789abcdef");
    expect(html).toContain("(0123456)");
    expect(html).not.toContain("789abcdef");
  });

  it("shows the version alone when there is no commit", async () => {
    const html = await renderAppVersion("v1.2.3", "");
    expect(html).toContain("v1.2.3");
    expect(html).not.toContain("(");
  });

  // The local case. Anything else would put the string "undefined" in front of
  // every developer, and it is also what keeps the profile dialog identical to
  // today when nothing is injected.
  it("renders nothing when neither value is set", async () => {
    expect(await renderAppVersion("", "")).toBe("");
  });

  // Trailing whitespace arrives easily from a shell variable in a workflow.
  it("ignores surrounding whitespace", async () => {
    const html = await renderAppVersion("  v1.2.3  ", "  abc1234  ");
    expect(html).toContain("v1.2.3 (abc1234)");
  });
});
