// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { markCitations, type Citation } from "@/utilities/citations";
import { CitationsProvider } from "./CitationsContext";
import { StepSourceChips } from "./StepSourceChips";

/** Decision 0007, point 5: a step source chip reads number, title, then the slug muted. */

afterEach(cleanup);

const cited: Citation[] = [
  {
    id: "src_1",
    kind: "document",
    provider: "wiley",
    provider_label: "Wiley AI Gateway",
    slug: "wiley",
    visibility: "licensed",
    title: "Calibrating dNBR thresholds for Mediterranean shrublands with field plots",
    passage: "Passage.",
    locator: { page: 7 },
    n: 1,
    at: [2],
    origin: "model",
    tool_call_id: "call_1",
  },
];

describe("step source chip order", () => {
  it("puts the title before the provider slug, the slug in chip meta tier", () => {
    const marked = markCitations("A.[1]", cited);
    render(
      <CitationsProvider markers={marked.markers} citations={cited} retrieved={[]} scope="m1">
        <StepSourceChips toolCallId="call_1" />
      </CitationsProvider>,
    );
    const chip = screen.getByTestId("agent-step-source-chip");
    const text = (chip.textContent ?? "").replace(/\s+/g, " ");
    expect(text.startsWith("1Calibrating dNBR")).toBe(true);
    expect(text.indexOf("Calibrating")).toBeLessThan(text.indexOf("wiley"));
    const slug = within(chip).getByText("wiley");
    expect(slug.className).toContain("text-natural-200");
    expect(slug.className).not.toContain("text-primary-300");
  });
});
