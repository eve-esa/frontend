import { cn } from "@/lib/utils";

type SpinnerProps = {
  variant?: "primary" | "white";
  size?: "xs" | "sm" | "md" | "lg";
};

export const Spinner = ({ variant = "white", size = "sm" }: SpinnerProps) => {
  const sizeClasses = {
    xs: "w-3 h-3 border-2",
    sm: "w-5 h-5 border-2",
    md: "w-6 h-6 border-[3px]",
    lg: "w-8 h-8 border-4",
  }[size];

  return (
    <div
      role="status"
      aria-label="loading"
      className={cn(
        `${sizeClasses} rounded-full animate-spin`,
        variant === "primary" ? "border-primary-300" : "border-natural-50",
        "border-t-transparent border-l-transparent"
      )}
    />
  );
};
