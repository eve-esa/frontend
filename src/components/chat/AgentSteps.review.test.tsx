// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AgenticTraceStep } from "@/types";
import { AgentSteps, FadeBox } from "./AgentSteps";

/** Review fixes on the steps block: one failed row while folding, keyboard scroll in code boxes. */

afterEach(cleanup);

const failedTrace: AgenticTraceStep[] = [
  {
    role: "assistant",
    content: "",
    tool_calls: [{ name: "wiley_search_wiley_fulltext", args: { query: "NDWI" }, id: "w1" }],
    started_at_s: 0,
    latency_s: 1,
  },
  {
    role: "tool",
    name: "wiley_search_wiley_fulltext",
    tool_call_id: "w1",
    status: "error",
    content: "Timed out after 30 s",
    started_at_s: 1,
    latency_s: 30,
  },
];

/** Radix Presence waits for animationend when the content has an animation name. */
const animateContent = () => {
  const real = window.getComputedStyle;
  window.getComputedStyle = ((el: Element, pseudo?: string | null) => {
    const style = real(el, pseudo);
    if (!el.className?.toString().includes("animate-agent-steps-up")) return style;
    // Live like a browser's computed style: the name follows data-state.
    return new Proxy(style, {
      get(target, prop) {
        if (prop === "animationName") return el.getAttribute("data-state") === "closed" ? "agent-steps-up" : "agent-steps-down";
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }) as typeof window.getComputedStyle;
  return () => {
    window.getComputedStyle = real;
  };
};

describe("agent steps review fixes", () => {
  it("shows the failed row once while the block folds, the folded copy after the animation", () => {
    const restore = animateContent();
    try {
      const { rerender, container } = render(<AgentSteps trace={failedTrace} live answerStarted={false} agentic />);
      expect(screen.getByTestId("agent-steps").getAttribute("data-state")).toBe("open");
      rerender(<AgentSteps trace={failedTrace} live answerStarted agentic />);
      expect(screen.getByTestId("agent-steps").getAttribute("data-state")).toBe("closed");
      expect(screen.queryByTestId("agent-steps-failed-rows")).toBeNull();
      const content = container.querySelector("[data-state='closed'][class*='animate-agent-steps-up']");
      expect(content).toBeTruthy();
      act(() => {
        // jsdom has no AnimationEvent: name the animation on a plain event.
        const end = new Event("animationend", { bubbles: true });
        Object.defineProperty(end, "animationName", { value: "agent-steps-up" });
        (content as Element).dispatchEvent(end);
      });
      expect(screen.getByTestId("agent-steps-failed-rows")).toBeTruthy();
    } finally {
      restore();
    }
  });

  it("makes an overflowing code box reachable by keyboard and drops the fade at the end", () => {
    render(
      <FadeBox testId="box" label="Output">
        {"line\n".repeat(80)}
      </FadeBox>,
    );
    const box = screen.getByTestId("box");
    Object.defineProperty(box, "scrollHeight", { configurable: true, value: 1440 });
    Object.defineProperty(box, "clientHeight", { configurable: true, value: 256 });
    act(() => {
      fireEvent.scroll(box);
    });
    expect(box.getAttribute("tabindex")).toBe("0");
    expect(box.getAttribute("role")).toBe("region");
    expect(box.getAttribute("aria-label")).toBeTruthy();
    expect(box.className).toContain("mask-b-from-[calc(100%-24px)]");
    expect(box.className).not.toContain("scroll-fade-b");
    Object.defineProperty(box, "scrollTop", { configurable: true, value: 1184 });
    act(() => {
      fireEvent.scroll(box);
    });
    expect(box.className).not.toContain("mask-b-from");
  });
});
