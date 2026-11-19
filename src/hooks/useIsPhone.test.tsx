import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const Probe = async () => {
  const { useIsPhone } = await import("./useIsPhone");
  const Component = () => <span>{useIsPhone() ? "phone" : "wide"}</span>;
  return renderToStaticMarkup(<Component />);
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("useIsPhone", () => {
  it("is true below the md breakpoint (48rem)", async () => {
    const matchMedia = vi.fn((query: string) => ({ matches: query === "(width < 48rem)" }));
    vi.stubGlobal("window", { matchMedia });
    expect(await Probe()).toContain("phone");
    expect(matchMedia).toHaveBeenCalledWith("(width < 48rem)");
  });

  it("is false from md up, and without matchMedia", async () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    expect(await Probe()).toContain("wide");
    vi.resetModules();
    vi.stubGlobal("window", {});
    expect(await Probe()).toContain("wide");
  });
});
