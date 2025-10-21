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
  // Transient notices to show before the final answer while streaming
  pre_answer_notices?: string[];
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
