import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faSearch } from "@fortawesome/free-solid-svg-icons";

type SuggestionRowsProps = {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  disabled?: boolean;
};

/**
 * Suggestions as rows above the composer, for a phone: outside the box, so focus does not grow it.
 * Same card edge as the list inside the box; the arrow is always shown (no hover on a phone) to say
 * that a tap fills the input.
 */
export const SuggestionRows = ({ suggestions, onPick, disabled }: SuggestionRowsProps) => (
  <div className="flex flex-col gap-2">
    {suggestions.map((suggestion) => (
      <button
        key={suggestion}
        type="button"
        disabled={disabled}
        data-testid="composer-suggestion"
        onClick={() => onPick(suggestion)}
        className="flex min-h-[56px] w-full cursor-pointer items-start gap-2 border-2 border-primary-400 bg-primary-900 p-3.5 text-start text-[14px] leading-5 text-natural-200 outline-none focus-visible:ring-[2px] focus-visible:ring-focus"
      >
        <FontAwesomeIcon icon={faSearch} className="mt-0.5 size-4 flex-none" />
        <span className="flex-1">{suggestion}</span>
        <FontAwesomeIcon
          icon={faArrowRight}
          className="size-4 flex-none self-center -rotate-45"
        />
      </button>
    ))}
  </div>
);
