import { Skeleton } from "@/components/ui/Skeleton";
import useInfinityLoading from "@/hooks/useInfinityLoading";
import type { McpServerPublic } from "@/services/useGetMcpServers";
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
          <span className="leading-none 3xl:text-3xl text-natural-50">
            {server.name}
          </span>
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
