import type { ToolkitUserCredentials } from "@/services/useGetMcpServers";
import { formatApiDate } from "@/utilities/dayjs";

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
