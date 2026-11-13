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

  it("are two labelled inputs with FEATURE_PROFILE_FIELDS true, required by the schema, not the markup", async () => {
    const html = await render("true");
    expect(html).toContain('data-testid="profile-country"');
    expect(html).toContain('data-testid="profile-institution"');
    expect(html).toMatch(/<label for="profile-country"[^>]*>.*Country/);
    expect(html).toMatch(/<label for="profile-institution"[^>]*>.*Institution/);
    expect(html).toMatch(/<select id="profile-country"/);
    expect(html).toContain('<option value="Italy" data-testid="profile-country-option">');
    expect(html).toMatch(/id="profile-institution"[^>]*maxLength="200"|maxLength="200"[^>]*id="profile-institution"/);
    expect(html).not.toMatch(/name="(country|institution)"[^>]*required/);
  });
});

describe("ProfileDialog keyboard order", () => {
  const tagOf = (html: string, testId: string) =>
    html.match(new RegExp(`<[a-z]+ [^>]*data-testid="${testId}"[^>]*>`))?.[0];

  it("lets the keyboard reach Cancel and Save, after the fields", async () => {
    const html = await render("true");
    const cancel = tagOf(html, "profile-cancel");
    const save = tagOf(html, "profile-save");
    expect(cancel).toBeDefined();
    expect(save).toBeDefined();
    expect(cancel).not.toMatch(/tabindex/i);
    expect(save).not.toMatch(/tabindex/i);

    // DOM order is tab order when no tabindex is set.
    const order = [
      "profile-first-name",
      "profile-last-name",
      "profile-country",
      "profile-institution",
      "profile-cancel",
      "profile-save",
    ].map((id) => html.indexOf(`data-testid="${id}"`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("ProfileDialog labels", () => {
  // No DOM here, so no getByLabelText: check the same association by hand.
  // Every label's `for` must name the id of a form control, which is what
  // gives the field its accessible name and makes the label clickable.
  it.each([undefined, "true"])(
    "point every label at a control with that id (FEATURE_PROFILE_FIELDS %s)",
    async (flag) => {
      const html = await render(flag);
      const targets = [...html.matchAll(/<label for="([^"]+)"/g)].map((m) => m[1]);
      expect(targets).toEqual(
        expect.arrayContaining(["profile-email", "profile-first-name", "profile-last-name"]),
      );
      for (const id of targets) {
        expect(html).toMatch(new RegExp(`<(input|select|textarea) [^>]*id="${id}"`));
      }
    },
  );

  it("keeps label text in phrasing content, not a paragraph", async () => {
    const html = await render("true");
    expect(html).not.toMatch(/<label[^>]*>\s*<p/);
  });

  it("marks the name fields valid when there is no error", async () => {
    const html = await render();
    for (const id of ["profile-first-name", "profile-last-name"]) {
      expect(html).toMatch(new RegExp(`<input [^>]*id="${id}"[^>]*aria-invalid="false"`));
    }
  });
});
