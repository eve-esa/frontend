import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import useInfinityLoading from "@/hooks/useInfinityLoading";
import type { McpServerPublic } from "@/services/useGetMcpServers";
import {
  getSelectedMcpServerNames,
  toggleMcpServerSelection,
} from "@/utilities/mcpServers";
import { McpServerTools } from "./McpServerTools";

type SharedToolkitsListProps = {
  isLoading: boolean;
  isFetchingNextPage: boolean;
  serversList: McpServerPublic[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
};

export const SharedToolkitsList = ({
  isLoading,
  isFetchingNextPage,
  serversList,
  fetchNextPage,
  hasNextPage,
}: SharedToolkitsListProps) => {
  const [serversEndRef] = useInfinityLoading({
    fetchFunction: fetchNextPage,
    dependencies: [hasNextPage],
  });
  // Same storage/selection mechanism as the Control Panel's "Tools (MCP)"
  // section (utilities/mcpServers.ts): a single `mcp_servers` source of
  // truth drives which endpoint useSendRequest hits next, regardless of
  // which of the two UIs toggled it.
  const [selectedServers, setSelectedServers] = useState<string[]>(() =>
    getSelectedMcpServerNames(),
  );
  const isSelected = (name: string) => selectedServers.includes(name);
  const toggleServer = (name: string) =>
    setSelectedServers((prev) => toggleMcpServerSelection(prev, name));

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="w-full h-6" />
        <Skeleton className="w-full h-6" />
        <Skeleton className="w-full h-6" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pr-2">
      {serversList.map((server) => (
        <div className="flex flex-col gap-4" key={server.id ?? server.name}>
          <div className="flex items-center gap-2">
            <Switch
              checked={isSelected(server.name)}
              onCheckedChange={() => toggleServer(server.name)}
            />
            <span className="leading-none 3xl:text-3xl font-semibold text-natural-50">
              {server.name}
            </span>
          </div>
          {server.description && (
            <p className="text-xs 3xl:text-xl text-natural-200">
              {server.description}
            </p>
          )}
          <McpServerTools server={server} />
        </div>
      ))}
      {hasNextPage && <div ref={serversEndRef} />}
      {isFetchingNextPage && <Skeleton className="w-full h-6" />}
    </div>
  );
};
