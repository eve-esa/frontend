import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import { installMemoryLocalStorage } from "@/test-utils/memoryLocalStorage";
import { LOCAL_STORAGE_WELCOME_DIALOG_VIEWED } from "@/utilities/localStorage";

/**
 * The required profile dialog and the gate that mounts it. Radix renders
 * dialog content in a portal, which never renders on the server, so the
 * Dialog kit is replaced by inline wrappers that record the props they get:
 * that is how the ways out of the dialog (close button, Escape, outside
 * click, onOpenChange) are checked without a DOM.
 */
type Recorded = Record<string, unknown>;
const dialogProps: Recorded[] = [];
const contentProps: Recorded[] = [];
const profile = vi.hoisted(() => ({
  current: { email: "dev@eve.example.com", first_name: "Ada" } as Record<string, unknown>,
  enabledArgs: [] as unknown[],
}));

vi.mock("@/services/axios", () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
vi.mock("@/services/useLogout", () => ({
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/services/useMe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/useMe")>()),
  useGetProfile: (options?: { enabled?: boolean }) => {
    profile.enabledArgs.push(options?.enabled);
    return { data: profile.current, isLoading: false };
  },
}));
vi.mock("@/utilities/routes", () => ({
  routes: { EMPTY_CHAT: { path: "/" }, ONBOARDING: { path: "/onboarding" } },
}));
vi.mock("@/components/ui/Dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ children, ...props }: { children?: ReactNode }) => {
      dialogProps.push(props);
      return <div>{children}</div>;
    },
    DialogContent: ({
      children,
      ...props
    }: { children?: ReactNode; "data-testid"?: string }) => {
      contentProps.push(props);
      return <div data-testid={props["data-testid"]}>{children}</div>;
    },
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
  };
});

const providers = (node: ReactNode, path = "/") => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
  </QueryClientProvider>
);

const renderGate = async (
  config: Record<string, string>,
  opts: { path?: string; tourRunning?: boolean } = {},
) => {
  stubRuntimeConfig(config);
  const { ProfileRequiredGate } = await import("./ProfileRequiredGate");
  return renderToStaticMarkup(
    providers(<ProfileRequiredGate tourRunning={opts.tourRunning ?? false} />, opts.path),
  );
};

let storage: ReturnType<typeof installMemoryLocalStorage>;

beforeEach(() => {
  dialogProps.length = 0;
  contentProps.length = 0;
  profile.enabledArgs.length = 0;
  profile.current = { email: "dev@eve.example.com", first_name: "Ada", country: "Italy" };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const installStorage = () => {
  storage = installMemoryLocalStorage();
};

describe("ProfileRequiredDialog", () => {
  const render = async () => {
    stubRuntimeConfig({ FEATURE_PROFILE_FIELDS: "true" });
    const { ProfileRequiredDialog } = await import("./ProfileRequiredDialog");
    return renderToStaticMarkup(
      providers(
        <ProfileRequiredDialog
          profile={{ email: "dev@eve.example.com", country: "Italy", institution: null }}
          onSaved={vi.fn()}
        />,
      ),
    );
  };

  it("renders the country picker, the institution input, save and logout under their test ids", async () => {
    const html = await render();
    expect(html).toContain('data-testid="profile-required-dialog"');
    expect(html).toContain('data-testid="profile-required-country"');
    expect(html).toContain('data-testid="profile-required-institution"');
    expect(html).toContain('data-testid="profile-required-save"');
    expect(html).toContain('data-testid="profile-required-logout"');
    // Uncontrolled inputs render no value on the server, so the prefill is not
    // visible here; save starts disabled until the schema has run.
    expect(html).toMatch(/disabled=""[^>]*data-testid="profile-required-save"/);
    expect(html).toMatch(/<select id="profile-required-country"/);
    expect(html).toMatch(/maxLength="200"/);
  });

  it("cannot be dismissed: no close button, Escape and outside clicks are cancelled", async () => {
    await render();
    const content = contentProps[0];
    expect(content.showCloseButton).toBe(false);
    for (const handler of ["onEscapeKeyDown", "onPointerDownOutside", "onInteractOutside"]) {
      const event = { preventDefault: vi.fn() };
      (content[handler] as (e: unknown) => void)(event);
      expect(event.preventDefault, handler).toHaveBeenCalledOnce();
    }
    expect(dialogProps[0].open).toBe(true);
    // onOpenChange(false) is what Radix calls on any close attempt: it must change nothing.
    expect((dialogProps[0].onOpenChange as (open: boolean) => unknown)(false)).toBeUndefined();
  });
});

describe("ProfileRequiredGate", () => {
  beforeEach(() => {
    installStorage();
  });

  it("renders nothing and keeps the profile query off with FEATURE_PROFILE_FIELDS off", async () => {
    const html = await renderGate({});
    expect(html).toBe("");
    expect(profile.enabledArgs).toEqual([false]);
  });

  it("shows the dialog with the flag on and the institution missing", async () => {
    const html = await renderGate({ FEATURE_PROFILE_FIELDS: "true" });
    expect(html).toContain('data-testid="profile-required-dialog"');
  });

  it("shows nothing for a complete profile", async () => {
    profile.current = { ...profile.current, institution: "ESA" };
    expect(await renderGate({ FEATURE_PROFILE_FIELDS: "true" })).toBe("");
  });

  it("waits on the onboarding page and while the tour runs", async () => {
    expect(await renderGate({ FEATURE_PROFILE_FIELDS: "true" }, { path: "/onboarding" })).toBe("");
    expect(await renderGate({ FEATURE_PROFILE_FIELDS: "true" }, { tourRunning: true })).toBe("");
  });

  it("waits for the welcome dialog on the empty chat, and not once it was closed", async () => {
    const both = { FEATURE_PROFILE_FIELDS: "true", FEATURE_WELCOME_DIALOG: "true" };
    expect(await renderGate(both)).toBe("");
    expect(await renderGate(both, { path: "/chat/abc" })).toContain("profile-required-dialog");
    storage.setItem(LOCAL_STORAGE_WELCOME_DIALOG_VIEWED, "true");
    expect(await renderGate(both)).toContain("profile-required-dialog");
  });
});
