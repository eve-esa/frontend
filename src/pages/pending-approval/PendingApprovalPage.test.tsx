import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-oidc-context", () => ({
  useAuth: () => ({ user: { profile: { email: "user@example.com" } } }),
}));
vi.mock("@/components/auth/LogoutDialog", () => ({ LogoutDialog: () => null }));

describe("PendingApprovalPage", () => {
  it("renders the on hold text in the light token, readable on the dark gradient", async () => {
    const { PendingApprovalPage } = await import("./PendingApprovalPage");
    const html = renderToStaticMarkup(<PendingApprovalPage />);
    const message = html.match(
      /<p data-testid="pending-approval-message" class="([^"]*)">/,
    );
    expect(message?.[1].split(" ")).toContain("text-natural-200");
    expect(message?.[1]).not.toContain("text-natural-300");
    expect(html).toContain("Your account user@example.com is");
  });
});
