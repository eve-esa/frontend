import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_QUALITY,
  SCREENSHOT_TYPE,
  ScreenshotError,
  captureScreenshot,
  encodeFirstFrame,
  fitWidth,
} from "./screenshot";

type FakeTrack = { stop: ReturnType<typeof vi.fn> };

const fakeStream = (trackCount = 2) => {
  const tracks: FakeTrack[] = Array.from({ length: trackCount }, () => ({
    stop: vi.fn(),
  }));
  const stream = { getTracks: () => tracks } as unknown as MediaStream;
  return { stream, tracks };
};

const stubDisplayMedia = (
  impl: (options: unknown) => Promise<MediaStream>,
) => {
  const getDisplayMedia = vi.fn(impl);
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia } });
  return getDisplayMedia;
};

const blobOfSize = (size: number) =>
  new Blob([new Uint8Array(size)], { type: SCREENSHOT_TYPE });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("captureScreenshot", () => {
  it("calls getDisplayMedia synchronously, inside the click", () => {
    const { stream } = fakeStream();
    const getDisplayMedia = stubDisplayMedia(() => Promise.resolve(stream));
    const pending = captureScreenshot(() =>
      Promise.resolve(blobOfSize(10)));
    // No await yet: the call must already have happened, or the transient
    // activation of the click is lost.
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(getDisplayMedia.mock.calls[0][0]).toMatchObject({
      video: { displaySurface: "browser" },
      audio: false,
    });
    return pending;
  });

  it("returns the frame and stops every track", async () => {
    const { stream, tracks } = fakeStream(3);
    stubDisplayMedia(() => Promise.resolve(stream));
    const blob = await captureScreenshot(() =>
      Promise.resolve(blobOfSize(1000)));
    expect(blob.size).toBe(1000);
    for (const track of tracks) expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("accepts a frame of exactly 1 MB", async () => {
    const { stream } = fakeStream();
    stubDisplayMedia(() => Promise.resolve(stream));
    const blob = await captureScreenshot(() =>
      Promise.resolve(blobOfSize(SCREENSHOT_MAX_BYTES)),
    );
    expect(blob.size).toBe(SCREENSHOT_MAX_BYTES);
  });

  it("rejects a frame above 1 MB with a visible message and still stops the tracks", async () => {
    const { stream, tracks } = fakeStream();
    stubDisplayMedia(() => Promise.resolve(stream));
    const error = await captureScreenshot(() =>
      Promise.resolve(blobOfSize(SCREENSHOT_MAX_BYTES + 1)),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ScreenshotError);
    expect((error as ScreenshotError).code).toBe("too_large");
    expect((error as ScreenshotError).message).toContain("larger than 1 MB");
    for (const track of tracks) expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("stops the tracks when encoding fails", async () => {
    const { stream, tracks } = fakeStream();
    stubDisplayMedia(() => Promise.resolve(stream));
    const error = await captureScreenshot(() =>
      Promise.reject(new Error("canvas exploded")),
    ).catch((e: unknown) => e);
    expect((error as ScreenshotError).code).toBe("failed");
    for (const track of tracks) expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("maps a cancelled picker to denied", async () => {
    stubDisplayMedia(() =>
      Promise.reject(
        Object.assign(new Error("Permission denied"), {
          name: "NotAllowedError",
        }),
      ),
    );
    const error = await captureScreenshot(() =>
      Promise.resolve(blobOfSize(1))).catch(
      (e: unknown) => e,
    );
    expect((error as ScreenshotError).code).toBe("denied");
  });

  it("rejects as unsupported without the Screen Capture API", async () => {
    vi.stubGlobal("navigator", {});
    const error = await captureScreenshot(() =>
      Promise.resolve(blobOfSize(1))).catch(
      (e: unknown) => e,
    );
    expect((error as ScreenshotError).code).toBe("unsupported");
  });
});

describe("fitWidth", () => {
  it("keeps a frame that already fits", () => {
    expect(fitWidth(1280, 800)).toEqual({ width: 1280, height: 800 });
  });

  it("scales a wide frame down keeping the ratio", () => {
    expect(fitWidth(3840, 2160)).toEqual({ width: 1920, height: 1080 });
  });
});

describe("encodeFirstFrame", () => {
  it("draws one frame to a canvas and exports JPEG at quality 0.8", async () => {
    const drawImage = vi.fn();
    const toBlob = vi.fn(
      (callback: (blob: Blob | null) => void, type: string, quality: number) => {
        expect(quality).toBeGreaterThan(0);
        callback(new Blob(["x"], { type }));
      },
    );
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob,
    };
    const video = {
      muted: false,
      playsInline: false,
      srcObject: null as unknown,
      videoWidth: 2560,
      videoHeight: 1440,
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
    };
    vi.stubGlobal("document", {
      createElement: (tag: string) => (tag === "video" ? video : canvas),
    });
    const { stream } = fakeStream();

    const blob = await encodeFirstFrame(stream);

    expect(blob.type).toBe("image/jpeg");
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080);
    expect(toBlob.mock.calls[0][1]).toBe(SCREENSHOT_TYPE);
    expect(toBlob.mock.calls[0][2]).toBe(SCREENSHOT_QUALITY);
    expect(SCREENSHOT_QUALITY).toBe(0.8);
    // The video lets go of the stream, so the caller's stop() ends capture.
    expect(video.srcObject).toBeNull();
    expect(video.pause).toHaveBeenCalled();
  });
});
