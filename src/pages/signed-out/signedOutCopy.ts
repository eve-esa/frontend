import type { SignedOutReason } from "@/services/oidc";

/** Heading and message of the signed-out view for each reason. */
export const signedOutCopy = (
  reason: SignedOutReason
): { title: string; message: string } =>
  reason === "expired"
    ? {
        title: "Your session has expired",
        message: "Your session has expired. Sign in again.",
      }
    : {
        title: "You are signed out",
        message: "You signed out of EVE in another tab or window.",
      };
