import type { ImageAttachment, RawMessageAttachment } from "@/types";

/**
 * Normalizes a message attachment to the canonical `ImageAttachment` shape.
 *
 * Message attachments can reach the UI in two shapes:
 *  - the canonical frontend shape (`id`, `size`) for optimistic messages;
 *  - the backend-persisted shape (`image_id`, `size_bytes`) returned by
 *    GET /conversations.
 *
 * This mapper accepts either and always returns `ImageAttachment`.
 */
export const toImageAttachment = (
  raw: RawMessageAttachment,
): ImageAttachment => ({
  id: raw.id ?? raw.image_id ?? "",
  url: raw.url,
  filename: raw.filename,
  content_type: raw.content_type,
  size: raw.size ?? raw.size_bytes,
});
