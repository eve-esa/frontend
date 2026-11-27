import { settingsPath } from "@/pages/settings/sections";
import {
  SETTINGS_PAGE_ENABLED,
  SETTINGS_USAGE_ENABLED,
  STORAGE_QUOTA_ENABLED,
} from "@/utilities/features";

/** The code the backend uses on the upload 403, the stream notice and `final.notices`. */
export const STORAGE_QUOTA_CODE = "storage_quota_exceeded";

/** Where "Manage storage" leads: the Storage panel in Settings Usage. */
export const STORAGE_SETTINGS_PATH = settingsPath("usage");

/** "Manage storage" needs the page and the section it points at, not only this feature. */
export const storageSettingsLinkEnabled = (): boolean =>
  STORAGE_QUOTA_ENABLED && SETTINGS_PAGE_ENABLED && SETTINGS_USAGE_ENABLED;

/** True for `POST /artifacts` refused because the file does not fit the user's storage. */
export const isStorageQuotaError = (error: unknown): boolean => {
  const detail = (error as { response?: { data?: { detail?: unknown } } } | null)
    ?.response?.data?.detail;
  return (
    !!detail &&
    typeof detail === "object" &&
    (detail as { code?: unknown }).code === STORAGE_QUOTA_CODE
  );
};

/** True when a list of notice codes from the stream or the JSON answer names the quota. */
export const hasStorageQuotaNotice = (notices: unknown): boolean =>
  Array.isArray(notices) && notices.includes(STORAGE_QUOTA_CODE);
