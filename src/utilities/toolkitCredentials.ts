import type {
  McpServerPublic,
  ToolkitUserCredentials,
} from "@/services/useGetMcpServers";
import { formatApiDate } from "@/utilities/dayjs";
import { TOOLKIT_CREDENTIALS_ENABLED } from "@/utilities/features";

/**
 * One line about where a toolkit's credentials stand, shared by the Settings Toolkits section
 * and the sidebar Toolkits panel so the two read the same.
 */
export const toolkitCredentialsStatus = (
  creds: ToolkitUserCredentials
): string => {
  if (!creds.configured) {
    return creds.required
      ? "Not set. Required to use this toolkit."
      : "Not set.";
  }
  const hints = creds.fields
    .filter((field) => creds.hints[field.name])
    .map((field) => `${field.label} ending in ${creds.hints[field.name]}`);
  const checked = formatApiDate(creds.verified_at);
  return [
    "Using your credentials",
    ...hints,
    ...(checked ? [`Checked ${checked}`] : []),
  ].join(". ");
};

/**
 * True when the toolkit needs the user's own credentials and has none: its switch is
 * disabled and it is not sent with a turn.
 */
export const isBlockedByCredentials = (
  server: Pick<McpServerPublic, "user_credentials">
): boolean => {
  const creds = server.user_credentials;
  return TOOLKIT_CREDENTIALS_ENABLED && !!creds?.required && !creds.configured;
};
