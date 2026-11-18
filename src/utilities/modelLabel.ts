import { LLMType, LLMTypeLabel, type MessageType, type ModelListResponse } from "@/types";

const LLM_TYPE_TO_LABEL: Record<string, string> = {
  [LLMType.Main]: LLMTypeLabel.Main,
  [LLMType.Mistral]: LLMTypeLabel.Mistral,
  [LLMType.Satcom_Small]: LLMTypeLabel.Satcom_Small,
  [LLMType.Satcom_Large]: LLMTypeLabel.Satcom_Large,
  [LLMType.EVE_JSC]: LLMTypeLabel.EVE_JSC,
  fallback: "Fallback",
};

/** The picker label of a platform model: `/models` display name first. */
export const resolveLlmTypeLabel = (llmType: string, models?: ModelListResponse): string => {
  const platformModel = models?.platform.find((model) => model.llm_type === llmType);
  return platformModel?.display_name || LLM_TYPE_TO_LABEL[llmType] || llmType;
};

/**
 * The label of the platform model that answered, from the endpoint the
 * backend stored (`metadata.endpoint.answered`), or null when the message
 * does not say. Used where a step only carries a raw endpoint name.
 */
export const answeredModelLabel = (message: MessageType, models?: ModelListResponse): string | null => {
  const answered = message.metadata?.endpoint?.answered;
  return answered ? resolveLlmTypeLabel(answered, models) : null;
};
