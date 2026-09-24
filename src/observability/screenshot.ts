/**
 * One screenshot of the current tab for a bug report, taken with the Screen
 * Capture API. No html2canvas: that re-renders the DOM and gets fonts, canvas
 * and cross origin images wrong, which is the opposite of what a bug report
 * needs.
 *
 * `captureScreenshot()` must be called directly from a click handler, before
 * any await: `getDisplayMedia` needs the transient activation of that click
 * and throws once it has expired. The browser then asks the user which tab or
 * screen to share; the first frame is drawn to a canvas, exported as JPEG and
 * every track is stopped, so the "sharing" indicator goes away at once.
 */

export const SCREENSHOT_MAX_BYTES = 1024 * 1024;
export const SCREENSHOT_TYPE = "image/jpeg";
export const SCREENSHOT_QUALITY = 0.8;
/** Wider frames are scaled down first, to stay under the byte cap. */
export const SCREENSHOT_MAX_WIDTH = 1920;
/**
 * Pause between the stream starting and the frame being read, so the page has
 * repainted without the report dialog, which the caller hides meanwhile.
 */
export const SCREENSHOT_SETTLE_MS = 300;

export type ScreenshotErrorCode =
  | "unsupported"
  | "denied"
  | "too_large"
  | "failed";

const MESSAGES: Record<ScreenshotErrorCode, string> = {
  unsupported: "This browser cannot take a screenshot. You can send the report without one.",
  denied: "Screen sharing was cancelled, no screenshot was taken.",
  too_large: "The screenshot is larger than 1 MB and cannot be attached. You can send the report without one.",
  failed: "The screenshot could not be taken. You can send the report without one.",
};

export class ScreenshotError extends Error {
  readonly code: ScreenshotErrorCode;

  constructor(code: ScreenshotErrorCode) {
    super(MESSAGES[code]);
    this.name = "ScreenshotError";
    this.code = code;
  }
}

/** Whether this browser has the Screen Capture API at all (no on mobile). */
export const isScreenshotSupported = (): boolean =>
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices?.getDisplayMedia === "function";

/** Turns a live stream into one encoded image. Replaceable in tests. */
export type FrameEncoder = (stream: MediaStream) => Promise<Blob>;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Scales `width` x `height` down to at most `maxWidth` wide, keeping ratio. */
export const fitWidth = (
  width: number,
  height: number,
  maxWidth: number = SCREENSHOT_MAX_WIDTH,
): { width: number; height: number } => {
  if (width <= maxWidth) return { width, height };
  const scale = maxWidth / width;
  return { width: maxWidth, height: Math.round(height * scale) };
};

/** Draws one frame of `stream` on a canvas and exports it as JPEG. */
export const encodeFirstFrame: FrameEncoder = async (stream) => {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await video.play();
    await sleep(SCREENSHOT_SETTLE_MS);
    const { width, height } = fitWidth(video.videoWidth, video.videoHeight);
    if (!width || !height) throw new ScreenshotError("failed");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new ScreenshotError("failed");
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, SCREENSHOT_TYPE, SCREENSHOT_QUALITY),
    );
    if (!blob) throw new ScreenshotError("failed");
    return blob;
  } finally {
    video.pause();
    video.srcObject = null;
  }
};

const stopAll = (stream: MediaStream | undefined) => {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // A track that cannot stop is already gone.
    }
  }
};

const toScreenshotError = (error: unknown): ScreenshotError => {
  if (error instanceof ScreenshotError) return error;
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "NotAllowedError" || name === "AbortError") {
    return new ScreenshotError("denied");
  }
  if (name === "NotSupportedError") return new ScreenshotError("unsupported");
  return new ScreenshotError("failed");
};

/**
 * Asks for a screen share, grabs one frame and returns it as a JPEG Blob of
 * at most SCREENSHOT_MAX_BYTES. Rejects with a ScreenshotError whose message
 * is safe to show to the user. Every track is stopped on every path.
 */
export const captureScreenshot = (
  encode: FrameEncoder = encodeFirstFrame,
): Promise<Blob> => {
  const mediaDevices =
    typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  if (!mediaDevices?.getDisplayMedia) {
    return Promise.reject(new ScreenshotError("unsupported"));
  }

  // Called synchronously, still inside the click that led here. Non standard
  // hints are ignored where unknown: preferCurrentTab puts this tab first in
  // Chrome's picker.
  let request: Promise<MediaStream>;
  try {
    request = mediaDevices.getDisplayMedia({
      video: { displaySurface: "browser" },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
    } as DisplayMediaStreamOptions);
  } catch (error) {
    return Promise.reject(toScreenshotError(error));
  }

  return (async () => {
    let stream: MediaStream | undefined;
    try {
      stream = await request;
      const blob = await encode(stream);
      if (blob.size > SCREENSHOT_MAX_BYTES) {
        throw new ScreenshotError("too_large");
      }
      return blob;
    } catch (error) {
      throw toScreenshotError(error);
    } finally {
      stopAll(stream);
    }
  })();
};
