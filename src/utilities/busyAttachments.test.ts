import { afterEach, describe, expect, it, vi } from "vitest";
import type { PendingAttachment } from "@/components/chat/AttachmentPreviewList";
import {
  releaseSentAttachments,
  restoreSentAttachments,
  stashSentAttachments,
} from "./busyAttachments";

const uploaded = (id: string, filename: string) => ({
  id,
  url: `/artifacts/${id}`,
  filename,
  content_type: "image/png",
});

const item = (id: string, filename: string): PendingAttachment => ({
  localId: `local-${id}`,
  file: new File(["x"], filename, { type: "image/png" }),
  previewUrl: `blob:preview-${id}`,
  filename,
  status: "done",
  progress: 100,
  uploaded: uploaded(id, filename),
});

afterEach(() => {
  releaseSentAttachments("c1");
  vi.restoreAllMocks();
});

describe("restoreSentAttachments", () => {
  it("returns the very items sent, File and preview intact", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const sent = [item("a1", "map.png"), item("a2", "sar.png")];
    stashSentAttachments("c1", sent);

    const restored = restoreSentAttachments("c1", [
      uploaded("a1", "map.png"),
      uploaded("a2", "sar.png"),
    ]);

    expect(restored).toEqual(sent);
    expect(restored[0]).toBe(sent[0]);
    expect(revoke).not.toHaveBeenCalled();
    // Taken once: a second refusal of another send cannot reuse them.
    expect(restoreSentAttachments("c1", [uploaded("a1", "map.png")])[0]).not.toBe(
      sent[0],
    );
  });

  it("rebuilds a done chip for an upload the stash does not hold", () => {
    const [restored] = restoreSentAttachments("c1", [uploaded("a9", "doc.png")]);
    expect(restored).toMatchObject({
      status: "done",
      filename: "doc.png",
      previewUrl: "",
      uploaded: { id: "a9" },
    });
  });

  it("revokes previews of a previous send when the next one is stashed", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    stashSentAttachments("c1", [item("a1", "map.png")]);
    stashSentAttachments("c1", [item("a2", "sar.png")]);
    expect(revoke).toHaveBeenCalledWith("blob:preview-a1");
    expect(revoke).not.toHaveBeenCalledWith("blob:preview-a2");
  });
});
