import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import type { ThemeChoice } from "@/utilities/theme";
import { SettingsPanel, SettingsSection } from "./SettingsSection";

const THEME_OPTIONS: {
  value: ThemeChoice;
  label: string;
  description: string;
}[] = [
  { value: "system", label: "System", description: "Follows your device setting." },
  { value: "light", label: "Light", description: "White panels on a light grey ground." },
  { value: "dark", label: "Dark", description: "Deep Space panels on a dark ground." },
];

type MiniVariant = "light" | "dark";

// Constant tokens only (on-accent, cta, composer-edge and the two preview
// grounds), so a card looks the same whichever theme is active.
const MINI_STYLES: Record<
  MiniVariant,
  { ground: string; strip: string; bars: [string, string, string] }
> = {
  light: {
    ground: "bg-preview-light-ground",
    strip: "bg-on-accent",
    bars: [
      "bg-cta",
      "bg-on-accent border border-composer-edge/40",
      "bg-composer-edge",
    ],
  },
  dark: {
    ground: "bg-preview-dark-ground",
    strip: "bg-cta",
    bars: [
      "bg-on-accent",
      "bg-cta border border-composer-edge",
      "bg-on-accent/80",
    ],
  },
};

const BAR_WIDTHS = ["w-[55%]", "w-[80%]", "w-[40%]"];

/** One mini screen: sidebar strip, two bars and a composer bar. */
const Mini = ({ variant, className = "" }: { variant: MiniVariant; className?: string }) => {
  const style = MINI_STYLES[variant];
  return (
    <span className={`flex size-full overflow-hidden rounded ${style.ground} ${className}`}>
      <span className={`w-4 shrink-0 ${style.strip}`} />
      <span className="flex flex-1 flex-col gap-1.5 p-2">
        {style.bars.map((bar, index) => (
          <span key={index} className={`block h-2 rounded-xs ${BAR_WIDTHS[index]} ${bar}`} />
        ))}
      </span>
    </span>
  );
};

/** Decorative picture of a theme. System: left half light, right half dark. */
const ThemePreview = ({ value }: { value: ThemeChoice }) => (
  <span aria-hidden="true" className="relative mb-2 block h-16 w-full">
    {value === "system" ? (
      <>
        <Mini variant="light" />
        <Mini
          variant="dark"
          className="absolute inset-0 [clip-path:inset(0_0_0_50%)]"
        />
      </>
    ) : (
      <Mini variant={value === "dark" ? "dark" : "light"} />
    )}
  </span>
);

/** System, Light and Dark. The choice applies at once and lives in this browser's localStorage. */
export const AppearanceSection = () => {
  const theme = useTheme();
  const [saved, setSaved] = useState(false);

  return (
    <SettingsSection
      id="appearance"
      title="Appearance"
      lead="Choose how EVE looks on this browser. The choice applies at once."
    >
      <SettingsPanel>
        <fieldset
          data-testid="settings-theme-options"
          className="grid gap-3 md:grid-cols-3"
        >
          <legend className="mb-3 font-['NotesESA'] text-sm">Theme</legend>
          {THEME_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-control p-4 has-[:checked]:bg-highlight has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus"
            >
              <input
                type="radio"
                name="theme"
                value={option.value}
                data-testid={`settings-theme-${option.value}`}
                checked={theme.choice === option.value}
                onChange={() => {
                  theme.setChoice(option.value);
                  setSaved(true);
                }}
                className="mt-1 size-4 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-natural-200 checked:border-natural-50 checked:bg-natural-50 checked:shadow-[inset_0_0_0_2px_var(--color-highlight)] focus-visible:outline-none"
              />
              <span className="flex flex-1 flex-col gap-1">
                <ThemePreview value={option.value} />
                <span className="font-['NotesESA'] text-lg text-natural-50">
                  {option.label}
                </span>
                <span className="text-sm text-natural-200">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <p
          role="status"
          data-testid="settings-appearance-status"
          className="mt-4 text-sm text-natural-200"
        >
          {saved ? "Saved on this browser only." : "The choice is saved on this browser only."}
        </p>
      </SettingsPanel>
    </SettingsSection>
  );
};
