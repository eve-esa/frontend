import {
  busyCountdownCopy,
  busyFinalCopy,
  type BusyNotice,
} from "@/services/serviceBusy";

type ComposerBusyNoticeProps = {
  notice: BusyNotice | null;
};

// Non-blocking line above the composer while an overloaded or rate limited
// send is retried
// (see serviceBusy). Same look as the stream status notices: it pulses while
// something is still going on and stays still once it is final.
export const ComposerBusyNotice = ({ notice }: ComposerBusyNoticeProps) => {
  if (!notice || notice.phase === "canceled") return null;
  const waiting = notice.phase === "waiting";
  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="composer-busy-notice"
      data-phase={notice.phase}
      className={`text-sm font-bold text-natural-50 ${waiting ? "animate-pulse" : ""}`}
    >
      {waiting
        ? busyCountdownCopy(notice.secondsLeft, notice.reason)
        : busyFinalCopy(notice.reason)}
    </p>
  );
};
