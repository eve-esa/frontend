import React, { useState, useRef, useEffect } from "react";
import { Input } from "./Input";
import { cn } from "@/lib/utils";

type AutocompleteProps = {
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  variant?: "default" | "secondary";
  name?: string;
  debounceMs?: number;
  maxResults?: number;
};

export const Autocomplete = React.forwardRef<
  HTMLInputElement,
  AutocompleteProps
>(
  (
    {
      options,
      value = "",
      onChange,
      placeholder,
      className,
      variant = "default",
      name,
      debounceMs = 500,
      maxResults = 5,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [searchQuery, setSearchQuery] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Debounce the search query
    useEffect(() => {
      const timer = setTimeout(() => {
        setSearchQuery(value.trim());
      }, debounceMs);

      return () => clearTimeout(timer);
    }, [value, debounceMs]);

    // Filter options based on debounced search query
    useEffect(() => {
      if (!searchQuery) {
        setFilteredOptions([]);
        setIsOpen(false);
        return;
      }

      const q = searchQuery.toLowerCase();
      const filtered: string[] = [];

      for (let i = 0, n = options.length; i < n; i++) {
        const option = options[i];
        if (option.toLowerCase().includes(q)) {
          filtered.push(option);
          if (filtered.length >= maxResults) break;
        }
      }

      setFilteredOptions(filtered);
      setHighlightedIndex(-1);
      // Only open dropdown if input is focused AND we have filtered options
      setIsOpen(isFocused && filtered.length > 0);
    }, [searchQuery, options, maxResults, isFocused]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
          setIsFocused(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange?.(newValue);
    };

    const handleOptionClick = (option: string) => {
      onChange?.(option);
      setIsOpen(false);
      // Keep input focused after selection
      setIsFocused(true);
    };

    const handleFocus = () => {
      setIsFocused(true);
      // Show dropdown if we already have filtered options
      if (filteredOptions.length > 0) {
        setIsOpen(true);
      }
    };

    const handleBlur = () => {
      setIsFocused(false);
      setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleOptionClick(filteredOptions[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    };

    return (
      <div ref={containerRef} className="relative w-full">
        <Input
          ref={ref}
          name={name}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={className}
          variant={variant}
          {...props}
        />

        {isOpen && filteredOptions.length > 0 && (
          <div
            className={cn(
              "bg-natural-900 max-h-[500px] text-natural-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 absolute z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-lg border border-primary-400 shadow-md w-full mt-1"
            )}
          >
            <div className="p-1">
              {filteredOptions.map((option, index) => (
                <div
                  key={option}
                  className={cn(
                    "focus:bg-primary-500 relative flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-8 pl-2 outline-hidden select-none transition-colors",
                    index === highlightedIndex
                      ? "bg-primary-500 text-natural-50"
                      : "text-natural-200 hover:bg-primary-500 hover:text-natural-50"
                  )}
                  onMouseDown={() => {
                    handleOptionClick(option);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {option}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

Autocomplete.displayName = "Autocomplete";
