import type { PendingAttachment } from "@/components/chat/AttachmentPreviewList";
import type { ImageAttachment } from "@/types";

// The composer clears its attachments at send. A send refused by an overloaded
// backend hands the uploaded attachments back (see serviceBusy), so the
// composer keeps what it sent, File and preview included, until the next send
// or until it unmounts, and puts the same items back on a refusal.
const sent = new Map<string, PendingAttachment[]>();

const revoke = (item: PendingAttachment) => {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
};

export const releaseSentAttachments = (conversationId: string) => {
  sent.get(conversationId)?.forEach(revoke);
  sent.delete(conversationId);
};

export const stashSentAttachments = (
  conversationId: string,
  items: PendingAttachment[],
) => {
  releaseSentAttachments(conversationId);
  if (items.length > 0) sent.set(conversationId, items);
};

// The composer items for the attachments a refused send carried. An upload the
// stash no longer holds (the first message of a new chat is sent from another
// composer) comes back as a file chip without a thumbnail; it is already
// uploaded, so the File is never read again.
export const restoreSentAttachments = (
  conversationId: string,
  attachments: ImageAttachment[] | undefined,
): PendingAttachment[] => {
  const stash = sent.get(conversationId) ?? [];
  sent.delete(conversationId);
  const byId = new Map(
    stash
      .filter((item) => item.uploaded)
      .map((item) => [item.uploaded?.id, item] as const),
  );
  const restored = (attachments ?? []).map(
    (uploaded): PendingAttachment =>
      byId.get(uploaded.id) ?? {
        localId: `restored-${uploaded.id}`,
        file: new File([], uploaded.filename, { type: uploaded.content_type }),
        previewUrl: "",
        filename: uploaded.filename,
        status: "done",
        progress: 100,
        uploaded,
      },
  );
  stash.filter((item) => !restored.includes(item)).forEach(revoke);
  return restored;
};
