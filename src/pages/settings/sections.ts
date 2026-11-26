import {
  API_KEYS_ENABLED,
  CUSTOM_MODELS_ENABLED,
  SETTINGS_USAGE_ENABLED,
  THEME_SWITCH_ENABLED,
  TOOLKIT_CREDENTIALS_ENABLED,
} from "@/utilities/features";

export const SETTINGS_PATH = "/settings";

/** One entry per section, in the order the list shows them. */
export const SETTINGS_SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance", flag: "themeSwitch" },
  { id: "models", label: "Models", flag: "customModels" },
  { id: "toolkits", label: "Toolkits", flag: "toolkitCredentials" },
  { id: "usage", label: "Usage", flag: "usage" },
  { id: "api-keys", label: "API keys", flag: "apiKeys" },
  { id: "account", label: "Account" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  flag?: SettingsFlag;
};

/** What decides whether a section is listed. Profile and Account are always there. */
export type SettingsFlags = {
  /** FEATURE_THEME_SWITCH. */
  themeSwitch: boolean;
  /** FEATURE_CUSTOM_MODELS, which is already off with agentic chat off. */
  customModels: boolean;
  /** FEATURE_TOOLKIT_CREDENTIALS. */
  toolkitCredentials: boolean;
  /** FEATURE_SETTINGS_USAGE. */
  usage: boolean;
  /** FEATURE_API_KEYS. */
  apiKeys: boolean;
};

type SettingsFlag = keyof SettingsFlags;

export const currentSettingsFlags = (): SettingsFlags => ({
  themeSwitch: THEME_SWITCH_ENABLED,
  customModels: CUSTOM_MODELS_ENABLED,
  toolkitCredentials: TOOLKIT_CREDENTIALS_ENABLED,
  usage: SETTINGS_USAGE_ENABLED,
  apiKeys: API_KEYS_ENABLED,
});

/** The sections to list: those whose own feature is on, in display order. */
export const visibleSections = (
  flags: SettingsFlags = currentSettingsFlags()
): SettingsSection[] =>
  (SETTINGS_SECTIONS as readonly SettingsSection[]).filter(
    (section) => !section.flag || flags[section.flag]
  );

/**
 * The section a URL segment names, or Profile when it is missing, unknown or hidden by its
 * feature. Profile is never hidden, so the fallback always exists.
 */
export const resolveSection = (
  param: string | undefined,
  flags: SettingsFlags = currentSettingsFlags()
): SettingsSectionId =>
  visibleSections(flags).find((section) => section.id === param)?.id ??
  "profile";

export const settingsPath = (section: SettingsSectionId): string =>
  `${SETTINGS_PATH}/${section}`;
