import type { AxiosError } from "axios";
import { z } from "zod";

export type AgenticTraceStep = Record<string, unknown>;

export type Document = {
  id: string | number;
  text: string;
  collection_name: string;
  payload: {
    title: string;
    url: string;
    text?: string;
    content?: string;
  };
  metadata: {
    additionalMetadata: {
      link: string;
      title: string;
      journalTitle: string;
      citationLine: string;
    };
  };
};

export type MessageType = {
  conversation_id: string;
  feedback: string | null;
  id: string;
  input: string;
  output: string;
  stopped?: boolean;
  timestamp: Date;
  documents: Document[];
  answer?: string;
  was_copied?: boolean;
  query?: string;
  hallucination?: {
    label: number;
    reason: string | null;
    rewritten_question: string | null;
    final_answer: string | null;
    // Hallucination-specific feedback state
    feedback?: string | null;
    feedback_reason?: string | null;
    was_copied?: boolean;
    latencies: {
      detect: number | null;
      rewrite: number | null;
      final_answer: number | null;
      total: number | null;
    };
    top_k_retrieved_docs?: Document[] | null;
  } | null;
  // Transient notices to show before the final answer while streaming
  pre_answer_notices?: string[];
  trace?: AgenticTraceStep[] | null;
  request_input: {
    llm_type: string | null;
    custom_model_id?: string | null;
  };
  metadata?: {
    generated_model_name: string | null;
    latencies: {
      guardrail_latency: number | null;
      rag_decision_latency: number | null;
      reranking_latency: number | null;
      query_embedding_latency: number | null;
      qdrant_retrieval_latency: number | null;
      mcp_retrieval_latency: number | null;
      base_generation_latency: number | null;
      fallback_latency: number | null;
      hallucination_latency: number | null;
      total_latency: number | null;
    };
    prompts: {
      guardrail_prompt: string | null;
      guardrail_result: string | null;
      is_rag_prompt: string | null;
      rag_decision_result: {
        use_rag: boolean;
        reason: string;
        requery: string;
      };
      generation_prompt: string | null;
      custom_model_display_name?: string | null;
      custom_model_name?: string | null;
      agentic_llm_resolved?: string | null;
      used_fallback_llm?: boolean | null;
    };
  };
};

export type ChaMessageType = {
  id: string;
  name: string;
  timestamp: Date;
  user_id: string;
  stopped?: boolean;
  messages: MessageType[];
};

export type DetailsError = {
  msg: string;
};

export type DetailsErrorArr = {
  detail: DetailsError[];
};

export type ApiError = AxiosError<{ detail: string | DetailsError[] }>;

export type Meta = {
  current_page: number;
  has_next: boolean;
  total_count: number;
  total_pages: number;
};

export const OptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export type OptionType = z.infer<typeof OptionSchema>;

export enum SSEEventType {
  CHAT = "chat:new-message",
}

export enum LLMType {
  Main = "main",
  Mistral = "mistral",
  Satcom_Small = "satcom_small",
  Satcom_Large = "satcom_large",
  EVE_JSC = "eve_jsc"
}

export enum LLMTypeLabel {
  Main = "EVE Instruct",
  Mistral = "Mistral Medium",
  Satcom_Small = "SatcomLLM - Small",
  Satcom_Large = "SatcomLLM - Large",
  EVE_JSC = "EVE-JSC"
}

export type PlatformModel = {
  id: string;
  llm_type: string;
  display_name: string;
  description?: string | null;
};

export type ProviderCatalogModel = {
  id: string;
  display_name: string;
  model_name: string;
};

export type ProviderCatalog = {
  id: string;
  display_name: string;
  models: ProviderCatalogModel[];
};

export type CustomModel = {
  id: string;
  display_name: string;
  provider_id: string;
  catalog_model_id: string;
  provider_display_name: string;
  model_display_name: string;
  model_name: string;
  has_api_key: boolean;
  created_at: string;
  updated_at: string;
};

export type ModelListResponse = {
  platform: PlatformModel[];
  providers: ProviderCatalog[];
  custom: CustomModel[];
};

export type ModelSelection =
  | { type: "platform"; id: string }
  | { type: "custom"; id: string };
