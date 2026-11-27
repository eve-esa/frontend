import { isAxiosError } from "axios";
import type { ImageAttachment } from "@/types";
import api from "./axios";

/** Files the backend parses into a conversation's documents. */
export const CONVERSATION_DOCUMENT_EXTENSIONS = [".pdf", ".txt", ".md"];
export const MAX_CONVERSATION_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const isConversationDocument = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return CONVERSATION_DOCUMENT_EXTENSIONS.some((ext) => name.endsWith(ext));
};

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
};

/** The message of a coded backend error (`{detail: {code, message}}`), or a fallback. */
export const documentErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      return String(detail.message);
    }
    if (typeof detail === "string") return detail;
  }
  return fallback;
};

export const JOB_ERROR_MESSAGES: Record<string, string> = {
  document_unreadable: "No text could be read from this file.",
  document_too_many_chunks: "This upload is too long. Try fewer or smaller files.",
  document_ingest_failed: "The document could not be processed.",
  document_too_many_pages: "This document has too many pages to read.",
  document_parser_unavailable:
    "Reading documents is not available right now. Try again later.",
};

/** Documents sent with a message: their chips, and the job that processes them. */
export type SentDocuments = {
  documents: ImageAttachment[];
  jobId: string;
};

/**
 * Upload files as documents of a conversation. The backend stores them and
 * queues one background job (202); the chat turn waits for that job.
 */
export const uploadConversationDocuments = async (
  conversationId: string,
  files: File[],
): Promise<SentDocuments> => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const { data } = await api.post(
    `/conversations/${conversationId}/documents`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  const sizes = new Map(files.map((file) => [file.name, file.size]));
  const documents = (data.documents ?? []).map(
    (doc: { document_id: string; name: string }): ImageAttachment => {
      const extension = doc.name.split(".").pop()?.toLowerCase() ?? "";
      return {
        id: doc.document_id,
        url: `/conversations/${conversationId}/documents/${doc.document_id}/file`,
        filename: doc.name,
        content_type: CONTENT_TYPES[extension] ?? "application/octet-stream",
        size: sizes.get(doc.name),
      };
    },
  );
  return { documents, jobId: data.job_id };
};

export type IngestJob = {
  job_id: string;
  // parsing: with the document parser (backend DOCUMENT_PARSER=queue), still waiting.
  status: "queued" | "running" | "parsing" | "done" | "failed";
  error_code: string | null;
};

/** The state of one background ingest job. */
export const fetchIngestJob = async (jobId: string): Promise<IngestJob> => {
  const { data } = await api.get(`/document-ingest-jobs/${jobId}`);
  return data as IngestJob;
};
