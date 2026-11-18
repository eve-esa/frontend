import { cn } from "@/lib/utils";

// Bars of the loading state: Silver (primary-300) on the dark ground, the
// Silver tint of chips (primary-500, #E0E4E7) in light. No text, so no
// contrast pair; aria-hidden, the content arrives in a moment.
export const skeletonBarClass =
  "bg-primary-300 in-data-[theme=light]:bg-primary-500 animate-pulse rounded-md";

// About one rendered line per 90 characters, at most six: the answer keeps
// roughly its height while the renderer loads, without echoing its source.
const linesFor = (text: string) =>
  Math.min(6, Math.max(1, Math.ceil(text.length / 90), text.split("\n").filter(Boolean).length));

type SmartTextSkeletonProps = {
  text: string;
  className?: string;
};

// Each bar is h-4 with my-1: 24px per line, the leading-6 rhythm of SmartText.
const SmartTextSkeleton = ({ text, className }: SmartTextSkeletonProps) => {
  const lines = linesFor(text);
  return (
    <div
      data-testid="smart-text-skeleton"
      aria-hidden="true"
      className={cn("smarttext leading-6", className)}
    >
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className={cn(
            skeletonBarClass,
            "h-4 my-1",
            index === lines - 1 && lines > 1 ? "w-3/5" : "w-full",
          )}
        />
      ))}
    </div>
  );
};

export default SmartTextSkeleton;
