import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import useInfinityLoading from "@/hooks/useInfinityLoading";
import { useStoredSelection } from "@/hooks/useStoredSelection";
import type { McpServerPublic } from "@/services/useGetMcpServers";
import { LOCAL_STORAGE_PUBLIC_MCP_SERVERS } from "@/utilities/localStorage";
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
  const { isSelected, setSelected } = useStoredSelection(
    LOCAL_STORAGE_PUBLIC_MCP_SERVERS,
  );

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
              onCheckedChange={(checked) => setSelected(server.name, checked)}
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
