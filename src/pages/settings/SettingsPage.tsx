import { useEffect, useRef, type ComponentType } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { useSidebar } from "@/components/chat/DynamicSidebarProvider";
import { cn } from "@/lib/utils";
import { AccountSection } from "./AccountSection";
import { ApiKeysSection } from "./ApiKeysSection";
import { AppearanceSection } from "./AppearanceSection";
import { ModelsSection } from "./ModelsSection";
import { ProfileSection } from "./ProfileSection";
import { settingsTitleId } from "./SettingsSection";
import { UsageSection } from "./UsageSection";
import {
  currentSettingsFlags,
  resolveSection,
  settingsPath,
  visibleSections,
  type SettingsSectionId,
} from "./sections";

const SECTION_COMPONENTS: Record<SettingsSectionId, ComponentType> = {
  profile: ProfileSection,
  appearance: AppearanceSection,
  models: ModelsSection,
  usage: UsageSection,
  "api-keys": ApiKeysSection,
  account: AccountSection,
};

/**
 * `/settings/:section` inside the chat layout. A section the URL does not name, or whose feature
 * is off, redirects to Profile. Desktop lists the sections at the left; below `md` one native
 * select does the same job.
 */
export const SettingsPage = () => {
  const { section: param } = useParams();
  const navigate = useNavigate();
  const flags = currentSettingsFlags();
  const section = resolveSection(param, flags);
  const sections = visibleSections(flags);
  const Section = SECTION_COMPONENTS[section];

  const { isMobile, isOpenConversationsSidebar, toggleConversationsSidebar } =
    useSidebar();

  // The drawer that led here closes behind the user on a phone.
  const closeDrawer = useRef<() => void>(() => undefined);
  closeDrawer.current = () => {
    if (isMobile && isOpenConversationsSidebar) toggleConversationsSidebar();
  };
  useEffect(() => {
    closeDrawer.current();
  }, []);

  // Moving to another section puts focus on its heading, so a screen reader announces it.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById(settingsTitleId(section))?.focus();
  }, [section]);

  if (param !== section) {
    return <Navigate to={settingsPath(section)} replace />;
  }

  return (
    <div
      data-testid="settings-page"
      className="flex h-full w-full flex-col bg-natural-900 in-data-[theme=light]:bg-(--color-chat-ground)"
    >
      <div className="flex-none">
        <ChatHeader />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-10">
        <div className="grid w-full md:grid-cols-[188px_minmax(0,960px)] md:gap-x-8">
          <nav aria-label="Settings sections" className="hidden md:block">
            <p className="mb-3 ml-3 text-md text-natural-200">Settings</p>
            <ul className="flex flex-col gap-0.5">
              {sections.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    item.id === "account" &&
                      "mt-2 border-t border-primary-400 pt-2"
                  )}
                >
                  <Link
                    to={settingsPath(item.id)}
                    data-testid={`settings-nav-${item.id}`}
                    aria-current={item.id === section ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center rounded-lg px-3 text-md text-natural-50 hover:bg-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                      item.id === section && "bg-highlight font-bold"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mb-6 flex flex-col gap-2 md:hidden">
            <label
              htmlFor="settings-section-select"
              className="font-['NotesESA'] text-sm"
            >
              Section
            </label>
            <select
              id="settings-section-select"
              data-testid="settings-nav-select"
              value={section}
              onChange={(event) =>
                navigate(settingsPath(resolveSection(event.target.value, flags)))
              }
              className="h-12 w-full min-w-0 cursor-pointer rounded-lg border border-control bg-primary-200 px-3 text-base text-natural-100 shadow-xs outline-none in-data-[theme=light]:shadow-none in-data-[theme=light]:focus-visible:ring-2 in-data-[theme=light]:focus-visible:ring-focus"
            >
              {sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <Section />
          </div>
        </div>
      </div>
    </div>
  );
};
