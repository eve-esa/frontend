import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import api from "./axios";
import { z } from "zod";
import { isPendingApproval } from "./approval";

export const ProfileSchema = z.object({
  first_name: z.string().min(1, "First name is required").optional(),
  last_name: z.string().min(1, "Last name is required").optional(),
  email: z.string().email().optional(),
  id: z.string().optional(),
  approval_status: z.string().nullish(),
});

export type ProfileType = z.infer<typeof ProfileSchema>;

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
