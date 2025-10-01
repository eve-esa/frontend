import * as React from "react";

import { cn } from "@/lib/utils";

interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean;
  success?: boolean;
  endSlot?: React.ReactNode;
  variant?: "default" | "secondary";
}

function Input({
  className,
  type,
  endSlot,
  variant = "default",
  ...props
}: InputProps) {
  return (
    <div className="relative w-full">
      <input
        type={type}
        data-slot="input"
        autoComplete="off"
        className={cn(
          "rounded-lg flex h-12 w-full min-w-0 px-3 py-3 text-base outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          variant === "secondary" &&
            "!bg-natural-900 placeholder:text-primary-50 pl-4",
          variant === "default" &&
            "border shadow-xs transition-[color,box-shadow] bg-primary-200 text-natural-100 placeholder:text-natural-200/50 placeholder:text-sm border-primary-400",
          // Override browser autocomplete styles
          "[&:-webkit-autofill]:!bg-primary-200 [&:-webkit-autofill]:!text-natural-100 [&:-webkit-autofill]:!shadow-[0_0_0_30px_theme(colors.primary.200)_inset]",
          "[&:-webkit-autofill]:![-webkit-text-fill-color:theme(colors.natural.100)]",
          "[&:-webkit-autofill]:![-webkit-box-shadow:0_0_0_30px_theme(colors.primary.200)_inset]",
          "[&:-webkit-autofill]:!transition-[background-color_5000s_ease-in-out_0s]",
          "[&:-webkit-autofill]:!caret-natural-100",
          // Override autocomplete dropdown elements
          "[&::-webkit-calendar-picker-indicator]:!bg-primary-200 [&::-webkit-calendar-picker-indicator]:!text-natural-100",
          "[&::-webkit-list-button]:!bg-primary-200 [&::-webkit-list-button]:!text-natural-100",
          "[&::-webkit-datetime-edit]:!bg-primary-200 [&::-webkit-datetime-edit]:!text-natural-100",
          // Ensure consistent styling across all autofill states
          "[&:-webkit-autofill:hover]:!bg-primary-200 [&:-webkit-autofill:hover]:!text-natural-100 [&:-webkit-autofill:focus]:!bg-primary-200 [&:-webkit-autofill:focus]:!text-natural-100 [&:-webkit-autofill:active]:!bg-primary-200 [&:-webkit-autofill:active]:!text-natural-100",
          endSlot && "pr-12",
          className
        )}
        {...props}
      />
      {endSlot && (
        <div className="absolute right-3 top-0 bottom-0 flex items-center">
          {endSlot}
        </div>
      )}
    </div>
  );
}

export { Input };
