import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "cursor-pointer inline-flex w-fit items-center justify-center gap-2 whitespace-nowrap font-regular text-sm font-['NotesESA'] [transition:background_0.3s_ease-in] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-none focus-visible:ring-primary-400 focus-visible:ring-[2px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        primary:
          "bg-primary-500 text-natural-50 shadow-xs enabled:hover:bg-primary-700",
        outline:
          "border-2 border-primary-400 bg-transparent hover:bg-primary-400 hover:text-natural-50 shadow-xs enabled:hover:bg-natural-700 enabled:hover:text-natural-50",
        ghost: "enabled:hover:bg-primary-700 enabled:hover:text-natural-50",
        destructive:
          "bg-danger-400 text-natural-50 shadow-xs enabled:hover:bg-danger-500 border border-danger-500",
        icon: "p-2 enabled:hover:text-natural-200 disabled:opacity-100",
      },
      size: {
        sm: "gap-1.5 px-1 py-2 has-[>svg]:px-2.5",
        md: "px-4 py-2 has-[>svg]:px-3 text-md",
        lg: "px-6 py-2.5 has-[>svg]:px-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);
