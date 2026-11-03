import { useState, type ReactNode } from "react";
import { faChevronDown, faChevronRight, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { Button } from "@/components/ui/Button";
import { useGetMcpServers } from "@/services/useGetMcpServers";
import { SkillsList } from "./SkillsList";
import { SharedToolkitsList } from "./SharedToolkitsList";
import { enabledToolkits } from "@/utilities/toolkits";

type SharedToolkitsProps = {
  onToggle: () => void;
};

type Section = "tools" | "skills";

export const SharedToolkits = ({ onToggle }: SharedToolkitsProps) => {
  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useGetMcpServers();
  // Both sections start closed. Opening one closes the other.
  const [open, setOpen] = useState<Section | null>(null);

  // Same helper the sidebar entry uses to decide whether to exist at all, so the
  // two cannot disagree about what "empty" means.
  const serversList = enabledToolkits(data?.pages);
  const isEmpty = !isLoading && !isError && serversList.length === 0;
  const onSection = (section: Section) => (next: boolean) =>
    setOpen(next ? section : null);

  return (
    <div
      data-testid="toolkits-panel"
      className="flex flex-col h-full py-6 gap-6 md:gap-10"
    >
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
            conversation. Toggle the switch next to each toolkit to include it
            when you send a prompt. Browse each toolkit to see its available
            tools and what they do.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto min-w-0 flex flex-col gap-8 py-2 px-6">
        <div className="flex w-full min-w-0 flex-col gap-2">
          <AccordionSection
            title="Tools"
            testId="toolkits-tools"
            open={open === "tools"}
            onOpenChange={onSection("tools")}
          >
            {isError ? (
              // Distinct from the empty state on purpose. "None found" and
              // "could not ask" are opposite situations, and rendering them
              // identically is what makes a broken catalog look like a
              // deliberately empty one.
              <p className="text-sm text-natural-200">
                Could not load the toolkits
              </p>
            ) : isEmpty ? (
              <p className="text-sm text-natural-200">
                No shared toolkits found
              </p>
            ) : (
              <SharedToolkitsList
                isLoading={isLoading}
                isFetchingNextPage={isFetchingNextPage}
                serversList={serversList}
                fetchNextPage={fetchNextPage}
                hasNextPage={hasNextPage}
              />
            )}
          </AccordionSection>
          <AccordionSection
            title="Skills"
            testId="toolkits-skills"
            open={open === "skills"}
            onOpenChange={onSection("skills")}
          >
            <SkillsList />
          </AccordionSection>
        </div>
      </div>
    </div>
  );
};

type AccordionSectionProps = {
  title: string;
  testId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

const AccordionSection = ({
  title,
  testId,
  open,
  onOpenChange,
  children,
}: AccordionSectionProps) => (
  <Collapsible
    className="w-full min-w-0"
    open={open}
    onOpenChange={onOpenChange}
  >
    <CollapsibleTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="md"
        data-testid={testId}
        className="w-full justify-start"
      >
        <span className="whitespace-nowrap mt-[2px] overflow-hidden text-ellipsis font-['NotesESA']">
          {title}
        </span>
        <FontAwesomeIcon
          icon={open ? faChevronDown : faChevronRight}
          className="w-4 h-4"
        />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="w-full min-w-0">
      <div className="w-full min-w-0 overflow-x-hidden pt-4">{children}</div>
    </CollapsibleContent>
  </Collapsible>
);
