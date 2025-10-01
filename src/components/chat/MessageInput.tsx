import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/TextArea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";
import {
  faArrowRight,
  faSearch,
  faSliders,
} from "@fortawesome/free-solid-svg-icons";
import { useForm, useWatch } from "react-hook-form";
import { useSidebar } from "./DynamicSidebarProvider";
import { useEffect, useRef, useState } from "react";
import logo from "@/assets/images/esa_phi_lab_1.svg";
import { useTour } from "@/components/onboarding/TourContext";
import { cn } from "@/lib/utils";

export type MessageInputProps = {
  variant?: "primary" | "secondary";
  isLoading: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  sendRequest?: (input: string) => void;
  suggestions?: string[];
};

export const MessageInput = ({
  variant = "primary",
  className,
  placeholder = "Ask something ...",
  disabled,
  sendRequest,
  suggestions,
}: MessageInputProps) => {
  const { isRunning, currentStep } = useTour();
  const { handleSubmit, reset, setValue, control } = useForm({
    defaultValues: {
      input: "",
    },
  });

  const { openDynamicSidebar } = useSidebar();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const inputValue = useWatch({ control, name: "input" });
  const maxCharacters = 345000;
  const inputLengthWithoutNewlines = inputValue.replace(/\n/g, "").length;
  const isOverLimit = inputLengthWithoutNewlines > maxCharacters;

  const onSubmit = (data: { input: string }) => {
    const inputLengthWithoutNewlines = data.input.replace(/\n/g, "").length;
    if (inputLengthWithoutNewlines <= maxCharacters) {
      sendRequest?.(data.input);
      reset();
    }
  };

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentStep === 9 && isRunning) {
      setShowSuggestions(true);
    }
  }, [currentStep]);

  const hideSuggestions = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsAnimatingOut(true);
    timeoutRef.current = setTimeout(() => {
      setShowSuggestions(false);
      setIsAnimatingOut(false);
      timeoutRef.current = null;
    }, 200); // Match animation duration
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        `flex flex-col gap-6 mx-auto h-full w-full overflow-hidden ${
          variant === "secondary" ? "pb-40" : ""
        }`
      )}
    >
      {suggestions && (
        <img src={logo} alt="logo" className="h-[60px] md:h-[110px]" />
      )}

      <div className="flex flex-col gap-2 h-full">
        <form className={`flex gap-4  ${className || ""} h-full`}>
          <div
            className="w-full  flex-none border-primary-400 border-2 flex flex-col bg-primary-900 relative start-new-chat-tour"
            data-tour="start-new-chat-tour"
          >
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setValue("input", e.target.value)}
              onFocus={() => {
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
                setShowSuggestions(true);
                setIsAnimatingOut(false);
              }}
              onBlur={() => {
                if (showSuggestions && !isAnimatingOut) {
                  hideSuggestions();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (inputValue.trim().length > 0 && !isOverLimit) {
                    handleSubmit(onSubmit)();
                  }
                }
              }}
              placeholder={placeholder}
              disabled={disabled}
            />
            {isOverLimit && (
              <div className="text-sm 3xl:text-lg text-danger-400 px-4 md:px-8">
                Character limit exceeded ({inputLengthWithoutNewlines}/
                {maxCharacters})
              </div>
            )}

            <div className="flex items-center justify-between pointer-events-none p-2 md:p-6 pt-0 md:pt-1">
              <div className="pointer-events-auto">
                <Button
                  type="button"
                  variant="icon"
                  size="sm"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openDynamicSidebar({ type: "settings" });
                  }}
                  className="h-8 w-8 p-0 cursor-pointer settings-button-tour"
                  data-tour="settings-button"
                >
                  <FontAwesomeIcon icon={faSliders} className="size-4" />
                </Button>
              </div>
              <div className="pointer-events-auto">
                <Button
                  type="submit"
                  disabled={!inputValue.trim().length || isOverLimit}
                  variant="icon"
                  size="sm"
                  className="h-8 w-8 p-0 cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmit(onSubmit)();
                  }}
                >
                  <FontAwesomeIcon icon={faPaperPlane} className="size-4 " />
                </Button>
              </div>
            </div>
            {suggestions && showSuggestions && (
              <div className="h-full flex flex-col gap-2 border-t-2 overflow-y-auto border-primary-400 ">
                <div
                  className={`bg-primary-900 flex flex-col gap-4 p-4 md:p-8 ${
                    isAnimatingOut ? "animate-fade-out" : "animate-fade-in"
                  }`}
                >
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setValue("input", suggestion);
                        textareaRef.current?.focus();
                      }}
                      className="group w-full flex justify-between gap-4 cursor-pointer bg-primary-900 text-natural-200 p-2 hover:text-natural-50 hover:bg-primary-400/20 border-2 border-primary-400 transition-colors duration-200"
                    >
                      <div className="flex items-start gap-2">
                        <FontAwesomeIcon
                          icon={faSearch}
                          className="size-4 mt-1"
                        />
                        <p>{suggestion}</p>
                      </div>

                      <div className="hidden group-hover:block text-end rotate-[-45deg]">
                        <FontAwesomeIcon
                          icon={faArrowRight}
                          className="size-4"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        <p className="text-sm text-natural-200 text-center">
          EVE could make errors. Always check the content.
        </p>
      </div>
    </div>
  );
};
