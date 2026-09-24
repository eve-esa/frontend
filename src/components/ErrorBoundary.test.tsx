import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";

/**
 * Error boundaries do not run on the server renderer, so the crash page is
 * rendered through ErrorBoundaryFallback, which is exactly what the boundary
 * renders after it catches.
 */
vi.mock("@/services/axios", () => ({ default: { post: vi.fn() } }));

const render = async (flag?: string) => {
  stubRuntimeConfig(flag === undefined ? {} : { FEATURE_REPORT_BUG: flag });
  const { ErrorBoundaryFallback } = await import("./ErrorBoundary");
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ErrorBoundaryFallback error={null} errorInfo={null} />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ErrorBoundary fallback report a bug entry", () => {
  it("is absent when FEATURE_REPORT_BUG is unset", async () => {
    const html = await render();
    expect(html).toContain("Something went wrong");
    expect(html).not.toContain("Report a bug");
  });

  it("is absent when FEATURE_REPORT_BUG is false", async () => {
    expect(await render("false")).not.toContain("Report a bug");
  });

  it("is there when FEATURE_REPORT_BUG is true", async () => {
    const html = await render("true");
    expect(html).toContain("Something went wrong");
    expect(html).toContain('data-testid="error-report-bug"');
  });
});
