import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { cn } from "@/lib/utils";

export type YearRange = {
  startYear?: number;
  endYear?: number;
};

type YearRangePickerProps = {
  yearRange?: YearRange;
  onYearRangeChange?: (yearRange: YearRange | undefined) => void;
  placeholder?: string;
  className?: string;
};

export const YearRangePicker: React.FC<YearRangePickerProps> = ({
  yearRange,
  onYearRangeChange,
  className,
}) => {
  const currentYear = new Date().getFullYear();
  const startYear = 1980;
  const endYear = currentYear;

  // Generate array of years
  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_, i) => startYear + i
  );

  const handleStartYearChange = (value: string) => {
    const start = value ? parseInt(value) : undefined;
    onYearRangeChange?.({
      startYear: start,
      endYear: yearRange?.endYear,
    });
  };

  const handleEndYearChange = (value: string) => {
    const end = value ? parseInt(value) : undefined;
    onYearRangeChange?.({
      startYear: yearRange?.startYear,
      endYear: end,
    });
  };

  const handleClear = () => {
    onYearRangeChange?.(undefined);
  };

  const isRangeSelected = yearRange?.startYear || yearRange?.endYear;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {/* Start Year */}
          <div className="flex-1">
            <Select
              value={yearRange?.startYear?.toString() || ""}
              onValueChange={handleStartYearChange}
            >
              <SelectTrigger className="bg-natural-900 placeholder:text-primary-50">
                <SelectValue placeholder="Start year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Separator */}
          <span className="text-natural-200 text-sm">to</span>

          {/* End Year */}
          <div className="flex-1">
            <Select
              value={yearRange?.endYear?.toString() || ""}
              onValueChange={handleEndYearChange}
            >
              <SelectTrigger className="bg-natural-900 placeholder:text-primary-50">
                <SelectValue placeholder="End year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Clear Button */}
        {isRangeSelected && (
          <span
            onClick={handleClear}
            className="flex justify-end cursor-pointer text-xs text-natural-200 hover:text-natural-50 transition-colors px-2 py-1 rounded"
          >
            Clear
          </span>
        )}
      </div>

      {/* Validation message */}
      {yearRange?.startYear &&
        yearRange?.endYear &&
        yearRange.startYear > yearRange.endYear && (
          <p className="text-xs text-danger-400 mt-1">
            Start year must be less than or equal to end year
          </p>
        )}
    </div>
  );
};
