import { useEffect, useState } from "react";

/** Below Tailwind's `md` breakpoint (48rem): the phone layout of the composer. */
export const PHONE_QUERY = "(width < 48rem)";

const matches = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(PHONE_QUERY).matches
    : false;

/**
 * True below the `md` breakpoint. Read on the first render so the layout does not flash, then
 * kept in step with the media query. Not `useIsMobile`, which switches at 1024 px and drives the
 * sidebar drawer.
 */
export const useIsPhone = () => {
  const [isPhone, setIsPhone] = useState(matches);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(PHONE_QUERY);
    const onChange = () => setIsPhone(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isPhone;
};
