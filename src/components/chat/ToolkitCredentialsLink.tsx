import { Link } from "react-router-dom";
import { settingsPath } from "@/pages/settings/sections";
import type { McpServerPublic } from "@/services/useGetMcpServers";
import {
  SETTINGS_PAGE_ENABLED,
  TOOLKIT_CREDENTIALS_ENABLED,
} from "@/utilities/features";

type ToolkitCredentialsLinkProps = {
  server: McpServerPublic;
};

// Tokens only: muted text as the description above it, link colour as the links in the
// attribution panel (success-100 is the light Link text row of BRAND.md).
const linkClass =
  "underline text-success-200 in-data-[theme=light]:text-success-100 outline-none focus-visible:ring-2 focus-visible:ring-primary-50 in-data-[theme=light]:focus-visible:ring-focus";

/**
 * Under a toolkit that takes the user's own credentials: one short line and one action, both
 * leading to the Toolkits section of Settings, where the values and their details live.
 * Required and missing: the whole line is the link (the switch above is disabled). Optional and
 * missing: an offer to use your own. Set: a confirmation and "Change". Nothing for a toolkit
 * without `user_credentials`, or while either feature is off.
 */
export const ToolkitCredentialsLink = ({
  server,
}: ToolkitCredentialsLinkProps) => {
  const creds = server.user_credentials;
  if (!TOOLKIT_CREDENTIALS_ENABLED || !SETTINGS_PAGE_ENABLED || !creds) {
    return null;
  }

  const link = (label: string) => (
    <Link
      to={settingsPath("toolkits")}
      data-testid={`toolkit-credentials-link-${server.name}`}
      className={linkClass}
    >
      {label}
    </Link>
  );

  if (!creds.configured) {
    return (
      <p
        data-testid={
          creds.required
            ? `toolkit-credentials-required-${server.name}`
            : `toolkit-credentials-status-${server.name}`
        }
        className="break-words text-xs 3xl:text-xl text-natural-200"
      >
        {link(
          creds.required
            ? "Add your credentials to use this toolkit."
            : "Use your own credentials"
        )}
      </p>
    );
  }

  return (
    <p className="break-words text-xs 3xl:text-xl text-natural-200">
      <span data-testid={`toolkit-credentials-status-${server.name}`}>
        Using your credentials.
      </span>{" "}
      {link("Change")}
    </p>
  );
};
