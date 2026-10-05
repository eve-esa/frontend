import { z } from "zod";

type ProfileFields = {
  country?: string | null;
  institution?: string | null;
};

const isBlank = (value?: string | null) => !value?.trim();

/**
 * True when `GET /users/me` lacks a country or an institution. Null, missing, empty and
 * whitespace only all count as missing: the backend strips both fields and stores a blank one as
 * null, so a value the user cannot see must not count as given.
 */
export const isProfileIncomplete = (profile: ProfileFields): boolean =>
  isBlank(profile.country) || isBlank(profile.institution);

/**
 * The refinement that turns the two optional profile fields into required ones. Applied on top
 * of ProfileSchema, so the length limits stay the ones declared there.
 */
export const requireProfileFields = (
  value: ProfileFields,
  ctx: z.RefinementCtx
) => {
  if (isBlank(value.country)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["country"],
      message: "Country is required",
    });
  }
  if (isBlank(value.institution)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["institution"],
      message: "Institution is required",
    });
  }
};

/**
 * The welcome dialog ChatEmpty opens on "/" until the user closes it once. Read here so the
 * required profile dialog waits for it instead of opening on top of it.
 */
export const isWelcomeDialogPending = (p: {
  welcomeDialogEnabled: boolean;
  onEmptyChat: boolean;
  welcomeDialogViewed: boolean;
}): boolean => p.welcomeDialogEnabled && p.onEmptyChat && !p.welcomeDialogViewed;

/**
 * Whether the required profile dialog is shown. Only with FEATURE_PROFILE_FIELDS on, only once
 * the profile has loaded, and never while the onboarding page, the tour or the welcome dialog
 * is on screen: two modals at once would fight over focus.
 */
export const shouldAskProfileFields = (p: {
  enabled: boolean;
  profile?: ProfileFields | null;
  onboardingOpen: boolean;
}): boolean =>
  p.enabled &&
  Boolean(p.profile) &&
  !p.onboardingOpen &&
  isProfileIncomplete(p.profile as ProfileFields);
