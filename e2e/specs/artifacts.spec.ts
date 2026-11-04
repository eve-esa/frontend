import { ArtifactsPage, flagOrEnvOn, ImageLightbox } from "../pages";
import { expect, test } from "../fixtures";
import { TEST_IMAGE, testImage } from "../fixtures/png";

type ArtifactRow = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  conversation_id?: string | null;
  source?: { type?: string } | null;
};
type Paged<T> = { data?: T[] };
type PersistedAttachment = { image_id?: string; filename?: string; content_type?: string };

// Any short question: the turn only has to persist the message that carries the image.
const IMAGE_QUESTION = "Reply with one word: ok.";

/**
 * Zoom in twice, pan, reset, close. Proves the lightbox the image opened in shows the stored
 * bytes (decoded width) and that zoom, pan and reset move the rendered transform.
 */
async function zoomPanReset(lightbox: ImageLightbox): Promise<void> {
  await lightbox.waitOpen(TEST_IMAGE.width);
  expect(await lightbox.state()).toEqual({ zoom: 1, x: 0, y: 0 });
  await expect(lightbox.zoomOutButton).toBeDisabled();
  await expect(lightbox.resetButton).toBeDisabled();

  await lightbox.zoomIn();
  await expect.poll(() => lightbox.zoom()).toBe(1.5);
  await lightbox.zoomIn();
  await expect.poll(() => lightbox.zoom()).toBe(2);
  await expect(lightbox.zoomOutButton).toBeEnabled();
  await expect(lightbox.resetButton).toBeEnabled();

  await lightbox.pan(-80, -60);
  await expect.poll(async () => (await lightbox.state()).x).toBeLessThan(0);
  expect((await lightbox.state()).y).toBeLessThan(0);

  await lightbox.reset();
  await expect.poll(() => lightbox.state()).toEqual({ zoom: 1, x: 0, y: 0 });
  await expect(lightbox.resetButton).toBeDisabled();
  await lightbox.close();
}

test.describe("artifacts and the image lightbox @dev", () => {
  test("an image attached to a turn opens in the lightbox, zooms, pans and resets", async ({
    chat,
    authedPage: page,
    api,
  }) => {
    test.setTimeout(300_000);
    test.skip(
      !flagOrEnvOn(await chat.servedConfig(), "FEATURE_ATTACHMENTS", false),
      "FEATURE_ATTACHMENTS is off for this target",
    );
    const image = testImage("e2e-lightbox");
    let conversationId: string | null = null;

    try {
      await chat.newChat();
      const artifactId = await chat.composer.attach(image);
      await chat.composer.send(IMAGE_QUESTION);
      conversationId = await chat.waitForConversationId();
      await chat.composer.waitIdle();

      // The thumbnail in the user bubble is the stored image, fetched with the bearer.
      const thumbnail = chat.messages.last.getByTestId("message-attachment-image");
      await expect(thumbnail).toHaveJSProperty("tagName", "IMG");
      await expect(thumbnail).toHaveJSProperty("naturalWidth", TEST_IMAGE.width);
      await thumbnail.click();
      await zoomPanReset(new ImageLightbox(page));

      // Persisted: the message carries the attachment, the artifact belongs to the conversation.
      const conversation = await api.get<{ messages?: { attachments?: PersistedAttachment[] }[] }>(
        `/conversations/${conversationId}`,
      );
      expect(conversation.status).toBe(200);
      const attachments = conversation.body.messages?.at(-1)?.attachments ?? [];
      expect(attachments).toContainEqual(
        expect.objectContaining({
          image_id: artifactId,
          filename: image.name,
          content_type: "image/png",
        }),
      );
      const listed = await api.get<Paged<ArtifactRow>>(
        `/artifacts?conversation_id=${conversationId}&limit=10&page=1`,
      );
      expect(listed.status).toBe(200);
      expect(listed.body.data ?? []).toContainEqual(
        expect.objectContaining({
          id: artifactId,
          filename: image.name,
          size_bytes: image.buffer.length,
          conversation_id: conversationId,
        }),
      );
    } finally {
      // Artifacts are permanent by design (no DELETE route); only the conversation goes.
      if (conversationId) await api.delete(`/conversations/${conversationId}`);
    }
  });

  test("the Artifacts page lists an uploaded image and opens it in the lightbox", async ({
    chat,
    authedPage: page,
    api,
  }) => {
    test.skip(
      !flagOrEnvOn(await chat.servedConfig(), "FEATURE_ARTIFACTS", false),
      "FEATURE_ARTIFACTS is off for this target",
    );
    const image = testImage("e2e-artifacts");
    const artifacts = new ArtifactsPage(page);

    // The same POST /artifacts the composer sends, so the page can be checked where
    // attachments are off.
    const upload = await api.postFile<{ id?: string }>("/artifacts", image);
    expect(upload.status, "upload").toBe(200);
    const artifactId = upload.body.id as string;
    expect(artifactId, "the upload returned no id").toBeTruthy();

    await artifacts.open();
    await expect(artifacts.card(image.name)).toBeVisible();
    const thumbnail = artifacts.thumbnail(image.name);
    await expect(thumbnail).toHaveJSProperty("tagName", "IMG");
    await expect(thumbnail).toHaveJSProperty("naturalWidth", TEST_IMAGE.width);
    await thumbnail.click();
    await zoomPanReset(new ImageLightbox(page));

    // The list the page reads: newest first, so this run's upload is on the first page.
    const listed = await api.get<Paged<ArtifactRow>>("/artifacts?limit=24&page=1");
    expect(listed.status).toBe(200);
    expect(listed.body.data ?? []).toContainEqual(
      expect.objectContaining({
        id: artifactId,
        filename: image.name,
        content_type: "image/png",
        size_bytes: image.buffer.length,
        source: expect.objectContaining({ type: "upload" }),
      }),
    );
  });
});
