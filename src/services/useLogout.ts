import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { beginSignout, endSignout } from "./oidc";
import {
  LOCAL_STORAGE_DRAFT_NEW_CONVERSATION,
  LOCAL_STORAGE_MCP_SERVERS,
  LOCAL_STORAGE_PRIVATE_COLLECTIONS,
  LOCAL_STORAGE_PUBLIC_COLLECTIONS,
  LOCAL_STORAGE_SETTINGS,
} from "@/utilities/localStorage";

// Everything localStorage holds that belongs to the signed-in user rather
// than to the browser. Cleared on logout so the next account on this machine
// does not inherit it. "login_email" is a leftover key from the pre-OIDC
// login form; nothing writes it anymore but old profiles may still carry it.
const PER_USER_STORAGE_KEYS = [
  LOCAL_STORAGE_SETTINGS,
  LOCAL_STORAGE_PUBLIC_COLLECTIONS,
  LOCAL_STORAGE_PRIVATE_COLLECTIONS,
  LOCAL_STORAGE_MCP_SERVERS,
  LOCAL_STORAGE_DRAFT_NEW_CONVERSATION,
  "login_email",
];

export const useLogout = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();
  const auth = useAuth();

  return useMutation({
    mutationFn: async () => {
      // Sets the latch first: nothing after this may start a competing
      // sign-in. See beginSignout in oidc.ts for why.
      const signoutArgs = await beginSignout();
      try {
        queryClient.clear();
        for (const key of PER_USER_STORAGE_KEYS) {
          localStorage.removeItem(key);
        }
        // Through useAuth(), not the raw userManager: this sets
        // auth.activeNavigator, which PrivateRoute treats as "a navigation
        // is in flight". Ends the IdP session and leaves the page; no
        // navigation after this in the success case.
        await auth.signoutRedirect(signoutArgs);
      } finally {
        // Only reached if the redirect never left the page.
        endSignout();
      }
    },
    onSuccess: () => {
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Logout failed:", error);
    },
  });
};
