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
  stopped?: boolean;
  timestamp: Date;
  documents: Document[];
  // Images attached to the user turn. Stored in the canonical frontend shape
  // (`ImageAttachment`) for optimistic messages, but the backend persists them
  // with different keys (`image_id`/`size_bytes`) — see `RawMessageAttachment`
  // and `toImageAttachment` in `utilities/attachments.ts`.
  attachments?: RawMessageAttachment[];
  // Ids of artifacts (uploads or MCP-generated images) associated with this
  // message, per the final SSE event / message response. Lets the persisted
  // message state know about its artifacts without waiting for the
  // onSettled refetch.
  artifact_ids?: string[];
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
  request_input: {
    llm_type: string | null;
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

// ─── Image attachments ───────────────────────────────────────────────────────

// Canonical attachment shape used throughout the frontend UI.
export type ImageAttachment = {
  id: string;
  url: string;
  filename: string;
  content_type: string;
  size?: number;
};

// Raw attachment as persisted / returned by the backend on GET /conversations.
// Backend keys differ from `ImageAttachment` (image_id -> id, size_bytes -> size),
// so message attachments may arrive in either shape. `toImageAttachment` in
// `utilities/attachments.ts` normalizes both. `ImageAttachment` is assignable to
// this type, which is why optimistic messages can carry the canonical shape.
export type RawMessageAttachment = {
  id?: string;
  image_id?: string;
  url: string;
  filename: string;
  content_type: string;
  size?: number;
  size_bytes?: number;
};

// Response of POST /artifacts.
export type ImageUploadResponse = {
  id: string;
  url: string;
  markdown: string;
  filename: string;
  content_type: string;
  size_bytes: number;
};

// How an artifact came to exist: uploaded directly by the user, or produced by
// an MCP tool call. Deletion is only allowed for "upload" (backend 403s
// otherwise), so the UI hides the delete button for "mcp_tool" items.
export type ArtifactSource = {
  type: "mcp_tool" | "upload";
  mcp_server?: string;
  tool_name?: string;
};

// Item returned by the paginated GET /artifacts (Artifacts gallery).
export type ImageAsset = {
  id: string;
  url?: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  conversation_id?: string | null;
  timestamp?: string;
  source?: ArtifactSource;
};

export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const MAX_ATTACHMENTS_PER_MESSAGE = 4;
