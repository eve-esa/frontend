import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { AgenticTraceStep, Document as AppDocument } from "@/types";
import { AgenticTrace } from "./AgenticTrace";
import { SettingsForm } from "./SettingsForm";
import { Sources } from "./Sources";
import { SharedCollections } from "./SharedCollections";
import { MyCollections } from "./MyCollections";
import { SharedToolkits } from "./SharedToolkits";

export type SidebarContentType =
  | "settings"
  | "sources"
  | "trace"
  | "shared-collections"
  | "my-collections"
  | "toolkits";

export type SidebarContent = {
  type: SidebarContentType;
  props?: {
    sources?: AppDocument[];
    trace?: AgenticTraceStep[];
    messageId?: string;
  };
};

const MESSAGE_SCOPED_SIDEBARS = new Set<SidebarContentType>([
  "sources",
  "trace",
]);

type SidebarContextType = {
  isOpenDynamicSidebar: boolean;
  isOpenConversationsSidebar: boolean;
  isMobile: boolean;
  content: SidebarContent | null;
  pendingConversations: Set<string>;
  openDynamicSidebar: (content: SidebarContent) => void;
  closeDynamicSidebar: () => void;
  renderSidebarContent: () => ReactNode;
  toggleConversationsSidebar: () => void;
  setPendingConversation: (conversationId: string) => void;
  removePendingConversation: (conversationId: string) => void;
  isConversationPending: (conversationId: string) => boolean;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

type SidebarProviderProps = {
  children: ReactNode;
};

export const DynamicSidebarProvider = ({ children }: SidebarProviderProps) => {
  const isMobile = useIsMobile();
  const [isOpenDynamicSidebar, setIsOpenDynamicSidebar] = useState(false);
  const [isOpenConversationsSidebar, setIsOpenConversationsSidebar] = useState(
    !isMobile
  );
  const [content, setContent] = useState<SidebarContent | null>(null);
  const [pendingConversations, setPendingConversationsState] = useState<
    Set<string>
  >(new Set());

  const closeDynamicSidebar = useCallback(() => {
    setIsOpenDynamicSidebar(false);
    setContent(null);
  }, []);

  const openDynamicSidebar = useCallback(
    (newContent: SidebarContent) => {
      if (
        content?.type === newContent.type &&
        isOpenDynamicSidebar &&
        !MESSAGE_SCOPED_SIDEBARS.has(newContent.type)
      ) {
        closeDynamicSidebar();
        return;
      }

      // Otherwise, open the new sidebar
      if (isMobile) {
        setIsOpenConversationsSidebar(false);
      }
      setContent(newContent);
      setIsOpenDynamicSidebar(true);
    },
    [content?.type, isOpenDynamicSidebar, isMobile, closeDynamicSidebar]
  );

  const toggleConversationsSidebar = useCallback(() => {
    setIsOpenConversationsSidebar(!isOpenConversationsSidebar);
  }, [isOpenConversationsSidebar]);

  const setPendingConversation = useCallback((conversationId: string) => {
    setPendingConversationsState((prev) => new Set([...prev, conversationId]));
  }, []);

  const removePendingConversation = useCallback((conversationId: string) => {
    setPendingConversationsState((prev) => {
      const newSet = new Set(prev);
      newSet.delete(conversationId);
      return newSet;
    });
  }, []);

  const isConversationPending = useCallback(
    (conversationId: string) => {
      return pendingConversations.has(conversationId);
    },
    [pendingConversations]
  );

  const renderSidebarContent = () => {
    if (!content) return null;

    switch (content.type) {
      case "settings":
        return <SettingsForm onToggle={closeDynamicSidebar} />;
      case "sources":
        return (
          <Sources
            onToggle={closeDynamicSidebar}
            sources={content.props?.sources || []}
            messageId={content.props?.messageId}
          />
        );
      case "trace":
        return (
          <AgenticTrace
            onToggle={closeDynamicSidebar}
            trace={content.props?.trace || []}
          />
        );
      case "shared-collections":
        return <SharedCollections onToggle={closeDynamicSidebar} />;
      case "my-collections":
        return <MyCollections onToggle={closeDynamicSidebar} />;
      case "toolkits":
        return <SharedToolkits onToggle={closeDynamicSidebar} />;
      default:
        return null;
    }
  };

  const contextValue: SidebarContextType = {
    isOpenDynamicSidebar,
    isOpenConversationsSidebar,
    isMobile,
    content,
    pendingConversations,
    openDynamicSidebar,
    closeDynamicSidebar,
    renderSidebarContent,
    toggleConversationsSidebar,
    setPendingConversation,
    removePendingConversation,
    isConversationPending,
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
};
// Custom hook to use the sidebar context
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};
