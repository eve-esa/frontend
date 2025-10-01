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

type DatePickerProps = {
  date: Date | undefined;
  placeholder?: string;
  onDateChange: (date: Date | undefined) => void;
};

export function DatePicker({
  date,
  onDateChange,
  placeholder,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onDateChange(selectedDate);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex max-h-[48px] items-center justify-between gap-2 px-3 py-3.5 cursor-pointer bg-natural-900 rounded-lg">
          {date ? (
            <span className="text-natural-50">
              {formatDate(date.toISOString(), "D MMMM YYYY")}
            </span>
          ) : (
            <span className="text-primary-50 text-sm">{placeholder}</span>
          )}
          <FontAwesomeIcon
            icon={faCalendar}
            className="size-4 text-primary-50"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-3 z-50 !bg-primary-200 group/calendar rounded-lg border !border-primary-400 shadow-lg">
        <Calendar
          mode="single"
          selected={date ?? undefined}
          onSelect={handleSelect}
          captionLayout="dropdown"
        />
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
              onDateChange(undefined);
              setOpen(false);
            }}
          >
            Clear
          </AnimatedLink>
        </div>
      </PopoverContent>
    </Popover>
  );
}
