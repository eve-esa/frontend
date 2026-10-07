import type { Api } from "../fixtures";

/** The persisted shape of the last message, read the way the smoke harness does. */
export type PersistedTurn = {
  status: number;
  messages: number;
  stopped: boolean | null;
  documents: number;
  pipeline: string | null;
  outputChars: number;
};

type RawMessage = {
  output?: string;
  stopped?: boolean;
  documents?: unknown[];
  metadata?: { documents?: unknown[]; retrieved_docs?: unknown[]; pipeline?: string };
};

export async function lastPersistedTurn(api: Api, conversationId: string): Promise<PersistedTurn> {
  const { status, body } = await api.get<{ messages?: RawMessage[] }>(
    `/conversations/${conversationId}`,
  );
  const messages = status === 200 && body && typeof body === "object" ? body.messages ?? [] : [];
  const last = messages[messages.length - 1] ?? {};
  const docs = last.documents ?? last.metadata?.documents ?? last.metadata?.retrieved_docs ?? [];
  return {
    status,
    messages: messages.length,
    stopped: typeof last.stopped === "boolean" ? last.stopped : null,
    documents: Array.isArray(docs) ? docs.length : 0,
    pipeline: last.metadata?.pipeline ?? null,
    outputChars: (last.output ?? "").length,
  };
}

/** The raw documents persisted on the last message, wherever the pipeline put them. */
export async function lastPersistedDocuments(
  api: Api,
  conversationId: string,
): Promise<unknown[]> {
  const { status, body } = await api.get<{ messages?: RawMessage[] }>(
    `/conversations/${conversationId}`,
  );
  const messages = status === 200 && body && typeof body === "object" ? body.messages ?? [] : [];
  const last = messages[messages.length - 1] ?? {};
  const docs = last.documents ?? last.metadata?.documents ?? last.metadata?.retrieved_docs ?? [];
  return Array.isArray(docs) ? docs : [];
}

/** One persisted message with the fields the answer actions write. */
export type PersistedMessage = {
  id?: string;
  feedback?: string | null;
  was_copied?: boolean;
  documents?: unknown[];
  metadata?: { source_logs?: { source_url?: string }[] } | null;
};

/** The message with this id in the conversation, or null when it is not there (yet). */
export async function persistedMessage(
  api: Api,
  conversationId: string,
  messageId: string,
): Promise<PersistedMessage | null> {
  const { status, body } = await api.get<{ messages?: PersistedMessage[] }>(
    `/conversations/${conversationId}`,
  );
  if (status !== 200 || !body || typeof body !== "object") return null;
  return (body.messages ?? []).find((m) => m.id === messageId) ?? null;
}

export const QUESTION =
  process.env.E2E_QUESTION ??
  "Search the knowledge base for Sentinel-2 and quote one passage, then answer in one line.";

export const STOP_QUESTION =
  process.env.E2E_STOP_QUESTION ??
  "Write a very detailed, long essay of at least 1500 words on the history of the Copernicus " +
    "Sentinel missions, covering each mission, its instruments, launch dates and scientific results.";

/** One persisted agentic trace step, the fields the specs read. */
export type PersistedTraceStep = {
  node?: string;
  role?: string;
  name?: string;
  content?: unknown;
  tool_calls?: { name?: string }[];
};

/** The trace persisted on the last message; empty on the classic route. */
export async function lastPersistedTrace(
  api: Api,
  conversationId: string,
): Promise<PersistedTraceStep[]> {
  const { status, body } = await api.get<{ messages?: { trace?: PersistedTraceStep[] | null }[] }>(
    `/conversations/${conversationId}`,
  );
  const messages = status === 200 && body && typeof body === "object" ? body.messages ?? [] : [];
  const trace = messages[messages.length - 1]?.trace;
  return Array.isArray(trace) ? trace : [];
}

/** Index of the first tool step that ran `tool`, or -1. */
export function toolStepIndex(trace: PersistedTraceStep[], tool: string): number {
  return trace.findIndex((step) => step.role === "tool" && step.name === tool);
}

/** Index of the final answer: the last assistant step with text and no tool call, or -1. */
export function answerStepIndex(trace: PersistedTraceStep[]): number {
  for (let i = trace.length - 1; i >= 0; i -= 1) {
    const step = trace[i];
    const text = typeof step.content === "string" ? step.content.trim() : "";
    if (step.role === "assistant" && text && !(step.tool_calls ?? []).length) return i;
  }
  return -1;
}
