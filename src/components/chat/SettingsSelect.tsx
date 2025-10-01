import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { OptionType } from "@/types";

type SettingsSelectProps = {
  placeholder: string;
  value?: OptionType;
  onValueChange?: (value: OptionType | undefined) => void;
  options: OptionType[];
};

export const SettingsSelect = ({
  placeholder,
  value,
  onValueChange,
  options,
}: SettingsSelectProps) => {
  const handleValueChange = (selectedValue: string) => {
    // If selecting "none", clear the selection

    if (selectedValue === "__none__") {
      if (onValueChange) {
        onValueChange(undefined);
      }
      return;
    }

    const selectedOption = options.find(
      (option) => option.value === selectedValue
    );
    if (selectedOption && onValueChange) {
      onValueChange(selectedOption);
    }
  };

  return (
    <Select
      key={value?.value ? `selected-${value.value}` : "empty"}
      value={value?.value ?? ""}
      onValueChange={handleValueChange}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {value && (
            <SelectItem value="__none__" className="text-natural-200 italic">
              None
            </SelectItem>
          )}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
