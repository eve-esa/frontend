import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBug } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/Button";
import { REPORT_BUG_ENABLED } from "@/utilities/features";
import type { BugReportTarget } from "@/services/useReportBug";
import { ReportBugDialog } from "./ReportBugDialog";

type MessageReportBugProps = BugReportTarget;

/**
 * "Report a bug" for one assistant message. The report it opens carries this
 * conversation, this message and its trace, so whoever triages it lands on the
 * exact generation without asking the user for anything technical.
 *
 * Kept quiet on purpose: a small secondary action under the answer, not a
 * call to action, since it sits on every message.
 */
export const MessageReportBug = ({
  conversationId,
  messageId,
  traceId,
}: MessageReportBugProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!REPORT_BUG_ENABLED) return null;

  return (
    <>
      <Button
        type="button"
        variant="icon"
        size="sm"
        data-testid="message-report-bug"
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
        className="text-xs text-natural-200 enabled:hover:text-natural-50"
      >
        <FontAwesomeIcon icon={faBug} className="size-3" />
        <span>Report a bug</span>
      </Button>
      <ReportBugDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        target={{ conversationId, messageId, traceId }}
      />
    </>
  );
};
