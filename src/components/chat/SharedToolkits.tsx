import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useGetMcpServers } from "@/services/useGetMcpServers";
import { SharedToolkitsList } from "./SharedToolkitsList";

type SharedToolkitsProps = {
  onToggle: () => void;
};

export const SharedToolkits = ({ onToggle }: SharedToolkitsProps) => {
  const {
    data: servers,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useGetMcpServers();

  const serversList = servers?.pages.flatMap((page) => page.data);
  const emptyServers = serversList?.length === 0;
  const loading = isLoading || isFetching;

  return (
    <div className="flex flex-col h-full py-6 gap-6 md:gap-10">
      <div className="flex-none flex flex-col gap-6 md:gap-10 px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg 3xl:text-3xl text-natural-50 ">
            Shared toolkits
          </h2>
          <FontAwesomeIcon
            icon={faTimes}
            onClick={onToggle}
            className="text-primary-50 h-6 hover:bg-natural-700 rounded-md transition-colors cursor-pointer"
          />
        </div>
        <div>
          <p className="text-sm 3xl:text-xl text-natural-200 font-['NotesESA'] leading-6 pt-2">
            MCP servers expose tools the assistant can call during a
            conversation. Browse each toolkit to see its available tools and
            what they do.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-w-0 flex flex-col gap-8 py-2 px-6">
        <div className="flex h-full flex-col gap-4 ">
          {emptyServers ? (
            <div className="flex flex-1 flex-col gap-4 items-center justify-center">
              <p className="text-sm text-natural-200">
                No shared toolkits found
              </p>
            </div>
          ) : (
            <SharedToolkitsList
              loading={loading}
              serversList={serversList || []}
              fetchNextPage={fetchNextPage}
              hasNextPage={hasNextPage}
            />
          )}
        </div>
      </div>
    </div>
  );
};
