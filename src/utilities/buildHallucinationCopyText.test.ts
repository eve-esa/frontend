import { describe, expect, it } from "vitest";
import { buildHallucinationCopyText } from "./buildHallucinationCopyText";

describe("buildHallucinationCopyText", () => {
  it("copies the reason for a no-hallucination result (the bug: it used to copy '')", () => {
    const text = buildHallucinationCopyText({
      label: 0,
      reason: "The answer is grounded in the retrieved documents.",
      rewrittenQuery: "",
      alternativeAnswer: "",
    });
    expect(text).toBe(
      "Possible hallucination detected: No — The answer is grounded in the retrieved documents.",
    );
  });

  it("copies verdict, reason, rewritten query and alternative answer when flagged", () => {
    const text = buildHallucinationCopyText({
      label: 1,
      reason: "The cited figure does not appear in any source.",
      rewrittenQuery: "2023 wildfire burned area Portugal",
      alternativeAnswer: "The area burned in 2023 was about 34,000 hectares.",
    });
    expect(text).toBe(
      [
        "Possible hallucination detected: Yes — The cited figure does not appear in any source.",
        "Searched for: 2023 wildfire burned area Portugal",
        "Alternative answer:\nThe area burned in 2023 was about 34,000 hectares.",
      ].join("\n\n"),
    );
  });

  it("returns an empty string when there is nothing on screen to copy", () => {
    expect(
      buildHallucinationCopyText({
        label: null,
        reason: "",
        rewrittenQuery: "",
        alternativeAnswer: "",
      }),
    ).toBe("");
    // Whitespace-only fields are still "nothing visible".
    expect(
      buildHallucinationCopyText({
        label: null,
        reason: "   \n\t",
        rewrittenQuery: "  ",
        alternativeAnswer: " ",
      }),
    ).toBe("");
  });

  it("omits the verdict prefix when no label is known but a reason streamed", () => {
    expect(
      buildHallucinationCopyText({
        label: null,
        reason: "Checking the answer against the sources.",
        rewrittenQuery: "",
        alternativeAnswer: "",
      }),
    ).toBe("Possible hallucination detected: Checking the answer against the sources.");
  });

  it("never copies the alternative answer unless a hallucination is flagged", () => {
    // Matches the UI gate: label 0 hides the alternative even if one exists.
    const text = buildHallucinationCopyText({
      label: 0,
      reason: "Grounded.",
      rewrittenQuery: "some query",
      alternativeAnswer: "an alternative that must not leak",
    });
    expect(text).not.toContain("Alternative answer");
    expect(text).toBe(
      ["Possible hallucination detected: No — Grounded.", "Searched for: some query"].join(
        "\n\n",
      ),
    );
  });
});
