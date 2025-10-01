import { Skeleton } from "@/components/ui/Skeleton";
import { SidebarHeader } from "./SidebarHeader";
import { Conversations } from "./Conversations";
import { SidebarMenu } from "./SidebarMenu";
import { Sidebar } from "@/components/ui/Sidebar";
import { useIsMobile } from "@/hooks/useIsMobile";
import { routes } from "@/utilities/routes";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "./DynamicSidebarProvider";
import { useGetConversationsList } from "@/services/useGetConversationsList";
import { cn } from "@/lib/utils";
import { useTour } from "@/components/onboarding/TourContext";

export const ConversationsMenuSidebar = () => {
  const navigate = useNavigate();
  const { isRunning } = useTour();
  const { isOpenConversationsSidebar, toggleConversationsSidebar } =
    useSidebar();

  const isMobile = useIsMobile();

  const {
    data: conversations,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useGetConversationsList();

  const conversationsList = !isRunning
    ? conversations?.pages.flatMap((page) => page.data)
    : [
        {
          id: "tour_conversation_1",
          name: "Past conversation",
        },
        {
          id: "tour_conversation_2",
          name: "What is ESA?",
        },
        {
          id: "tour_conversation_3",
          name: "How is TROPOMI used to support policy making?",
        },
      ];

  const handleNewChat = () => {
    navigate(routes.EMPTY_CHAT.path);
    if (isMobile) {
      toggleConversationsSidebar();
    }
  };

  const loadingConversations = isLoading;

  return (
    <Sidebar
      isOpen={isOpenConversationsSidebar}
      isMobile={isMobile}
      side="left"
      variant="icon-only"
      className="border-r-2 border-primary-400 conversations-sidebar-tour"
      data-tour="conversations-sidebar"
    >
      <div className="flex flex-col h-full bg-primary-900 gap-4 relative overflow-y-auto">
        <div className="flex-none sticky top-0 left-0 right-0 z-10 pb-8 bg-primary-900 pt-6">
          <SidebarHeader
            isOpen={isOpenConversationsSidebar}
            isMobile={isMobile}
            onToggle={toggleConversationsSidebar}
            handleNewChat={handleNewChat}
          />

          <div className="absolute bottom-[-14px] left-0 right-0 h-4 bg-gradient-to-b from-primary-900 to-transparent pointer-events-none" />
        </div>
        <div
          className={cn(
            "flex-1 px-6",
            !isOpenConversationsSidebar && "cursor-e-resize"
          )}
          onClick={(e) => {
            if (!isOpenConversationsSidebar) {
              e.preventDefault();
              e.stopPropagation();
              toggleConversationsSidebar();
            }
          }}
        >
          {loadingConversations ? (
            <div className="flex flex-col gap-1.5">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-[28px] my-2" />
              ))}
            </div>
          ) : (
            isOpenConversationsSidebar && (
              <div className="relative">
                <Conversations
                  isOpen={isOpenConversationsSidebar}
                  conversations={conversationsList || []}
                  fetchNextPage={fetchNextPage}
                  hasNextPage={hasNextPage}
                />
              </div>
            )
          )}
        </div>

        <div className="flex-none px-6 pb-6 pt-8 sticky bottom-[-2px] left-0 right-0 z-10 bg-primary-900 ">
          <div className="absolute top-[-10px] left-0 right-0 h-3 bg-gradient-to-t from-primary-900 to-transparent pointer-events-none z-10" />
          <div className="border-t-2 border-primary-500 pb-6 bg-primary-900" />
          <SidebarMenu isOpen={isOpenConversationsSidebar} />
        </div>
      </div>
    </Sidebar>
  );
};
