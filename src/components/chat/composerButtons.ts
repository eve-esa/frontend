import { MOBILE_COMPOSER_ENABLED } from "@/utilities/features";

/**
 * Class lists of the composer's buttons. Flag off: today's 32 px icons. Flag on: 44 px squares on
 * every width. Attach and Control Panel are flat fills, no border: dark keeps today's highlight
 * (`#335E6F` at 40 % over the card), light takes the Silver tint (`highlight`, `#E8ECEF`), and
 * hover is one step further. Send and Stop are the one filled control: Deep Space (`cta`) in light,
 * the highlight token in dark, because the cta is 1.1:1 on the dark card (docs/BRAND.md).
 */
export const composerButtonClasses = (enabled: boolean = MOBILE_COMPOSER_ENABLED) => {
  if (!enabled) {
    const icon = "h-8 w-8 p-0 cursor-pointer";
    return { quiet: icon, quietWide: icon, filled: icon };
  }
  const quiet =
    "h-[44px] min-w-[44px] p-0 cursor-pointer bg-highlight/40 text-natural-50 in-data-[theme=light]:bg-highlight enabled:hover:bg-highlight/60 enabled:hover:text-natural-50 in-data-[theme=light]:enabled:hover:bg-primary-500";
  return {
    quiet: `${quiet} w-[44px]`,
    quietWide: `${quiet} gap-2 px-3 text-[14px]`,
    filled:
      "h-[44px] w-[44px] p-0 cursor-pointer bg-highlight text-on-accent in-data-[theme=light]:bg-cta enabled:hover:bg-highlight/85 enabled:hover:text-on-accent in-data-[theme=light]:enabled:hover:bg-cta-hover disabled:opacity-35",
  };
};
