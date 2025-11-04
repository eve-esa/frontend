import { faExternalLink, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { type Document } from "@/types";
import { SourceContent } from "./SourceContent";
import { useParams } from "react-router-dom";
import { useLogSourceClick } from "@/services/useLogSourceClick";

type SourcesProps = {
  onToggle: () => void;
  sources: Document[];
  messageId?: string;
};

export const Sources = ({ onToggle, sources, messageId }: SourcesProps) => {
  const { conversationId } = useParams();
  const { mutate: logSourceClick } = useLogSourceClick();
  // Group sources by title only
  const groupedSources =
    sources?.reduce((acc, source) => {
      const title =
        source?.metadata?.additionalMetadata?.title ??
        source?.payload?.title ??
        "Title not available";

      if (!acc[title]) {
        acc[title] = [];
      }
      acc[title].push(source);
      return acc;
    }, {} as Record<string, Document[]>) || {};

  return (
    <div className="flex flex-col h-full py-6 gap-8">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-6">
        <h2 className="text-lg 3xl:text-3xl text-natural-50">
          Sources ({sources?.length})
        </h2>
        <FontAwesomeIcon
          icon={faTimes}
          onClick={onToggle}
          className="text-primary-50 h-6 hover:bg-natural-700 rounded-md transition-colors cursor-pointer"
        />
      </div>

      <div className="flex-none">
        <p className="text-sm text-natural-200 font-['NotesESA'] leading-6 px-6 3xl:text-xl">
          Here you can find all the sources used for the answer.
        </p>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto min-w-0 flex flex-col gap-8 mask-y-from-97% mask-y-to-100% px-6 ">
        <div className="flex flex-col gap-6">
          {Object.entries(groupedSources).map(([title, groupSources]) => {
            // Use the first source's link for the title
            const firstSource = groupSources[0];
            const sourcesLink =
              firstSource?.metadata?.additionalMetadata?.link ??
              firstSource?.payload?.url;

            return (
              <div
                key={title}
                className="flex flex-col gap-4 py-4 overflow-hidden text-ellipsis"
              >
                {/* Title header for the group */}
                <div className="flex flex-col gap- hover:underline hover:opacity-80">
                  <h2
                    className="text-lg 3xl:text-2xl leading-6 cursor-pointer"
                    onClick={() => {
                      if (sourcesLink) {
                        if (conversationId && messageId) {
                          logSourceClick({
                            conversationId,
                            messageId,
                            source_id: String(groupSources[0]?.id),
                            source_url: sourcesLink,
                            source_title: title,
                            source_collection_name:
                              groupSources[0]?.collection_name ?? "unknown",
                          });
                        }
                        window.open(sourcesLink, "_blank");
                      }
                    }}
                  >
                    <FontAwesomeIcon
                      icon={faExternalLink}
                      className="size-3 cursor-pointer mr-2"
                    />
                    {title}
                  </h2>
                </div>

                {/* All source content for this title */}
                <div className="flex flex-col gap-3">
                  {
                    <div className="text-natural-50 pt-2">
                      <span className="text-xs text-primary-300">source:</span>
                      <span className="text-xs italic ml-1 text-primary-300">
                        {groupSources[0]?.collection_name ?? "unknown"}
                      </span>
                    </div>
                  }
                  {groupSources.map((source, index) => (
                    <SourceContent
                      key={`${source.id}-${index}`}
                      source={source}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
