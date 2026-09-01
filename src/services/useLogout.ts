import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signoutRedirect } from "./oidc";
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

  return useMutation({
    mutationFn: async () => {
      queryClient.clear();
      for (const key of PER_USER_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
      // Ends the IdP session and leaves the page; no navigation after this.
      await signoutRedirect();
    },
    onSuccess: () => {
      onSuccess?.();
    },
  });
};
