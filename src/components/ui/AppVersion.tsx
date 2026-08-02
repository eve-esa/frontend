import { cn } from "@/lib/utils";

const SHORT_COMMIT_LENGTH = 7;

// Both values are injected at build time by the deploy workflows, in the same
// way as VITE_API_URL. They are unset during local development, in which case
// nothing is rendered at all rather than "undefined".
const version: string = (import.meta.env.VITE_APP_VERSION ?? "").trim();
const commit: string = (import.meta.env.VITE_APP_COMMIT ?? "")
  .trim()
  .slice(0, SHORT_COMMIT_LENGTH);

type AppVersionProps = {
  className?: string;
};

export const AppVersion: React.FC<AppVersionProps> = ({ className }) => {
  const label = [version, commit && `(${commit})`].filter(Boolean).join(" ");

  if (!label) {
    return null;
  }

  return (
    <p
      className={cn(
        "text-center text-xs text-primary-300 font-['NotesESA'] select-none",
        className,
      )}
    >
      {label}
    </p>
  );
};

AppVersion.displayName = "AppVersion";
