import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import api from "./axios";

/**
 * The body of `PATCH /users`. `country` and `institution` are optional: left out, the backend
 * keeps what it has; an empty string clears the field. They are sent only with
 * FEATURE_PROFILE_FIELDS on, so a backend that does not know them never receives them.
 */
export type ProfileUpdate = {
  first_name: string;
  last_name: string;
  country?: string;
  institution?: string;
};

/** The submitted form values, before they become a request body. */
export type ProfileFormValues = {
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
  institution?: string | null;
};

/**
 * The form values a profile from `GET /users/me` prefills. A null country or institution becomes
 * "" so the input starts empty and an untouched field does not count as a change.
 */
export const toProfileFormValues = (profile: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  country?: string | null;
  institution?: string | null;
}) => ({
  first_name: profile.first_name ?? undefined,
  last_name: profile.last_name ?? undefined,
  email: profile.email ?? undefined,
  country: profile.country ?? "",
  institution: profile.institution ?? "",
});

/**
 * Turn the submitted form into the request body. With the extra fields on, both are always
 * sent, trimmed, so an emptied input reaches the backend as "" and clears the stored value.
 */
export const toProfileUpdate = (
  data: ProfileFormValues,
  withProfileFields: boolean
): ProfileUpdate => {
  const body: ProfileUpdate = {
    first_name: data.first_name || "",
    last_name: data.last_name || "",
  };
  if (withProfileFields) {
    body.country = (data.country ?? "").trim();
    body.institution = (data.institution ?? "").trim();
  }
  return body;
};

/**
 * The body the required profile dialog sends. `PATCH /users` always writes both names, so the
 * ones the profile already has go along unchanged and only country and institution change.
 */
export const toRequiredProfileUpdate = (
  profile: { first_name?: string | null; last_name?: string | null },
  data: { country?: string | null; institution?: string | null }
): ProfileUpdate =>
  toProfileUpdate(
    {
      first_name: profile.first_name,
      last_name: profile.last_name,
      country: data.country,
      institution: data.institution,
    },
    true
  );

export const httpUpdateProfile = async (body: ProfileUpdate) => {
  const { data } = await api.patch(`/users`, body);
  return data;
};

export const useUpdateProfile = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [MUTATION_KEYS.profile],
    mutationFn: (body: ProfileUpdate) => httpUpdateProfile(body),
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: () => {
      onSuccess?.();
      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.profile],
      });
    },
  });
};
