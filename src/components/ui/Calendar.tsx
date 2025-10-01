import * as React from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faChevronLeft,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  formatters,
  components,
  fromYear = 1990,
  toYear = new Date().getFullYear(),
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  fromYear?: number;
  toYear?: number;
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("font-arial", className)}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          defaultClassNames.months
        ),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between ",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 aria-disabled:opacity-50 p-0 select-none text-natural-50 text-natural-200 rounded-lg",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 aria-disabled:opacity-50 p-0 select-none text-natural-200 rounded-lg",
          defaultClassNames.button_next
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-6 gap-1.5",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative border border-primary-400 rounded-md bg-primary-200 min-h-6 [&>select]:bg-primary-200 [&>select]:border-none [&>select]:text-natural-50 [&>select]:text-sm [&>select]:px-3 [&>select]:py-2 [&>select]:rounded-md [&>select]:focus:outline-none [&>select]:cursor-pointer [&>select]:font-medium [&>select]:appearance-none [&>select]:pr-8",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn("absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium text-natural-50",
          captionLayout === "dropdown" && "text-sm max-h-6 py-1",
          captionLayout === "label"
            ? "text-sm"
            : "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-6 text-natural-200 [&>svg]:text-natural-200 [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-natural-200  flex-1 font-normal text-[0.8rem] select-none !text-primary-300",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-1 gap-1 ", defaultClassNames.week),
        day: cn(
          "relative w-full h-full p-0 text-center group/day aspect-square select-none",
          defaultClassNames.day
        ),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, size, ...props }) => {
          const icon =
            orientation === "left"
              ? faChevronLeft
              : orientation === "right"
              ? faChevronRight
              : faChevronDown;
          return (
            <FontAwesomeIcon
              icon={icon}
              className={cn("h-4 w-4", size, className)}
              {...props}
            />
          );
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => (
          <td {...props}>
            <div className="flex h-8 w-8 items-center justify-center text-center">
              {children}
            </div>
          </td>
        ),
        ...components,
      }}
      {...props}
      fromYear={fromYear}
      toYear={toYear}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "flex items-center justify-center px-2 h-8 text-sm !text-natural-200 rounded-md",
        "data-[selected-single=true]:bg-primary-400 data-[selected-single=true]:text-natural-50 data-[range-middle=true]:bg-primary-500 data-[range-middle=true]:text-natural-50 data-[range-start=true]:bg-primary-500 data-[range-start=true]:text-natural-50 data-[range-end=true]:bg-primary-500 data-[range-end=true]:text-natural-50 group-data-[focused=true]/day:border-primary-400 hover:!text-natural-50 hover:!bg-primary-500/80 hover:rounded-md w-full min-w-8 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70 text-natural-50 cursor-pointer",
        modifiers.today && "border border-primary-400",
        modifiers.outside && "!text-primary-300",
        className
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
