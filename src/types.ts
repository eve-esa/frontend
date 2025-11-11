import type { AxiosError } from "axios";
import { z } from "zod";

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
  timestamp: Date;
  documents: Document[];
  answer?: string;
  was_copied?: boolean;
  query?: string;
  hallucination?: {
    label: number;
    reason: string | null;
    rewritten_query: string | null;
    final_answer: string | null;
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
  metadata?: {
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
    };
  };
};

export type ChaMessageType = {
  id: string;
  name: string;
  timestamp: Date;
  user_id: string;
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
  Runpod = "runpod",
  Mistral = "mistral",
  Satcom_Small = "satcom_small",
  Satcom_Large = "satcom_large",
}
