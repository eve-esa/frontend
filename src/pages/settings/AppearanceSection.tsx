import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { parseThemeChoice, type ThemeChoice } from "@/utilities/theme";
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
                  theme.setChoice(parseThemeChoice(option.value));
                  setSaved(true);
                }}
                className="mt-1 size-4 accent-focus"
              />
              <span className="flex flex-col gap-1">
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
          className="mt-4 min-h-5 text-sm text-natural-200"
        >
          {saved ? "Saved." : ""}
        </p>
        <p className="text-sm text-natural-200">Saved on this browser only.</p>
      </SettingsPanel>
    </SettingsSection>
  );
};
