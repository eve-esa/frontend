import { BETA_BADGE_ENABLED } from "@/utilities/features";

// Gated in the leaf rather than at the two call sites in SidebarHeader, so
// there is one place to flip and the header layout stays as it is.
export const Badge = () => {
  if (!BETA_BADGE_ENABLED) {
    return null;
  }

  return (
    <div className="text-[10px] 3xl:text-lg text-natural-500 bg-danger-100 3xl:px-2  3xl:py-[3px] px-1 py-[2px] rounded-xl leading-none tracking-[1px]">
      βeta
    </div>
  );
};
