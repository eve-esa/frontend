import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import api from "./axios";
import { z } from "zod";
import { isPendingApproval } from "./approval";
import { requireProfileFields } from "@/utilities/profileRequired";

export const PROFILE_COUNTRY_MAX = 100;
export const PROFILE_INSTITUTION_MAX = 200;

export const ProfileSchema = z.object({
  first_name: z.string().min(1, "First name is required").optional(),
  last_name: z.string().min(1, "Last name is required").optional(),
  email: z.string().email().optional(),
  id: z.string().optional(),
  approval_status: z.string().nullish(),
  // Free text, null until the user sets them. Shown and saved only with
  // FEATURE_PROFILE_FIELDS on, and then required (RequiredProfileSchema below);
  // the limits match the backend's.
  country: z
    .string()
    .max(PROFILE_COUNTRY_MAX, `Country must be at most ${PROFILE_COUNTRY_MAX} characters`)
    .nullish(),
  institution: z
    .string()
    .max(
      PROFILE_INSTITUTION_MAX,
      `Institution must be at most ${PROFILE_INSTITUTION_MAX} characters`
    )
    .nullish(),
});

export type ProfileType = z.infer<typeof ProfileSchema>;

/** The profile dialog with FEATURE_PROFILE_FIELDS on: country and institution required. */
export const RequiredProfileSchema = ProfileSchema.superRefine(requireProfileFields);

/** The required profile dialog: only the two fields, required, with the same limits. */
export const RequiredProfileFieldsSchema = ProfileSchema.pick({
  country: true,
  institution: true,
}).superRefine(requireProfileFields);

export type RequiredProfileFieldsType = z.infer<typeof RequiredProfileFieldsSchema>;

export const httpUserMe = async (): Promise<ProfileType> => {
  const response = await api.get(`/users/me`);
  return response.data;
};

export const useGetProfile = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: [QUERY_KEYS.profile],
    queryFn: () => httpUserMe(),
    enabled: options?.enabled,
    // A pending account gets this 403 on every call and approval only
    // happens outside the app, so retrying cannot help: one retry is wasted
    // work at best and a flash of extra spinner at worst. Anything else
    // still gets the one retry the query-client default already grants.
    retry: (failureCount, error) =>
      !isPendingApproval(error) && failureCount < 1,
  });
};
