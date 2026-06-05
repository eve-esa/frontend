import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { ExpandablePlainText } from "@/components/ui/ExpandablePlainText";
import { useGetMcpServer, type McpTool } from "@/services/useGetMcpServer";
import type { McpServerPublic } from "@/services/useGetMcpServers";

const getToolName = (tool: McpTool) => tool.name?.trim() || "Unnamed tool";

const getToolDescription = (tool: McpTool) =>
  tool.description?.trim() || "No description available";

type McpServerToolsProps = {
  server: McpServerPublic;
};

export const McpServerTools = ({ server }: McpServerToolsProps) => {
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const serverId = server.id;

  const { data, isLoading, isError } = useGetMcpServer(serverId, {
    enabled: isToolsOpen,
  });

  if (!serverId) {
    return null;
  }

  const tools = data?.tools ?? [];
  const toolCountLabel =
    data?.tools !== undefined ? ` (${data.tools.length})` : "";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setIsToolsOpen((open) => !open)}
        className="flex items-center gap-2 text-sm 3xl:text-lg text-natural-100 hover:text-natural-50 cursor-pointer w-fit"
      >
        <FontAwesomeIcon
          icon={isToolsOpen ? faChevronDown : faChevronRight}
          className="h-3 w-3"
        />
        <span>Tools{toolCountLabel}</span>
      </button>

      {isToolsOpen && (
        <div className="flex flex-col gap-4 pl-4 border-l border-primary-400/40">
          {isLoading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-full h-4" />
            </div>
          )}
          {isError && (
            <p className="text-xs 3xl:text-xl text-natural-200">
              Unable to load tools for this server.
            </p>
          )}
          {!isLoading && !isError && tools.length === 0 && (
            <p className="text-xs 3xl:text-xl text-natural-200">
              No tools available.
            </p>
          )}
          {!isLoading &&
            !isError &&
            tools.map((tool, index) => (
              <div
                key={`${serverId}-${tool.name ?? index}`}
                className="flex flex-col gap-2"
              >
                <span className="text-sm 3xl:text-lg text-natural-50 font-medium">
                  {getToolName(tool)}
                </span>
                <ExpandablePlainText text={getToolDescription(tool)} />
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
