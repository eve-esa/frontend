import * as React from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends React.ComponentProps<"textarea"> {
  endSlot?: React.ReactNode;
  disabled?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, endSlot, disabled, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        const newHeight = Math.max(textarea.scrollHeight, 40); // Minimum height of 40px
        textarea.style.height = `${newHeight}px`;
      }
    }, []);

    React.useEffect(() => {
      adjustHeight();
    }, [props.value, adjustHeight]);

    // Combine internal ref with forwarded ref
    const combinedRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    return (
      <div className="relative w-full">
        <textarea
          ref={combinedRef}
          data-slot="textarea"
          disabled={disabled}
          className={cn(
            "w-full overflow-y-auto resize-none font-regular bg-transparent px-4 pt-4 md:px-8 md:pt-8 text-[16px] text-natural-100 flex-1 min-h-[40px] max-h-[200px]",
            "disabled:pointer-events-none disabled:opacity-50",
            "placeholder:text-[16px] placeholder:3xl:text-xl",
            className
          )}
          style={{
            outline: "none",
            border: "none",
            boxShadow: "none",
          }}
          onInput={adjustHeight}
          {...props}
        />

        {endSlot && (
          <div className="absolute right-3 bottom-3 flex items-end">
            {endSlot}
          </div>
        )}
      </div>
    );
  }
);

export { Textarea };
