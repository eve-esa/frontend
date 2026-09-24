import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBug } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/Button";
import type { BugReportTarget } from "@/services/useReportBug";
import { ReportBugDialog } from "./ReportBugDialog";

/**
 * "Report a bug" in the conversation header. The report it opens carries this
 * conversation and its last answer (message and trace), so whoever triages it
 * lands on the right generation without asking the user anything technical.
 * Disabled until there is a conversation to report on.
 */
export const ConversationReportBug = ({
  conversationId,
  messageId,
  traceId,
}: BugReportTarget) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="conversation-report-bug"
        aria-haspopup="dialog"
        aria-label="Report a bug"
        title="Report a bug in this conversation"
        disabled={!conversationId}
        onClick={() => setIsOpen(true)}
        className="text-natural-200 enabled:hover:text-natural-50"
      >
        <FontAwesomeIcon icon={faBug} className="size-3.5" aria-hidden />
        <span className="hidden md:inline" aria-hidden>
          Report a bug
        </span>
      </Button>
      {conversationId && (
        <ReportBugDialog
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          target={{ conversationId, messageId, traceId }}
        />
      )}
    </>
  );
};
