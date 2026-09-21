import { describe, expect, it } from "vitest";
import {
  clampSidebarWidth,
  getDefaultSidebarWidth,
  getSidebarWidthBounds,
  parseStoredSidebarWidth,
} from "./sidebarWidth";

describe("getDefaultSidebarWidth", () => {
  it.each([
    [1024, 310],
    [1280, 310],
    [1400, 340],
    [1920, 400],
    [2560, 480],
    [3200, 600],
  ])("at a %spx viewport it is %spx wide", (viewport, expected) => {
    expect(getDefaultSidebarWidth(viewport)).toBe(expected);
  });
});

describe("getSidebarWidthBounds", () => {
  it("caps at 75% of the viewport", () => {
    expect(getSidebarWidthBounds(1100)).toEqual({ min: 310, max: 825 });
  });

  it("caps at 960px on wide screens", () => {
    expect(getSidebarWidthBounds(1920)).toEqual({ min: 400, max: 960 });
  });

  it("leaves the chat column its room", () => {
    expect(getSidebarWidthBounds(1280, 610)).toEqual({ min: 310, max: 610 });
  });

  it("never goes below the default width", () => {
    expect(getSidebarWidthBounds(1280, 120)).toEqual({ min: 310, max: 310 });
  });
});

describe("clampSidebarWidth", () => {
  const bounds = { min: 310, max: 800 };

  it("keeps a width inside the bounds, rounded", () => {
    expect(clampSidebarWidth(512.6, bounds)).toBe(513);
  });

  it("pins a width outside the bounds to the nearest one", () => {
    expect(clampSidebarWidth(100, bounds)).toBe(310);
    expect(clampSidebarWidth(5000, bounds)).toBe(800);
  });
});

describe("parseStoredSidebarWidth", () => {
  it("reads a stored number", () => {
    expect(parseStoredSidebarWidth("540")).toBe(540);
  });

  it.each([null, "", "wide", "-20", "0", "NaN"])(
    "ignores %j",
    (raw) => {
      expect(parseStoredSidebarWidth(raw)).toBeNull();
    },
  );
});
