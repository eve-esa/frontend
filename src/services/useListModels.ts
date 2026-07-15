import { useQuery } from "@tanstack/react-query";
import api from "./axios";
import { QUERY_KEYS } from "./keys";
import type { ModelListResponse } from "@/types";

const fetchModels = async (): Promise<ModelListResponse> => {
  const { data } = await api.get<ModelListResponse>("/models");
  return data;
};

export const useListModels = () =>
  useQuery({
    queryKey: [QUERY_KEYS.models],
    queryFn: fetchModels,
  });
