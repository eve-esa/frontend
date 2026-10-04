import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";

/**
 * Country and institution appear in the profile dialog only with
 * FEATURE_PROFILE_FIELDS on. Radix renders dialog content in a portal, which
 * never renders on the server, so the Dialog kit is replaced by inline
 * wrappers. What this covers is which inputs the dialog renders; the values
 * they are prefilled with and the body they send are covered by
 * useUpdateProfile.test.ts, since there is no DOM in this test environment.
 */
vi.mock("@/services/axios", () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
vi.mock("@/services/useMe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/useMe")>()),
  useGetProfile: () => ({
    data: {
      email: "dev@eve.example.com",
      first_name: "Ada",
      last_name: "Lovelace",
      country: "Italy",
      institution: null,
    },
    isLoading: false,
  }),
}));
vi.mock("@/components/ui/Dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Pass,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
  };
});

const render = async (flag?: string) => {
  stubRuntimeConfig(flag === undefined ? {} : { FEATURE_PROFILE_FIELDS: flag });
  const { ProfileDialog } = await import("./ProfileDialog");
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ProfileDialog isOpen={true} onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ProfileDialog country and institution", () => {
  it.each([undefined, "", "false"])(
    "are absent with FEATURE_PROFILE_FIELDS %s, and the name fields stay",
    async (flag) => {
      const html = await render(flag);
      expect(html).toContain("First Name");
      expect(html).toContain("Last Name");
      expect(html).not.toContain('data-testid="profile-country"');
      expect(html).not.toContain('data-testid="profile-institution"');
      expect(html).not.toContain("Country");
      expect(html).not.toContain("Institution");
    },
  );

  it("are two optional labelled inputs with FEATURE_PROFILE_FIELDS true", async () => {
    const html = await render("true");
    expect(html).toContain('data-testid="profile-country"');
    expect(html).toContain('data-testid="profile-institution"');
    expect(html).toMatch(/<label for="profile-country"[^>]*>.*Country/);
    expect(html).toMatch(/<label for="profile-institution"[^>]*>.*Institution/);
    expect(html).toMatch(/id="profile-country"[^>]*maxLength="100"|maxLength="100"[^>]*id="profile-country"/);
    expect(html).toMatch(/id="profile-institution"[^>]*maxLength="200"|maxLength="200"[^>]*id="profile-institution"/);
    expect(html).not.toMatch(/name="(country|institution)"[^>]*required/);
  });
});
