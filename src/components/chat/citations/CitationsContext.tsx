import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Citation, MarkerInstance, RetrievedSource } from "@/utilities/citations";

/**
 * One open source card per answer. A marker in the text, a number in the
 * sources list or a chip in the steps block opens it; each names its own
 * place (`m:<marker>`, `l:<n>`, `c:<step>:<n>`). The card is a Radix popover
 * anchored to that opener (`CardPopover`): Radix owns the click outside and
 * focus return; this context only holds which card is open. The opener is
 * found by id (`data-citation-opener="<scope>:<id>"`) whenever it is needed,
 * so a marker that a streaming re-render remounts still anchors the card and
 * no detached node is kept. Opening another card swaps `openId` in one
 * render, so there is never a frame with no card.
 */
type CitationsValue = {
  markers: readonly MarkerInstance[];
  citations: readonly Citation[];
  retrieved: readonly RetrievedSource[];
  /** Unique per answer: the card ids. */
  scope: string;
  openId: string | null;
  /** Latest `openId`, readable from Radix callbacks after a swap. */
  openIdRef: { readonly current: string | null };
  /** md and up: the card floats in a portal; below it sits in place under its line. */
  desktop: boolean;
  toggle: (id: string) => void;
  close: () => void;
  /** Moves focus into the open card (Tab from the opener). */
  focusCard: () => boolean;
  /** The live element that opens card `id`, looked up in the DOM. */
  openerOf: (id: string) => HTMLElement | null;
  /** Moves focus back to the opener of `id` without scrolling (Shift+Tab from the card's first control). */
  focusOpener: (id: string) => void;
  cardId: (id: string) => string;
  /** Value of the opener attribute of card `id`. */
  openerKey: (id: string) => string;
  onOpenMyCollections?: () => void;
};

const CitationsContext = createContext<CitationsValue | null>(null);

export const useCitations = () => useContext(CitationsContext);

const NO_RETRIEVED: readonly RetrievedSource[] = [];

export const FOCUSABLE = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Every element that opens a card carries it, so a press on one never counts as a click outside. */
export const OPENER_ATTR = "data-citation-opener";

const DESKTOP = "(min-width: 48rem)";

/** md and up (Tailwind `md`), one media listener per answer. */
const useDesktop = (): boolean => {
  const [desktop, setDesktop] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function" ? true : window.matchMedia(DESKTOP).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(DESKTOP);
    const onChange = () => setDesktop(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return desktop;
};

export const CitationsProvider = ({
  markers,
  citations,
  retrieved = NO_RETRIEVED,
  scope,
  onOpenMyCollections,
  children,
}: {
  markers: readonly MarkerInstance[];
  citations: readonly Citation[];
  retrieved?: readonly RetrievedSource[];
  scope: string;
  onOpenMyCollections?: () => void;
  children: ReactNode;
}) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const openIdRef = useRef<string | null>(null);
  const desktop = useDesktop();
  const safeScope = scope.replace(/[^A-Za-z0-9_-]/g, "_");
  const cardId = useCallback((id: string) => `source-card-${safeScope}-${id.replace(/[^A-Za-z0-9_-]/g, "_")}`, [safeScope]);

  const set = useCallback((id: string | null) => {
    openIdRef.current = id;
    setOpenId(id);
  }, []);

  const close = useCallback(() => set(null), [set]);

  const toggle = useCallback((id: string) => set(openIdRef.current === id ? null : id), [set]);

  const openerKey = useCallback((id: string) => `${safeScope}:${id}`, [safeScope]);

  const openerOf = useCallback(
    (id: string) =>
      typeof document === "undefined"
        ? null
        : document.querySelector<HTMLElement>(`[${OPENER_ATTR}="${CSS.escape(openerKey(id))}"]`),
    [openerKey],
  );

  const focusOpener = useCallback((id: string) => openerOf(id)?.focus({ preventScroll: true }), [openerOf]);

  const focusCard = useCallback(() => {
    if (!openId) return false;
    const card = document.getElementById(cardId(openId));
    const first = card?.querySelector<HTMLElement>(FOCUSABLE) ?? card;
    if (!first) return false;
    first.focus();
    return true;
  }, [openId, cardId]);

  const value = useMemo<CitationsValue>(
    () => ({
      markers,
      citations,
      retrieved,
      scope: safeScope,
      openId,
      openIdRef,
      desktop,
      toggle,
      close,
      focusCard,
      openerOf,
      focusOpener,
      cardId,
      openerKey,
      onOpenMyCollections,
    }),
    [markers, citations, retrieved, safeScope, openId, desktop, toggle, close, focusCard, openerOf, focusOpener, cardId, openerKey, onOpenMyCollections],
  );
  return <CitationsContext.Provider value={value}>{children}</CitationsContext.Provider>;
};
