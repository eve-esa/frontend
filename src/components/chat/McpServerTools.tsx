import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGetMcpServer, type McpTool } from "@/services/useGetMcpServer";
import type { McpServerPublic } from "@/services/useGetMcpServers";
import { cn } from "@/lib/utils";

const SHOW_MORE_MIN_LENGTH = 150;

const ExpandableDescription = ({ text }: { text: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [text]);

  const canExpand = text.length > SHOW_MORE_MIN_LENGTH;

  return (
    <div className="text-xs 3xl:text-xl text-natural-200 bg-primary-200 border-l border-neutral-200">
      <div
        className="relative text-sm leading-6 py-1 px-2 pr-1 rounded-tr-md rounded-br-md overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? `${contentHeight + 60}px` : "8rem",
        }}
      >
        <div ref={contentRef}>
          <p className="block !text-sm 3xl:!text-xl whitespace-pre-wrap">{text}</p>
        </div>
        {!isExpanded && canExpand && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-primary-200 to-transparent pointer-events-none transition-opacity duration-300" />
        )}
      </div>
      {canExpand && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs hover:underline cursor-pointer px-2 w-full text-natural-200 hover:text-natural-50 mb-2 text-end transition-colors duration-200"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};

const getToolName = (tool: McpTool) =>
  tool.name?.trim() || "Unnamed tool";

const getToolDescription = (tool: McpTool) =>
  tool.description?.trim() || "No description available";

type McpServerToolsProps = {
  server: McpServerPublic;
};

export const McpServerTools = ({ server }: McpServerToolsProps) => {
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const serverId = server.id;

  const { data, isLoading, isError } = useGetMcpServer(
    serverId,
    isToolsOpen
  );

  if (!serverId) {
    return null;
  }

  const tools = data?.tools ?? [];

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
        <span>Tools{data?.tools ? ` (${data.tools.length})` : ""}</span>
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
            <p className="text-xs text-natural-300">
              Unable to load tools for this server.
            </p>
          )}
          {!isLoading && !isError && tools.length === 0 && (
            <p className="text-xs text-natural-300">No tools available.</p>
          )}
          {!isLoading &&
            !isError &&
            tools.map((tool, index) => (
              <div
                key={`${serverId}-${tool.name ?? index}`}
                className={cn("flex flex-col gap-2")}
              >
                <span className="text-sm 3xl:text-lg text-natural-50 font-medium">
                  {getToolName(tool)}
                </span>
                <ExpandableDescription text={getToolDescription(tool)} />
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
