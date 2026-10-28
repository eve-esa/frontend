import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// .github/actions/inject-runtime-config refuses to publish an index.html that already
// contains the config global name: it reads that as a build injected twice.
describe("index.html", () => {
  it("does not name the injected runtime config global", () => {
    const html = readFileSync(path.resolve(__dirname, "../index.html"), "utf-8");
    expect(
      html.includes("__EVE_" + "CONFIG__"),
      "index.html must not contain the config global name: the guard in " +
        ".github/actions/inject-runtime-config/action.yml would refuse the release",
    ).toBe(false);
  });
});
