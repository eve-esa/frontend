import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar } from "@fortawesome/free-regular-svg-icons";
import { Calendar } from "@/components/ui/Calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { formatDate } from "@/utilities/dayjs";
import { AnimatedLink } from "./AnimatedLink";
import type { DateRange } from "react-day-picker";
import { normalizeDate } from "@/utilities/helpers";

type RangeDatePickerProps = {
  dateRange: DateRange | undefined;
  placeholder?: string;
  onDateRangeChange: (dateRange: DateRange | undefined) => void;
};

export function RangeDatePicker({
  dateRange,
  onDateRangeChange,
  placeholder = "Select date range",
}: RangeDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [firstMonth, setFirstMonth] = React.useState<Date>(new Date());
  const [secondMonth, setSecondMonth] = React.useState<Date>(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next;
  });

  const handleSelect = (selectedRange: DateRange | undefined) => {
    if (!selectedRange) {
      onDateRangeChange(undefined);
      return;
    }

    const normalizedRange: DateRange = {
      from: selectedRange.from ? normalizeDate(selectedRange.from) : undefined,
      to: selectedRange.to ? normalizeDate(selectedRange.to) : undefined,
    };

    onDateRangeChange(normalizedRange);
  };

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return null;

    if (range.to) {
      return `${formatDate(
        range.from.toISOString(),
        "D MMM YYYY"
      )} - ${formatDate(range.to.toISOString(), "D MMM YYYY")}`;
    }

    return formatDate(range.from.toISOString(), "D MMM YYYY");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex max-h-[48px] items-center justify-between gap-2 px-3 py-3.5 cursor-pointer bg-natural-900 rounded-lg">
          {dateRange?.from ? (
            <span className="text-natural-50 text-sm">
              {formatDateRange(dateRange)}
            </span>
          ) : (
            <span className="text-primary-50 text-md">{placeholder}</span>
          )}
          <FontAwesomeIcon
            icon={faCalendar}
            className="size-4 text-primary-50"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-3 mx-10 z-50 !bg-primary-200 group/calendar rounded-lg border !border-primary-400 shadow-lg w-auto">
        <div className="flex md:flex-row flex-col gap-4">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleSelect}
            captionLayout="dropdown"
            numberOfMonths={1}
            month={firstMonth}
            onMonthChange={setFirstMonth}
          />
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleSelect}
            captionLayout="dropdown"
            numberOfMonths={1}
            month={secondMonth}
            onMonthChange={setSecondMonth}
          />
        </div>
        <div className="flex items-center justify-end gap-4 border-t border-primary-400 pt-2 mt-2">
          <AnimatedLink
            onClick={() => setOpen(false)}
            className="text-natural-200"
          >
            Cancel
          </AnimatedLink>
          <AnimatedLink
            className="text-natural-200"
            onClick={() => {
              onDateRangeChange(undefined);
            }}
          >
            Clear
          </AnimatedLink>
        </div>
      </PopoverContent>
    </Popover>
  );
}
