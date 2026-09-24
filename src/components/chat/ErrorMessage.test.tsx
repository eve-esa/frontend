import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";

vi.mock("@/services/axios", () => ({ default: { post: vi.fn() } }));

const render = async (flag?: string) => {
  stubRuntimeConfig(flag === undefined ? {} : { FEATURE_REPORT_BUG: flag });
  const { ErrorMessage } = await import("./ErrorMessage");
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ErrorMessage onRetry={() => undefined} />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ErrorMessage report a bug entry", () => {
  it("is absent when FEATURE_REPORT_BUG is unset", async () => {
    expect(await render()).not.toContain("Report a bug");
  });

  it("is absent when FEATURE_REPORT_BUG is false", async () => {
    expect(await render("false")).not.toContain("Report a bug");
  });

  it("is there when FEATURE_REPORT_BUG is true", async () => {
    const html = await render("true");
    expect(html).toContain('data-testid="error-report-bug"');
    expect(html).toContain("Report a bug");
    expect(html).toContain("Retry");
  });
});
