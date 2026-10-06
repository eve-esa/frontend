import path from "node:path";
import { flagOn } from "../pages";
import { expect, test } from "../fixtures";
import { lastPersistedDocuments, lastPersistedTurn } from "./conversation";

type CollectionRow = { id: string; name: string };
type DocumentRow = { id: string; name: string; collection_id: string };
type Paged<T> = { data?: T[] };

const FIXTURE = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "fixtures",
  "files",
  "private-fact.pdf",
);
const FILE_NAME = "private-fact.pdf";
// The made-up fact in the fixture (make-private-fact-pdf.mjs): no public corpus holds it.
const FACT_QUESTION =
  "Search the knowledge base: at what temperature was the e2e probe Zorvath-17 calibrated? " +
  "Answer in one line.";

test.describe("private collections @dev", () => {
  test("upload a PDF, answer from it with a year range set, then delete it", async ({
    chat,
    settings,
    myCollections,
    api,
  }) => {
    test.skip(
      !flagOn(await chat.servedConfig(), "FEATURE_PRIVATE_COLLECTIONS", false),
      "FEATURE_PRIVATE_COLLECTIONS is off in the served config",
    );
    const name = `e2e-${Date.now()}`;
    const collections = async (): Promise<CollectionRow[]> => {
      const list = await api.get<Paged<CollectionRow>>("/collections?limit=100&page=1");
      expect(list.status).toBe(200);
      return list.body.data ?? [];
    };
    const documents = async (collectionId: string): Promise<DocumentRow[]> => {
      const list = await api.get<Paged<DocumentRow>>(
        `/collections/${collectionId}/documents?limit=100&page=1`,
      );
      expect(list.status).toBe(200);
      return list.body.data ?? [];
    };
    let collectionId: string | null = null;

    try {
      // 1. Create from the Knowledge Base menu.
      await myCollections.open();
      await myCollections.create(name);
      collectionId = await myCollections.collectionId(name);
      expect((await collections()).map((c) => c.id)).toContain(collectionId);

      // 2 and 3. Upload the fixture; listed in the UI and through the API.
      await myCollections.openCollection(name);
      await myCollections.upload(FIXTURE);
      await expect(myCollections.document(FILE_NAME)).toBeVisible({ timeout: 90_000 });
      await expect
        .poll(async () => (await documents(collectionId as string)).map((d) => d.name), {
          timeout: 60_000,
        })
        .toContain(FILE_NAME);
      const documentId = (await documents(collectionId)).find((d) => d.name === FILE_NAME)
        ?.id as string;

      // 4. Enable the collection for the chat, set a year range, ask about the fact.
      // Private uploads carry no year: the range must not hide them (backend #294).
      await myCollections.backToList();
      await myCollections.setEnabled(name, true);
      await settings.open();
      await settings.setYearRange(2015, 2020);
      await settings.save();

      await chat.newChat();
      await chat.composer.send(FACT_QUESTION);
      const conversationId = await chat.waitForConversationId();
      await chat.composer.waitIdle();

      // 5. The answer quotes the fact or its sources list the upload, and the
      // persisted turn holds a document from the private collection.
      const answer = await chat.messages.lastAnswerText();
      const quoted = /4\.2\s*(k\b|kelvin)/i.test(answer);
      let listed = false;
      if ((await chat.messages.sourcesCount()) > 0) {
        await chat.messages.openSources();
        const titles = await chat.page.getByTestId("source-title").allInnerTexts();
        listed = titles.some((title) => title.includes("private-fact"));
      }
      expect(quoted || listed, `answer neither quotes the fact nor lists ${FILE_NAME}`).toBe(true);

      await expect
        .poll(async () => (await lastPersistedTurn(api, conversationId)).documents, {
          timeout: 30_000,
        })
        .toBeGreaterThan(0);
      const persisted = JSON.stringify(await lastPersistedDocuments(api, conversationId));
      expect(
        [collectionId, documentId, FILE_NAME].some((marker) => persisted.includes(marker)),
        "no persisted document comes from the private collection",
      ).toBe(true);

      // 6. Delete the document from the UI; the API row goes (the Qdrant
      // points follow once the document_id index is on dev).
      await myCollections.open();
      await myCollections.openCollection(name);
      await myCollections.deleteDocument(FILE_NAME);
      await expect
        .poll(async () => (await documents(collectionId as string)).map((d) => d.id), {
          timeout: 30_000,
        })
        .not.toContain(documentId);

      // 7. Delete the collection from the UI; gone from the API.
      await myCollections.deleteOpenCollection();
      await expect
        .poll(async () => (await collections()).map((c) => c.id), { timeout: 30_000 })
        .not.toContain(collectionId);
      collectionId = null;
    } finally {
      if (collectionId) await api.delete(`/collections/${collectionId}`);
    }
  });
});
