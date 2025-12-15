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
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/Dialog";

export const ConversationsMenuSidebar = () => {
  const [isDiscoverDialogOpen, setIsDiscoverDialogOpen] =
    useState<boolean>(false);
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

  const handleOpenDiscoverDialog = () => {
    setIsDiscoverDialogOpen(true);
  };

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
            onDiscoverEve={handleOpenDiscoverDialog}
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

        <Dialog
          open={isDiscoverDialogOpen}
          onOpenChange={setIsDiscoverDialogOpen}
        >
          <DialogContent className="max-w-4xl md:!max-w-[800px] h-full md:h-fit">
            <DialogDescription asChild>
              <div className="space-y-6 text-primary-100 smarttext max-h-[80vh] overflow-y-auto overflow-x-auto">
                <section className="space-y-2">
                  <h3 className="font-bold text-natural-50 text-lg">
                    What EVE Can Do
                  </h3>
                  <p>
                    EVE is your AI companion for exploring Earth Observation and
                    Earth Science.
                  </p>
                  <ul className="list-disc space-y-2 pl-5">
                    <li>
                      ✔️{" "}
                      <span className="font-bold">
                        Ask domain-specific questions
                      </span>{" "}
                      — from “What is Sentinel-2 used for?” to “How do SAR
                      backscatter changes relate to flooding?”
                    </li>
                    <li>
                      ✔️{" "}
                      <span className="font-bold">
                        Discover relevant documents
                      </span>{" "}
                      — papers, datasets, definitions, methods.
                    </li>
                    <li>
                      ✔️{" "}
                      <span className="font-bold">
                        Get grounded answers
                      </span>{" "}
                      backed by EVE’s curated RAG system (ESA, NASA, Copernicus,
                      peer-reviewed sources).
                    </li>
                    <li>
                      ✔️{" "}
                      <span className="font-bold">
                        Check the exact sources behind an answer
                      </span>{" "}
                      — every response includes the documents EVE used to
                      produce it, so you can inspect the evidence yourself.
                    </li>
                    <li>
                      ✔️{" "}
                      <span className="font-bold">
                        Explore concepts in natural language
                      </span>{" "}
                      just like talking to an EO expert.
                    </li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h3 className="font-bold text-natural-50 text-lg">
                    What EVE Cannot Do (Yet)
                  </h3>
                  <ul className="list-disc space-y-2 pl-5">
                    <li>
                      ❌{" "}
                      <span className="font-bold">
                        No document-level control.
                      </span>{" "}
                      You cannot instruct EVE to “only use this specific PDF” or
                      “focus on this paragraph” — retrieval is global, not
                      document-scoped.
                    </li>
                    <li>
                      ❌{" "}
                      <span className="font-bold">
                        No live internet or web search.
                      </span>{" "}
                      EVE cannot fetch the latest news, newly published papers,
                      or any up-to-the-minute datasets.
                    </li>
                    <li>
                      ❌{" "}
                      <span className="font-bold">
                        No access to proprietary services unless integrated.
                      </span>{" "}
                      EVE cannot query external APIs, commercial databases, or
                      cloud platforms you use at work.
                    </li>
                    <li>
                      ❌{" "}
                      <span className="font-bold">
                        No visual understanding (for now).
                      </span>{" "}
                      The pilot model is text-only — it cannot read satellite
                      images or plots yet.
                    </li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h3 className="font-bold text-natural-50 text-lg">
                    Tips for Best Results
                  </h3>
                  <ul className="list-disc space-y-2 pl-5">
                    <li>💡 Ask clear, specific EO/ES questions.</li>
                    <li>💡 Request examples (e.g. “give me 3 use cases…”).</li>
                    <li>💡 Use follow-ups to refine answers.</li>
                    <li>
                      💡 Ask for definitions, comparisons, workflows, or
                      high-level summaries.
                    </li>
                    <li className="space-y-1">
                      <span>
                        💡 Try exploratory questions, for example:
                      </span>
                      <ul className="list-[square] pl-5 space-y-1">
                        <li>
                          “Show me documents about wildfire monitoring.”
                        </li>
                        <li>“Explain this concept like I’m new to EO.”</li>
                        <li>“Give me related terms to …”</li>
                      </ul>
                    </li>
                  </ul>
                </section>
              </div>
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </div>
    </Sidebar>
  );
}


