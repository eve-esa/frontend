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
