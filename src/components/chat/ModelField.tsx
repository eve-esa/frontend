import { useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/lib/utils";
import type { ModelListResponse } from "@/types";
import { useModelSelection } from "@/hooks/useModelSelection";
import { modelSelectionToValue } from "@/utilities/modelSelection";

type ModelOptionListProps = {
  models?: ModelListResponse;
  value: string;
  onSelect: (value: string) => void;
};

/** One row per model, the current one filled and checked. */
export const ModelOptionList = ({
  models,
  value,
  onSelect,
}: ModelOptionListProps) => {
  const options = [
    ...(models?.platform ?? []).map((model) => ({
      value: modelSelectionToValue({ type: "platform", id: model.id }),
      name: model.display_name,
    })),
    ...(models?.custom ?? []).map((model) => ({
      value: modelSelectionToValue({ type: "custom", id: model.id }),
      name: model.display_name,
    })),
  ];

  return (
    <div className="flex flex-col" role="radiogroup" aria-label="Model">
      {options.map((option) => {
        const current = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={current}
            data-testid="model-sheet-option"
            data-current={current ? "true" : "false"}
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex h-[56px] w-full flex-none cursor-pointer items-center justify-between px-4 text-start text-[16px] outline-none focus-visible:ring-[2px] focus-visible:ring-inset focus-visible:ring-focus",
              current
                ? "bg-highlight/40 text-natural-50 in-data-[theme=light]:bg-highlight"
                : "text-natural-200",
            )}
          >
            <span className="truncate">{option.name}</span>
            {current && (
              <FontAwesomeIcon icon={faCheck} className="size-[18px]" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
};

/**
 * The model on a phone: a square outlined field in the header (caption "Model" over the name, no
 * chevron, the whole field is the target) that opens a bottom sheet with the models. The composer's
 * picker is not rendered on a phone.
 */
export const ModelField = ({ className }: { className?: string }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { models, value, select, currentName } = useModelSelection();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid="header-model-field"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-[44px] w-fit max-w-[232px] cursor-pointer flex-col justify-center justify-self-center border border-control bg-primary-900 px-4 text-start outline-none focus-visible:ring-[2px] focus-visible:ring-focus",
          className,
        )}
      >
        <span className="text-[11px] leading-[14px] text-natural-200">Model</span>
        <span
          data-testid="header-model-name"
          className="truncate text-[15px] leading-5 text-natural-50"
        >
          {currentName ?? "Select model"}
        </span>
      </button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Model"
        returnFocusTo={triggerRef}
        data-testid="model-sheet"
      >
        <ModelOptionList
          models={models}
          value={value}
          onSelect={(next) => {
            select(next);
            setOpen(false);
          }}
        />
      </BottomSheet>
    </>
  );
};
