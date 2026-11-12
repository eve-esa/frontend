import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An image in an answer can point anywhere the model or a tool wrote. Only our
 * own origin, the API origin and inline raster data load by themselves; an
 * image on another host is a placeholder until the user clicks it, so injected
 * markdown cannot send data out with no click.
 */

const useImageBlob = vi.fn();
vi.mock("@/services/useImageBlob", () => ({
  useImageBlob: (src: string, enabled: boolean) => useImageBlob(src, enabled),
}));

import {
  AuthenticatedImage,
  ExternalImagePlaceholder,
  approveExternalImage,
  classifyImageSrc,
  resetApprovedExternalImages,
} from "./AuthenticatedImage";

const PAGE = "https://app.example.test";
const EXTERNAL = "https://attacker.test/x.png?d=secret";
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const SVG =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=";

const render = (src: string) =>
  renderToStaticMarkup(
    <AuthenticatedImage src={src} alt="a" data-testid="markdown-image" />,
  );

const findButton = (node: ReactNode): ReactElement<{ onClick?: () => void }> | null => {
  if (!isValidElement(node)) return null;
  if (node.type === "button") return node as ReactElement<{ onClick?: () => void }>;
  const children = (node.props as { children?: ReactNode }).children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findButton(child);
    if (found) return found;
  }
  return null;
};

beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: PAGE } });
  vi.stubEnv("VITE_API_URL", "/api");
  useImageBlob.mockReset();
  useImageBlob.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  resetApprovedExternalImages();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("classifyImageSrc", () => {
  it.each([
    ["/api/artifacts/abc", "authenticated"],
    [`${PAGE}/api/artifacts/abc`, "authenticated"],
    [PNG, "inline"],
    ["data:image/jpeg;base64,/9j/", "inline"],
    [`blob:${PAGE}/1234`, "inline"],
    [EXTERNAL, "external"],
    ["http://attacker.test/x.png", "external"],
    ["//attacker.test/x.png", "external"],
    ["/\\attacker.test/x.png", "external"],
    [SVG, "blocked"],
    ["data:image/svg+xml,<svg/>", "blocked"],
    ["data:text/html,<b>x</b>", "blocked"],
    ["javascript:alert(1)", "blocked"],
    ["blob:https://other.test/1234", "blocked"],
    ["", "blocked"],
  ])("%s is %s", (src, kind) => {
    expect(classifyImageSrc(src)).toBe(kind);
  });

  it("trusts an absolute API origin from VITE_API_URL", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test/api");
    expect(classifyImageSrc("https://api.example.test/api/artifacts/1")).toBe(
      "authenticated",
    );
    expect(classifyImageSrc("https://attacker.test/api/artifacts/1")).toBe(
      "external",
    );
  });
});

describe("AuthenticatedImage", () => {
  it("does not request an external image before the click", () => {
    const html = render(EXTERNAL);

    expect(html).not.toContain("<img");
    expect(html).not.toContain("attacker.test/x.png");
    expect(html).toContain('data-testid="external-image-load"');
    expect(html).toMatch(/data-testid="external-image-host"[^>]*>attacker\.test</);
    expect(useImageBlob).toHaveBeenCalledWith(EXTERNAL, false);
  });

  it("asks for the image only when the placeholder is clicked", () => {
    const onLoad = vi.fn();
    const button = findButton(
      ExternalImagePlaceholder({ host: "attacker.test", onLoad }),
    );

    expect(onLoad).not.toHaveBeenCalled();
    button?.props.onClick?.();
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("loads an external image once the user approved it, without a referrer", () => {
    approveExternalImage(EXTERNAL);
    const html = render(EXTERNAL);

    expect(html).toContain(`src="${EXTERNAL.replace("&", "&amp;")}"`);
    expect(html).toContain('referrerPolicy="no-referrer"');
    // Still tokenless: an external host never gets the authenticated fetch.
    expect(useImageBlob).toHaveBeenCalledWith(EXTERNAL, false);
  });

  it("an approval covers only its own URL", () => {
    approveExternalImage(EXTERNAL);
    expect(render("https://attacker.test/other.png")).not.toContain("<img");
  });

  it("loads an API image through the authenticated client", () => {
    useImageBlob.mockReturnValue({
      data: "blob:https://app.example.test/1",
      isLoading: false,
      isError: false,
    });
    const html = render("/api/artifacts/abc");

    expect(useImageBlob).toHaveBeenCalledWith("/api/artifacts/abc", true);
    expect(html).toContain('src="blob:https://app.example.test/1"');
    expect(html).not.toContain("external-image-load");
  });

  it("renders an allowed raster data image inline", () => {
    const html = render(PNG);

    expect(html).toContain(`src="${PNG}"`);
    expect(useImageBlob).toHaveBeenCalledWith(PNG, false);
  });

  it("never loads a data:image/svg+xml image inline", () => {
    const html = render(SVG);

    expect(html).not.toContain("<img");
    expect(html).not.toContain("svg+xml");
    expect(html).not.toContain("external-image-load");
    expect(html).toContain('data-testid="blocked-image-placeholder"');
  });

  it("does not offer to load an SVG even after an approval attempt", () => {
    approveExternalImage(SVG);
    expect(render(SVG)).not.toContain("<img");
  });
});
