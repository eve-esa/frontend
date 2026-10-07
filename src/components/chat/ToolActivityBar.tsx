import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { Spinner } from "@/components/ui/Spinner";
import type { ToolActivityEntry } from "@/types";
import { toolChipText } from "@/utilities/toolActivity";

type ToolActivityBarProps = {
  activity: ToolActivityEntry[];
};

// One chip per MCP tool invocation of the streaming turn: spinner while the
// tool runs, subdued check once its result arrived. The text names the MCP
// server the tool belongs to (see toolChipText).
export const ToolActivityBar = ({ activity }: ToolActivityBarProps) => (
  <div className="flex flex-wrap gap-2" data-testid="tool-activity-bar">
    {activity.map((entry, idx) => (
      <div
        key={`tool-chip-${idx}`}
        data-testid="tool-chip"
        className="flex items-center gap-1.5 rounded-full bg-natural-800 px-3 py-1 text-xs text-natural-100"
      >
        {entry.state === "running" ? (
          <Spinner size="xs" />
        ) : (
          <FontAwesomeIcon icon={faCheck} className="size-3 text-natural-400" />
        )}
        <span>{toolChipText(entry)}</span>
      </div>
    ))}
  </div>
);
