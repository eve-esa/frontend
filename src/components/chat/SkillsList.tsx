import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import useInfinityLoading from "@/hooks/useInfinityLoading";
import { cn } from "@/lib/utils";
import { useGetSkills, type SkillPublic } from "@/services/useGetSkills";
import {
  getSelectedSkillNames,
  toggleSkillSelection,
} from "@/utilities/skills";

// GET /skills, the body of the Skills accordion. The switch writes the
// `skills` key (utilities/skills.ts). useSendRequest reads that key for the
// agentic body. A disabled row stays visible and its switch does not change.
// The row shows the description only. The server keeps a conversation's
// skills from its first turn, so a change here applies to the next new
// conversation.
export const SkillsList = () => {
  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useGetSkills();
  const [endRef] = useInfinityLoading({
    fetchFunction: fetchNextPage,
    dependencies: [hasNextPage],
  });
  const [selectedSkills, setSelectedSkills] = useState<string[]>(() =>
    getSelectedSkillNames(),
  );
  const skills = data?.pages.flatMap((page) => page.data) ?? [];
  const isSelected = (name: string) => selectedSkills.includes(name);
  const toggleSkill = (name: string) =>
    setSelectedSkills((prev) => toggleSkillSelection(prev, name));

  return (
    <section
      className="flex w-full min-w-0 flex-col gap-4"
      data-testid="skills-section"
    >
      {isError ? (
        <p className="text-sm text-natural-200">Could not load the skills</p>
      ) : isLoading ? (
        <div className="flex flex-col gap-8">
          <Skeleton className="w-full h-6" />
          <Skeleton className="w-full h-6" />
          <Skeleton className="w-full h-6" />
        </div>
      ) : skills.length === 0 ? (
        <p className="text-sm text-natural-200">No skills found</p>
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-8">
          {skills.map((skill) => (
            <SkillRow
              key={skill.id ?? skill.name}
              skill={skill}
              selected={isSelected(skill.name)}
              onToggle={() => toggleSkill(skill.name)}
            />
          ))}
          {hasNextPage && <div ref={endRef} />}
          {isFetchingNextPage && <Skeleton className="w-full h-6" />}
        </div>
      )}
    </section>
  );
};

type SkillRowProps = {
  skill: SkillPublic;
  selected: boolean;
  onToggle: () => void;
};

const SkillRow = ({ skill, selected, onToggle }: SkillRowProps) => {
  const selectable = skill.enabled;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4",
        !selectable && "opacity-50",
      )}
      data-testid="skill-item"
      data-skill-enabled={selectable ? "true" : "false"}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Switch
          checked={selected}
          disabled={!selectable}
          onCheckedChange={() => {
            if (!selectable) return;
            onToggle();
          }}
        />
        <span
          data-testid="skill-name"
          className="min-w-0 break-words leading-none 3xl:text-3xl font-semibold text-natural-50"
        >
          {skill.name}
        </span>
      </div>
      {skill.description && (
        <p className="break-words text-xs 3xl:text-xl text-natural-200">
          {skill.description}
        </p>
      )}
    </div>
  );
};
