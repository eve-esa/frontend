import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * External images through the whole Streamdown pipeline: markdown images, raw
 * html images, gallery tiles and linked images all stay placeholders until the
 * user approves them. The click itself is covered in AuthenticatedImage.test
 * (no DOM in this test environment).
 */
vi.mock("@/services/useImageBlob", () => ({
  useImageBlob: () => ({ data: undefined, isLoading: true, isError: false }),
}));

import StreamdownText from "./StreamdownText";
import {
  approveExternalImage,
  resetApprovedExternalImages,
} from "./AuthenticatedImage";

const render = (text: string) => renderToStaticMarkup(<StreamdownText text={text} />);
const EXTERNAL = "https://attacker.test/x.png?d=secret";

beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: "https://app.example.test" } });
  vi.stubEnv("VITE_API_URL", "/api");
  resetApprovedExternalImages();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("StreamdownText external images", () => {
  it("renders a markdown image on another host as a placeholder", () => {
    const html = render(`See ![chart](${EXTERNAL}) here.`);

    expect(html).toContain('data-testid="external-image-load"');
    expect(html).not.toContain("<img");
  });

  it("renders a raw html image on another host as a placeholder", () => {
    const html = render(`<img src="${EXTERNAL}" alt="chart">`);

    expect(html).toContain('data-testid="external-image-load"');
    expect(html).not.toContain("<img");
  });

  it("keeps gallery tiles tile-sized while they are placeholders", () => {
    const html = render(
      "![a](https://attacker.test/a.png) ![b](https://attacker.test/b.png)",
    );

    expect(html).toContain('data-testid="markdown-image-gallery"');
    expect(html.match(/data-testid="external-image-load"/g)).toHaveLength(2);
    expect(html).toContain("aspect-[4/3]");
    expect(html).not.toContain("<img");
  });

  it("keeps a linked external image a placeholder", () => {
    const html = render(`[![chart](${EXTERNAL})](https://attacker.test/page)`);

    expect(html).toContain('data-testid="external-image-load"');
    expect(html).not.toContain("<img");
  });

  it("loads an approved external image without a referrer", () => {
    approveExternalImage(EXTERNAL);
    const html = render(`![chart](${EXTERNAL})`);

    expect(html).toContain("<img");
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).not.toContain('data-testid="external-image-load"');
  });
});
