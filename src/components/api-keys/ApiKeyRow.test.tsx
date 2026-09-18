import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApiKeyRow } from "./ApiKeyRow";
import type { ApiKey } from "@/types";

/**
 * Rendered with renderToStaticMarkup rather than a testing library, the same
 * shape as AppVersion.test.tsx: vitest runs with environment "node" here and
 * there is no DOM. ApiKeyRow takes props only and calls no hooks, so this is
 * enough to check what actually lands in the markup, which is what secret
 * hygiene depends on.
 */
const baseKey: ApiKey = {
  id: "key-1",
  name: "Local script",
  token_suffix: "a1b2c3",
  status: "active",
  created_at: "2026-09-18T12:00:00Z",
  expires_at: "2026-12-17T12:00:00Z",
  revoked_at: null,
  last_used_at: null,
  created_via: "oidc",
  created_by_key_id: null,
  created_by: null,
  is_current: false,
};

const noop = () => undefined;

const render = (apiKey: ApiKey) =>
  renderToStaticMarkup(<ApiKeyRow apiKey={apiKey} onDelete={noop} />);

describe("ApiKeyRow", () => {
  it("shows the masked key", () => {
    expect(render(baseKey)).toContain("eve_…a1b2c3");
  });

  it("carries the key id for a row lookup", () => {
    expect(render(baseKey)).toContain('data-key-id="key-1"');
  });

  it("shows the provenance line for a key with a parent", () => {
    const child: ApiKey = {
      ...baseKey,
      id: "key-2",
      created_by_key_id: "key-1",
      created_by: {
        id: "key-1",
        name: "Local script",
        token_suffix: "d4e5f6",
        status: "active",
      },
    };
    expect(render(child)).toContain("Created via API key eve_…d4e5f6");
  });

  it("shows no provenance line for a root key", () => {
    expect(render(baseKey)).not.toContain("api-key-provenance");
  });

  it("includes the name and mask in the delete button's aria-label", () => {
    expect(render(baseKey)).toContain(
      'aria-label="Delete API key Local script (eve_…a1b2c3)"',
    );
  });

  it("never renders a token property even if a fixture carries one", () => {
    // A caller must never pass a CreatedApiKey (which has `token`) here, but
    // if one slipped through, the row still must not render the secret.
    const withToken = { ...baseKey, token: "eve_supersecretvalue" } as ApiKey & {
      token: string;
    };
    expect(render(withToken)).not.toContain("eve_supersecretvalue");
  });
});
