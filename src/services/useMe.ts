import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import api from "./axios";
import { z } from "zod";

export const ProfileSchema = z.object({
  first_name: z.string().min(1, "First name is required").optional(),
  last_name: z.string().min(1, "Last name is required").optional(),
  email: z.string().email().optional(),
  id: z.string().optional(),
});

export type ProfileType = z.infer<typeof ProfileSchema>;

export const httpUserMe = async (): Promise<ProfileType> => {
  const response = await api.get(`/users/me`);
  return response.data;
};

export const useGetProfile = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.profile],
    queryFn: () => httpUserMe(),
  });
};
