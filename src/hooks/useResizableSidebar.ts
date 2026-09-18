import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { LOCAL_STORAGE_RIGHT_SIDEBAR_WIDTH } from "@/utilities/localStorage";
import {
  MIN_CHAT_COLUMN_WIDTH_PX,
  SIDEBAR_KEYBOARD_STEP_PX,
  clampSidebarWidth,
  getSidebarWidthBounds,
  parseStoredSidebarWidth,
  type SidebarWidthBounds,
} from "@/utilities/sidebarWidth";

// Storage can be missing or throw (private mode, blocked site data): the
// width then simply lasts for the session.
const readStoredWidth = (key: string): number | null => {
  try {
    return parseStoredSidebarWidth(window.localStorage.getItem(key));
  } catch {
    return null;
  }
};

const writeStoredWidth = (key: string, width: number | null) => {
  try {
    if (width === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(width));
  } catch {
    // Not persisted; the in-memory width still applies.
  }
};

const setBodyDragStyles = (dragging: boolean) => {
  document.body.style.cursor = dragging ? "col-resize" : "";
  document.body.style.userSelect = dragging ? "none" : "";
};

type DragState = {
  pointerId: number;
  startX: number;
  startWidth: number;
  width: number;
  moved: boolean;
};

type UseResizableSidebarOptions = {
  /** Open and docked (not the mobile overlay). */
  enabled: boolean;
  sidebarRef: RefObject<HTMLDivElement | null>;
  storageKey?: string;
};

/**
 * Drag, keyboard and double-click resizing for the right sidebar, which is
 * anchored to the right edge, so moving its left edge left widens it.
 *
 * Until the user resizes, it returns no style and the sidebar keeps its CSS
 * widths. While dragging, the width is written straight to the element and
 * committed to state on release, so the panel content does not re-render on
 * every pointer move.
 */
export const useResizableSidebar = ({
  enabled,
  sidebarRef,
  storageKey = LOCAL_STORAGE_RIGHT_SIDEBAR_WIDTH,
}: UseResizableSidebarOptions) => {
  const [storedWidth, setStoredWidth] = useState<number | null>(() =>
    readStoredWidth(storageKey),
  );
  const [bounds, setBounds] = useState<SidebarWidthBounds>(() =>
    getSidebarWidthBounds(window.innerWidth),
  );
  const [isResizing, setIsResizing] = useState(false);
  const boundsRef = useRef(bounds);
  const dragRef = useRef<DragState | null>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const measure = useCallback((): SidebarWidthBounds => {
    const sidebar = sidebarRef.current;
    const chatColumn = document.querySelector<HTMLElement>("[data-chat-column]");
    const available =
      sidebar && chatColumn
        ? sidebar.getBoundingClientRect().right -
          chatColumn.getBoundingClientRect().left -
          MIN_CHAT_COLUMN_WIDTH_PX
        : undefined;
    const next = getSidebarWidthBounds(window.innerWidth, available);
    boundsRef.current = next;
    setBounds((current) =>
      current.min === next.min && current.max === next.max ? current : next,
    );
    return next;
  }, [sidebarRef]);

  // Re-measure when the viewport changes, and when the chat column or the
  // sidebar itself changes size: the conversations sidebar opening next to a
  // wide right sidebar squeezes one of the two, since the chat column holds
  // its minimum.
  useEffect(() => {
    if (!enabled) return;
    measure();
    let frame = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measure());
    };
    window.addEventListener("resize", scheduleMeasure);
    const observed = [
      document.querySelector("[data-chat-column]"),
      sidebarRef.current,
    ].filter((element): element is Element => element !== null);
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleMeasure)
        : null;
    observed.forEach((element) => observer?.observe(element));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleMeasure);
      observer?.disconnect();
    };
  }, [enabled, measure, sidebarRef]);

  // A drag cut short (the sidebar closed, the layout switched to mobile)
  // must not leave the page unselectable, nor the width it wrote directly.
  useEffect(() => {
    if (enabled || !dragRef.current) return;
    dragRef.current = null;
    setIsResizing(false);
    setBodyDragStyles(false);
    sidebarRef.current?.style.removeProperty("width");
    sidebarRef.current?.style.removeProperty("min-width");
    sidebarRef.current?.style.removeProperty("max-width");
  }, [enabled, sidebarRef]);

  useEffect(
    () => () => {
      if (dragRef.current) setBodyDragStyles(false);
    },
    [],
  );

  const width =
    enabled && storedWidth !== null
      ? clampSidebarWidth(storedWidth, bounds)
      : null;

  const commitWidth = (next: number | null) => {
    setStoredWidth(next);
    writeStoredWidth(storageKey, next);
  };

  const applyWidthDuringDrag = (next: number) => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    sidebar.style.width = `${next}px`;
    sidebar.style.maxWidth = `${next}px`;
    sidebar.style.minWidth = `${boundsRef.current.min}px`;
    handleRef.current?.setAttribute("aria-valuenow", String(next));
  };

  const currentWidth = (current: SidebarWidthBounds): number =>
    clampSidebarWidth(
      width ?? sidebarRef.current?.getBoundingClientRect().width ?? current.min,
      current,
    );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !sidebarRef.current) return;
    event.preventDefault();
    const current = measure();
    const startWidth = currentWidth(current);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth,
      width: startWidth,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
    setBodyDragStyles(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = clampSidebarWidth(
      drag.startWidth + (drag.startX - event.clientX),
      boundsRef.current,
    );
    if (next === drag.width) return;
    drag.width = next;
    drag.moved = true;
    applyWidthDuringDrag(next);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsResizing(false);
    setBodyDragStyles(false);
    if (drag.moved) commitWidth(drag.width);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const current = measure();
    const from = currentWidth(current);
    const next =
      event.key === "ArrowLeft"
        ? from + SIDEBAR_KEYBOARD_STEP_PX
        : event.key === "ArrowRight"
          ? from - SIDEBAR_KEYBOARD_STEP_PX
          : event.key === "Home"
            ? current.min
            : current.max;
    commitWidth(clampSidebarWidth(next, current));
  };

  // The large shrink factor makes this sidebar, not the conversations one,
  // give way first when the row runs out of room before the next measure.
  const style: CSSProperties | undefined =
    width !== null
      ? { width, minWidth: bounds.min, maxWidth: width, flexShrink: 100 }
      : undefined;

  return {
    isResizing,
    style,
    handleProps: {
      ref: handleRef,
      "aria-valuenow": width ?? bounds.min,
      "aria-valuemin": bounds.min,
      "aria-valuemax": bounds.max,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
      onDoubleClick: () => commitWidth(null),
      onKeyDown,
    },
  };
};
