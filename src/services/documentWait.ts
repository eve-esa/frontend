import { fetchIngestJob, type IngestJob } from "./useConversationDocuments";

/**
 * A chat turn sent with new documents waits here until the background job has
 * parsed and embedded them, so the answer can search them. One wait per
 * conversation; Stop cancels it before anything reaches the model.
 */

const POLL_MS = 3000;
const MAX_WAIT_MS = 30 * 60 * 1000;

const waits = new Map<string, { canceled: boolean }>();

export class DocumentWaitCanceled extends Error {
  constructor() {
    super("Document wait canceled");
    this.name = "DocumentWaitCanceled";
  }
}

export const isDocumentWaitActive = (conversationId: string) =>
  waits.has(conversationId);

export const cancelDocumentWait = (conversationId: string) => {
  const wait = waits.get(conversationId);
  if (wait) wait.canceled = true;
};

const pause = (ms: number, wait: { canceled: boolean }) =>
  new Promise<void>((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (wait.canceled || Date.now() - started >= ms) resolve();
      else setTimeout(tick, 200);
    };
    tick();
  });

/** Resolves with the finished job (done or failed); throws DocumentWaitCanceled on Stop. */
export const waitForIngestJob = async (
  conversationId: string,
  jobId: string,
): Promise<Pick<IngestJob, "status" | "error_code">> => {
  const wait = { canceled: false };
  waits.set(conversationId, wait);
  const started = Date.now();
  try {
    for (;;) {
      if (wait.canceled) throw new DocumentWaitCanceled();
      try {
        const job = await fetchIngestJob(jobId);
        if (job.status === "done" || job.status === "failed") return job;
      } catch {
        // A missed poll is retried.
      }
      if (Date.now() - started > MAX_WAIT_MS) {
        return { status: "failed", error_code: "document_ingest_failed" };
      }
      await pause(POLL_MS, wait);
    }
  } finally {
    if (waits.get(conversationId) === wait) waits.delete(conversationId);
  }
};
