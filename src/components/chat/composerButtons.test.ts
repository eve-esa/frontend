import { describe, expect, it } from "vitest";
import { composerButtonClasses } from "./composerButtons";

describe("composerButtonClasses", () => {
  it("flag off: today's 32 px icons, for every button", () => {
    const off = composerButtonClasses(false);
    expect(off.quiet).toBe("h-8 w-8 p-0 cursor-pointer");
    expect(off.quietWide).toBe("h-8 w-8 p-0 cursor-pointer");
    expect(off.filled).toBe("h-8 w-8 p-0 cursor-pointer");
  });

  it("flag on: 44 px squares, Attach and Control Panel flat, Send the one filled control", () => {
    const on = composerButtonClasses(true);
    for (const classes of [on.quiet, on.quietWide, on.filled]) {
      expect(classes).toContain("h-[44px]");
    }
    expect(on.quiet).toContain("w-[44px]");
    expect(on.filled).toContain("w-[44px]");
    // Dark: the highlight at 40 % on the quiet ones; light: the Silver tint (highlight token).
    expect(on.quiet).toContain("bg-highlight/40");
    expect(on.quiet).toContain("in-data-[theme=light]:bg-highlight");
    // Send: highlight in dark, Deep Space (cta) in light, muted when disabled.
    expect(on.filled).toContain("bg-highlight");
    expect(on.filled).toContain("in-data-[theme=light]:bg-cta");
    expect(on.filled).toContain("disabled:opacity-35");
    // No border on any of them.
    expect(on.quiet + on.quietWide + on.filled).not.toContain("border");
  });
});
