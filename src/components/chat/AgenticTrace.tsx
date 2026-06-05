import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { AgenticTraceStep } from "@/types";
import { ExpandablePlainText } from "@/components/ui/ExpandablePlainText";
import {
  formatAgenticTraceStepBody,
  formatAgenticTraceStepLabel,
} from "@/utilities/formatAgenticTraceStep";

type AgenticTraceProps = {
  onToggle: () => void;
  trace: AgenticTraceStep[];
};

export const AgenticTrace = ({ onToggle, trace }: AgenticTraceProps) => {
  return (
    <div className="flex flex-col h-full py-6 gap-8">
      <div className="flex-none flex items-center justify-between px-6">
        <h2 className="text-lg 3xl:text-3xl text-natural-50">
          Agent trace ({trace.length})
        </h2>
        <FontAwesomeIcon
          icon={faTimes}
          onClick={onToggle}
          className="text-primary-50 h-6 hover:bg-natural-700 rounded-md transition-colors cursor-pointer"
        />
      </div>

      <div className="flex-none">
        <p className="text-sm text-natural-200 font-['NotesESA'] leading-6 px-6 3xl:text-xl">
          Reasoning and tool steps captured during agentic generation.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto min-w-0 flex flex-col gap-4 mask-y-from-97% mask-y-to-100% px-6">
        {trace.map((step, index) => (
          <div key={index} className="flex flex-col gap-2">
            <h3 className="text-sm 3xl:text-lg text-natural-50 font-['NotesESA']">
              {index + 1}. {formatAgenticTraceStepLabel(step)}
            </h3>
            <ExpandablePlainText text={formatAgenticTraceStepBody(step)} />
          </div>
        ))}
      </div>
    </div>
  );
};
