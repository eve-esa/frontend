import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  clearStorageNotice,
  useStorageNotice,
} from "@/services/storageNotice";
import { useStorageUsage } from "@/services/useStorageUsage";
import { STORAGE_QUOTA_ENABLED } from "@/utilities/features";
import {
  STORAGE_SETTINGS_PATH,
  storageSettingsLinkEnabled,
} from "@/utilities/storageQuota";

type ComposerStorageNoticeProps = {
  conversationId?: string;
};

const linkClass =
  "underline text-success-200 in-data-[theme=light]:text-success-100 outline-none focus-visible:ring-2 focus-visible:ring-primary-50 in-data-[theme=light]:focus-visible:ring-focus";

/**
 * One line above the composer after a turn whose new files did not fit. Not a
 * send error: the answer stays and the composer stays enabled. Dismiss clears
 * it, and so does a usage refetch newer than the notice that shows room left.
 * A new send does not, because a still-full account gets the notice again.
 */
export const ComposerStorageNotice = ({
  conversationId,
}: ComposerStorageNoticeProps) => {
  const notice = useStorageNotice(conversationId);
  const usage = useStorageUsage();

  useEffect(() => {
    if (!STORAGE_QUOTA_ENABLED || !conversationId || !notice || !usage.data) {
      return;
    }
    if (usage.dataUpdatedAt < notice.setAt) return;
    const room =
      usage.data.unlimited ||
      (usage.data.used_ratio !== null && usage.data.used_ratio < 1);
    if (room) clearStorageNotice(conversationId);
  }, [conversationId, notice, usage.data, usage.dataUpdatedAt]);

  if (!STORAGE_QUOTA_ENABLED || !notice) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="composer-storage-notice"
      className="text-sm font-bold text-natural-50"
    >
      Storage is full. New files from this chat were not saved.{" "}
      {storageSettingsLinkEnabled() && (
        <Link
          to={STORAGE_SETTINGS_PATH}
          data-testid="composer-storage-manage"
          className={linkClass}
        >
          Manage storage
        </Link>
      )}{" "}
      <button
        type="button"
        data-testid="composer-storage-dismiss"
        className={linkClass}
        onClick={() => conversationId && clearStorageNotice(conversationId)}
      >
        Dismiss
      </button>
    </p>
  );
};
