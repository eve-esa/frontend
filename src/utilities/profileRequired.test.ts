import { describe, expect, it } from "vitest";
import {
  isProfileIncomplete,
  isWelcomeDialogPending,
  shouldAskProfileFields,
} from "./profileRequired";

describe("isProfileIncomplete", () => {
  it("is false with both fields set", () => {
    expect(isProfileIncomplete({ country: "Italy", institution: "ESA" })).toBe(false);
  });

  it.each([
    { country: "Italy" },
    { institution: "ESA" },
    { country: null, institution: "ESA" },
    { country: "Italy", institution: "" },
    { country: "  ", institution: "ESA" },
    {},
  ])("is true when one is missing, null, empty or blank: %j", (profile) => {
    expect(isProfileIncomplete(profile)).toBe(true);
  });
});

describe("isWelcomeDialogPending", () => {
  it("is true only with the flag on, on the empty chat, before the dialog was closed once", () => {
    expect(
      isWelcomeDialogPending({
        welcomeDialogEnabled: true,
        onEmptyChat: true,
        welcomeDialogViewed: false,
      }),
    ).toBe(true);
  });

  it.each([
    { welcomeDialogEnabled: false, onEmptyChat: true, welcomeDialogViewed: false },
    { welcomeDialogEnabled: true, onEmptyChat: false, welcomeDialogViewed: false },
    { welcomeDialogEnabled: true, onEmptyChat: true, welcomeDialogViewed: true },
  ])("is false for %j", (p) => {
    expect(isWelcomeDialogPending(p)).toBe(false);
  });
});

describe("shouldAskProfileFields", () => {
  const incomplete = { country: "Italy", institution: null };

  it("asks with the flag on, the profile loaded and incomplete, nothing else on screen", () => {
    expect(
      shouldAskProfileFields({ enabled: true, profile: incomplete, onboardingOpen: false }),
    ).toBe(true);
  });

  it("never asks with the flag off", () => {
    expect(
      shouldAskProfileFields({ enabled: false, profile: incomplete, onboardingOpen: false }),
    ).toBe(false);
  });

  it("waits for the profile to load", () => {
    expect(
      shouldAskProfileFields({ enabled: true, profile: undefined, onboardingOpen: false }),
    ).toBe(false);
  });

  it("waits while the onboarding page, the tour or the welcome dialog is open", () => {
    expect(
      shouldAskProfileFields({ enabled: true, profile: incomplete, onboardingOpen: true }),
    ).toBe(false);
  });

  it("does not ask a complete profile", () => {
    expect(
      shouldAskProfileFields({
        enabled: true,
        profile: { country: "Italy", institution: "ESA" },
        onboardingOpen: false,
      }),
    ).toBe(false);
  });
});
