import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SettingsSectionId } from "./sections";

type SettingsSectionProps = {
  id: SettingsSectionId;
  title: string;
  /** One sentence under the heading. */
  lead?: string;
  children?: ReactNode;
};

export const settingsTitleId = (id: SettingsSectionId) =>
  `settings-${id}-title`;

/**
 * The frame every section shares: heading, optional lead, content. The heading takes focus
 * when the user moves to another section (see SettingsPage), hence tabIndex -1.
 */
export const SettingsSection = ({
  id,
  title,
  lead,
  children,
}: SettingsSectionProps) => (
  <section
    data-testid={`settings-section-${id}`}
    aria-labelledby={settingsTitleId(id)}
  >
    <h1
      id={settingsTitleId(id)}
      tabIndex={-1}
      className="text-2xl font-bold text-natural-50 outline-none"
    >
      {title}
    </h1>
    {lead && (
      <p className="mt-1 mb-6 max-w-[60ch] text-md text-natural-200">{lead}</p>
    )}
    {children}
  </section>
);

type SettingsPanelProps = {
  children: ReactNode;
  className?: string;
};

/**
 * A card on the page: the dialog surface with its edge in dark, white with no edge on the light
 * ground (the approved preview). The edge stays 1px in both themes, only its colour changes.
 */
export const SettingsPanel = ({ children, className }: SettingsPanelProps) => (
  <div
    className={cn(
      "rounded-lg border border-primary-400 bg-primary-600 p-4 md:p-6 in-data-[theme=light]:border-transparent",
      className
    )}
  >
    {children}
  </div>
);
