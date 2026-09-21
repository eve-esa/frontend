import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/Button";
import { useClipboard } from "@/hooks/useClipboard";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  value: string;
  label: string;
  testId?: string;
  className?: string;
};

/** Icon-only copy control: the copy icon turns into a check for a second. */
export const CopyButton = ({
  value,
  label,
  testId,
  className,
}: CopyButtonProps) => {
  const { copyToClipboard, isCopied } = useClipboard();
  return (
    <Button
      type="button"
      variant="icon"
      data-testid={testId}
      aria-label={label}
      title={label}
      onClick={() => void copyToClipboard(value)}
      className={cn("shrink-0 text-primary-300 hover:text-natural-50", className)}
    >
      <FontAwesomeIcon icon={isCopied ? faCheck : faCopy} className="size-3.5" />
    </Button>
  );
};
