import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampTransform,
  zoomBy,
  zoomTo,
} from "./lightboxTransform";

const VIEWPORT_W = 400;
const VIEWPORT_H = 300;

describe("clampTransform", () => {
  it("recenters (x=0, y=0) whenever zoom is at or below MIN_ZOOM", () => {
    expect(
      clampTransform({ zoom: MIN_ZOOM, x: 50, y: 30 }, VIEWPORT_W, VIEWPORT_H),
    ).toEqual({ zoom: MIN_ZOOM, x: 0, y: 0 });
  });

  it("clamps pan to (viewport * (zoom - 1)) / 2 on each axis", () => {
    const zoom = 2;
    const maxX = (VIEWPORT_W * (zoom - 1)) / 2;
    const maxY = (VIEWPORT_H * (zoom - 1)) / 2;

    expect(
      clampTransform({ zoom, x: maxX + 1000, y: maxY + 1000 }, VIEWPORT_W, VIEWPORT_H),
    ).toEqual({ zoom, x: maxX, y: maxY });

    expect(
      clampTransform(
        { zoom, x: -(maxX + 1000), y: -(maxY + 1000) },
        VIEWPORT_W,
        VIEWPORT_H,
      ),
    ).toEqual({ zoom, x: -maxX, y: -maxY });
  });

  it("leaves an in-bounds pan untouched", () => {
    const zoom = 2;
    const maxX = (VIEWPORT_W * (zoom - 1)) / 2;
    const maxY = (VIEWPORT_H * (zoom - 1)) / 2;
    const inBounds = { zoom, x: maxX / 2, y: -maxY / 2 };

    expect(clampTransform(inBounds, VIEWPORT_W, VIEWPORT_H)).toEqual(inBounds);
  });
});

describe("zoomBy", () => {
  it("never zooms below MIN_ZOOM", () => {
    const result = zoomBy(
      { zoom: MIN_ZOOM, x: 0, y: 0 },
      -10,
      VIEWPORT_W,
      VIEWPORT_H,
    );
    expect(result.zoom).toBe(MIN_ZOOM);
  });

  it("never zooms above MAX_ZOOM", () => {
    const result = zoomBy(
      { zoom: MAX_ZOOM, x: 0, y: 0 },
      10,
      VIEWPORT_W,
      VIEWPORT_H,
    );
    expect(result.zoom).toBe(MAX_ZOOM);
  });

  it("re-clamps pan after the zoom delta shrinks the allowed range", () => {
    // Starting at MAX_ZOOM with pan at the (then-valid) max bound, zooming
    // out should pull the pan back in to the new, smaller bound.
    const startZoom = MAX_ZOOM;
    const startMaxX = (VIEWPORT_W * (startZoom - 1)) / 2;
    const result = zoomBy(
      { zoom: startZoom, x: startMaxX, y: 0 },
      -1,
      VIEWPORT_W,
      VIEWPORT_H,
    );
    const newMaxX = (VIEWPORT_W * (result.zoom - 1)) / 2;
    expect(result.x).toBeCloseTo(newMaxX);
    expect(result.x).toBeLessThan(startMaxX);
  });

  it("recenters once zoomed back down to MIN_ZOOM", () => {
    const result = zoomBy(
      { zoom: MIN_ZOOM + 0.5, x: 20, y: 20 },
      -0.5,
      VIEWPORT_W,
      VIEWPORT_H,
    );
    expect(result).toEqual({ zoom: MIN_ZOOM, x: 0, y: 0 });
  });
});

describe("zoomTo", () => {
  it("clamps an absolute zoom below MIN_ZOOM up to MIN_ZOOM", () => {
    const result = zoomTo({ zoom: 2, x: 0, y: 0 }, 0.1, VIEWPORT_W, VIEWPORT_H);
    expect(result.zoom).toBe(MIN_ZOOM);
  });

  it("clamps an absolute zoom above MAX_ZOOM down to MAX_ZOOM", () => {
    const result = zoomTo({ zoom: 2, x: 0, y: 0 }, 99, VIEWPORT_W, VIEWPORT_H);
    expect(result.zoom).toBe(MAX_ZOOM);
  });

  it("sets an in-range zoom exactly", () => {
    const result = zoomTo({ zoom: 1, x: 0, y: 0 }, 2.5, VIEWPORT_W, VIEWPORT_H);
    expect(result.zoom).toBe(2.5);
  });
});
