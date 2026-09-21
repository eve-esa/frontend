/**
 * Width rules for the resizable right sidebar (DynamicSidebar). The sidebar
 * can only grow from its default width; the upper bound keeps the chat
 * column usable next to it.
 */

export const SIDEBAR_MAX_WIDTH_PX = 960;
export const SIDEBAR_MAX_VIEWPORT_SHARE = 0.75;
// The chat column never gets narrower than this because of the sidebar.
// Mirrors `lg:min-w-[400px]` on the chat column in ChatLayout.tsx.
export const MIN_CHAT_COLUMN_WIDTH_PX = 400;
export const SIDEBAR_KEYBOARD_STEP_PX = 24;

export type SidebarWidthBounds = { min: number; max: number };

/**
 * The width the sidebar has without any resizing, per viewport. Mirrors the
 * open-state width classes in components/ui/Sidebar.tsx: keep them in step.
 */
export const getDefaultSidebarWidth = (viewportWidth: number): number => {
  if (viewportWidth >= 3200) return 600;
  if (viewportWidth >= 2560) return 480;
  if (viewportWidth >= 1920) return 400;
  if (viewportWidth >= 1400) return 340;
  return 310;
};

/**
 * min is the default width. max is the smallest of 960px, 75% of the
 * viewport, and the room left once the chat column keeps its minimum
 * (`availableWidth`, unknown when the layout could not be measured); it never
 * drops below min.
 */
export const getSidebarWidthBounds = (
  viewportWidth: number,
  availableWidth: number = Number.POSITIVE_INFINITY,
): SidebarWidthBounds => {
  const min = getDefaultSidebarWidth(viewportWidth);
  const max = Math.floor(
    Math.min(
      SIDEBAR_MAX_WIDTH_PX,
      viewportWidth * SIDEBAR_MAX_VIEWPORT_SHARE,
      availableWidth,
    ),
  );
  return { min, max: Math.max(min, max) };
};

export const clampSidebarWidth = (
  width: number,
  bounds: SidebarWidthBounds,
): number => Math.round(Math.min(bounds.max, Math.max(bounds.min, width)));

/** A stored width, or null when missing or not a positive number. */
export const parseStoredSidebarWidth = (raw: string | null): number | null => {
  if (raw === null || raw.trim() === "") return null;
  const width = Number(raw);
  return Number.isFinite(width) && width > 0 ? Math.round(width) : null;
};
