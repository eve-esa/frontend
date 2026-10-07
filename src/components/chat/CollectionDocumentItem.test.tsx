import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentType } from "@/services/useGetDocuments";
import { CollectionDocumentItem } from "./CollectionDocumentItem";

/**
 * The date under a private document is its upload time (`timestamp`), never
 * the render time. The backend sends it without an offset, meaning UTC.
 */
vi.mock("@/services/useMe", () => ({
  useGetProfile: () => ({ data: { id: "u1" } }),
}));
vi.mock("./DeleteDocumentDialog", () => ({ DeleteDocumentDialog: () => null }));

const DOCUMENT: DocumentType = {
  id: "d1",
  name: "paper.pdf",
  chunk_count: 3,
  collection_id: "c1",
  file_size: 1024,
  file_type: "application/pdf",
  filename: "paper.pdf",
  source_url: "",
  timestamp: "2026-10-06T23:30:00",
  user_id: "u1",
};

const DATE = /data-testid="collection-document-date"[^>]*>([^<]*)</;

const renderedDate = (document: DocumentType): string | null =>
  renderToStaticMarkup(
    <CollectionDocumentItem document={document} isLastItem />,
  ).match(DATE)?.[1] ?? null;

const originalTz = process.env.TZ;

describe("CollectionDocumentItem date", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it("shows the upload date, not today", () => {
    process.env.TZ = "UTC";
    expect(
      renderedDate({ ...DOCUMENT, timestamp: "2025-03-14T10:00:00.123000" }),
    ).toBe("14 March 2025");
  });

  it("reads an offsetless timestamp as UTC and shows the local day", () => {
    process.env.TZ = "Europe/Rome";
    expect(renderedDate(DOCUMENT)).toBe("7 October 2026");
    process.env.TZ = "UTC";
    expect(renderedDate(DOCUMENT)).toBe("6 October 2026");
  });

  it("keeps an explicit offset", () => {
    process.env.TZ = "UTC";
    expect(
      renderedDate({ ...DOCUMENT, timestamp: "2026-10-07T01:00:00+02:00" }),
    ).toBe("6 October 2026");
  });

  it("renders no date when the timestamp is missing or invalid", () => {
    process.env.TZ = "UTC";
    const missing = { ...DOCUMENT, timestamp: undefined } as unknown as DocumentType;
    expect(renderToStaticMarkup(
      <CollectionDocumentItem document={missing} isLastItem />,
    )).not.toContain("collection-document-date");
    expect(renderedDate({ ...DOCUMENT, timestamp: "not a date" })).toBeNull();
  });
});
