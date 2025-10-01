import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

interface StepInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export const StepInput = ({
  value,
  onChange,
  min = 0,
  max = 1000,
  step = 1,
  className,
  disabled = false,
}: StepInputProps) => {
  const [inputValue, setInputValue] = useState(value.toString());

  // Sync internal state with prop changes
  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleMinus = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
    setInputValue(newValue.toString());
  };

  const handlePlus = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
    setInputValue(newValue.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Only allow digits
    const numericValue = newValue.replace(/[^0-9]/g, "");

    setInputValue(numericValue);

    const numValue = parseInt(numericValue, 10);
    if (!isNaN(numValue)) {
      const clampedValue = Math.min(max, Math.max(min, numValue));
      onChange(clampedValue);
    }
  };

  const handleInputBlur = () => {
    const numValue = parseInt(inputValue, 10);
    if (isNaN(numValue)) {
      setInputValue(value.toString());
    } else {
      const clampedValue = Math.min(max, Math.max(min, numValue));
      setInputValue(clampedValue.toString());
      onChange(clampedValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent +, -, e, E, and any non-numeric characters
    if (
      e.key === "+" ||
      e.key === "-" ||
      e.key === "e" ||
      e.key === "E" ||
      e.key === "." ||
      e.key === "," ||
      (!/^[0-9]$/.test(e.key) &&
        ![
          "Backspace",
          "Delete",
          "Tab",
          "Escape",
          "Enter",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
        ].includes(e.key))
    ) {
      e.preventDefault();
      return;
    }
  };

  return (
    <div
      className={cn(
        "flex items-center border bg-natural-900 overflow-hidden rounded-lg px-1",
        className
      )}
      style={{
        outline: "none",
        border: "none",
        boxShadow: "none",
      }}
    >
      {/* Minus Button */}
      <button
        type="button"
        onClick={handleMinus}
        disabled={disabled || value <= min}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-md bg-primary-500 transition-colors",
          "text-natural-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
          "focus:outline-none",
          !disabled && "hover:bg-primary-500/60"
        )}
      >
        <FontAwesomeIcon icon={faMinus} className="w-4 h-4" />
      </button>

      {/* Number Input */}
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        formNoValidate
        disabled={disabled}
        className={cn(
          "flex-1 h-12 px-3 text-center bg-transparent text-natural-50",
          "border-none outline-none focus:ring-0",
          "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        )}
      />

      {/* Plus Button */}
      <button
        type="button"
        onClick={handlePlus}
        disabled={disabled || value >= max}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-md bg-primary-500 transition-colors",
          "text-natural-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
          "focus:outline-none",
          !disabled && "hover:bg-primary-500/60"
        )}
      >
        <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
      </button>
    </div>
  );
};
