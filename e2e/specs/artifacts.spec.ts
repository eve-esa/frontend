import { ArtifactsPage, flagOn, flagOrEnvOn, ImageLightbox } from "../pages";
import { expect, test, type Api } from "../fixtures";
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
type McpServerRow = { name: string; enabled: boolean };

const IMAGE_SERVER = "dummy_image";
// Local storage key the Toolkits switches write (src/utilities/localStorage.ts): the turn sends
// these names as `public_mcp_servers` (src/services/useSendRequest.ts).
const MCP_SELECTION_KEY = "mcp_servers";
const IMAGE_TOOL_QUESTION =
  "Call the get_sample_image tool once with color green and size 600, then show me the image it returned.";

/** Whether `dummy_image` is an enabled row of GET /mcp-servers for this user (global or own). */
async function imageServerEnabled(api: Api): Promise<boolean> {
  for (let page = 1; page <= 10; page += 1) {
    const { status, body } = await api.get<{ data?: McpServerRow[]; meta?: { has_next?: boolean } }>(
      `/mcp-servers?limit=100&page=${page}`,
    );
    expect(status).toBe(200);
    if ((body.data ?? []).some((row) => row.name === IMAGE_SERVER && row.enabled)) return true;
    if (!body.meta?.has_next) return false;
  }
  return false;
}

// Any short question: the turn only has to persist the message that carries the image.
const IMAGE_QUESTION = "Reply with one word: ok.";

/**
 * Zoom in twice, pan, reset, close. Proves the lightbox the image opened in shows the stored
 * bytes (decoded width) and that zoom, pan and reset move the rendered transform. The pan is
 * clamped to the canvas, not to the image, so any decoded size can be panned.
 */
async function zoomPanReset(lightbox: ImageLightbox, width: number = TEST_IMAGE.width): Promise<void> {
  await lightbox.waitOpen(width);
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

  test("an image in an assistant answer opens in the lightbox and is listed in Artifacts", async ({
    chat,
    authedPage: page,
    api,
  }) => {
    test.setTimeout(300_000);
    const config = await chat.servedConfig();
    test.skip(
      !flagOn(config, "FEATURE_AGENTIC_CHAT", true),
      "FEATURE_AGENTIC_CHAT is off in the served config: no tool can run",
    );
    test.skip(
      !flagOn(config, "FEATURE_TOOLKITS", false),
      "FEATURE_TOOLKITS is off: the turn always sends the default toolkit, never dummy_image",
    );
    test.skip(
      !flagOrEnvOn(config, "FEATURE_ARTIFACTS", false),
      "FEATURE_ARTIFACTS is off for this target",
    );
    test.skip(
      !(await imageServerEnabled(api)),
      `${IMAGE_SERVER} is not an enabled row of GET /mcp-servers for the test account`,
    );
    let conversationId: string | null = null;

    try {
      // Only dummy_image: the same selection the Toolkits switches store. The context is fresh
      // for each test, so nothing leaks into the next one.
      await page.evaluate(
        ([key, name]) => localStorage.setItem(key, JSON.stringify([name])),
        [MCP_SELECTION_KEY, IMAGE_SERVER],
      );
      await chat.newChat();
      await chat.composer.send(IMAGE_TOOL_QUESTION);
      conversationId = await chat.waitForConversationId();
      await chat.composer.waitIdle();

      // The answer image is the stored artifact, fetched with the bearer. A model that skipped
      // the tool fails here with no image in the answer, which is the failure to count.
      const answerImage = chat.messages.last.getByTestId("markdown-image").first();
      await expect(answerImage, "the answer shows no image: the model may have skipped the tool").toBeVisible(
        { timeout: 150_000 },
      );
      await expect(answerImage).toHaveJSProperty("tagName", "IMG");
      await expect
        .poll(() => answerImage.evaluate((img) => (img as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      const width = await answerImage.evaluate((img) => (img as HTMLImageElement).naturalWidth);

      await answerImage.click();
      await zoomPanReset(new ImageLightbox(page), width);

      // Persisted: the last message points at /artifacts/{id}, and that artifact is listed for
      // the conversation as a tool image.
      const conversation = await api.get<{ messages?: { output?: string }[] }>(
        `/conversations/${conversationId}`,
      );
      expect(conversation.status).toBe(200);
      const output = conversation.body.messages?.at(-1)?.output ?? "";
      const referenced = output.match(/\/artifacts\/([0-9a-zA-Z_-]+)/);
      expect(referenced, "the stored answer references no /artifacts/{id}").not.toBeNull();
      const artifactId = referenced![1];
      const listed = await api.get<Paged<ArtifactRow>>(
        `/artifacts?conversation_id=${conversationId}&limit=10&page=1`,
      );
      expect(listed.status).toBe(200);
      const row = (listed.body.data ?? []).find((item) => item.id === artifactId);
      expect(row, `GET /artifacts lists no ${artifactId} for the conversation`).toBeDefined();
      expect(row?.source?.type).toBe("mcp_tool");
      expect(row?.content_type).toMatch(/^image\//);

      // The Artifacts page lists the same image and its thumbnail opens the lightbox.
      const artifacts = new ArtifactsPage(page);
      await artifacts.open();
      await expect(artifacts.card(row!.filename)).toBeVisible();
      const thumbnail = artifacts.thumbnail(row!.filename);
      await expect(thumbnail).toHaveJSProperty("tagName", "IMG");
      await expect(thumbnail).toHaveJSProperty("naturalWidth", width);
      await thumbnail.click();
      const lightbox = new ImageLightbox(page);
      await lightbox.waitOpen(width);
      await lightbox.close();
    } finally {
      // Artifacts are permanent by design (no DELETE route); only the conversation goes.
      if (conversationId) await api.delete(`/conversations/${conversationId}`);
    }
  });
});
