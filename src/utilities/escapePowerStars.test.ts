import { describe, expect, it } from "vitest";
import { escapePowerStars } from "./escapePowerStars";

describe("escapePowerStars", () => {
  it("escapes Python power notation between digits", () => {
    expect(escapePowerStars("3**50 = 717897987691852588770249")).toBe(
      "3\\*\\*50 = 717897987691852588770249",
    );
    expect(escapePowerStars("2**100 = 1267650600228229401496703205376")).toBe(
      "2\\*\\*100 = 1267650600228229401496703205376",
    );
  });

  it("escapes chained powers", () => {
    expect(escapePowerStars("2**3**2")).toBe("2\\*\\*3\\*\\*2");
  });

  it("leaves real bold alone", () => {
    for (const text of ["**bold** text", "Some **50 km** away", "a **b** c **d**"]) {
      expect(escapePowerStars(text)).toBe(text);
    }
  });

  it("leaves code spans, code fences and math untouched", () => {
    for (const text of [
      "Run `3**50` in Python.",
      "```python\nprint(3**50)\n```",
      "```python\nprint(3**50)",
      "Here $3**50$ stays.",
      "$$\n2**10\n$$",
    ]) {
      expect(escapePowerStars(text)).toBe(text);
    }
  });

  it("escapes outside code on the same line", () => {
    expect(escapePowerStars("`x**2` and 3**50")).toBe("`x**2` and 3\\*\\*50");
  });

  it("leaves indented code blocks untouched", () => {
    for (const text of [
      "    x = 2**10",
      "Example:\n\n    x = 2**10\n    y = 3**5\n\nDone.",
      "Tab:\n\n\tprint(2**10)",
    ]) {
      expect(escapePowerStars(text)).toBe(text);
    }
    expect(escapePowerStars("Example:\n\n    x = 2**10\n\nThen 3**5")).toBe(
      "Example:\n\n    x = 2**10\n\nThen 3\\*\\*5",
    );
  });

  it("still escapes indented text that is not a code block", () => {
    // Indented right after a paragraph line: a lazy continuation, not code.
    expect(escapePowerStars("Result:\n    2**10 = 1024")).toBe(
      "Result:\n    2\\*\\*10 = 1024",
    );
    // Indented under a list item: the item continues.
    expect(escapePowerStars("- item\n\n    2**10 = 1024")).toBe(
      "- item\n\n    2\\*\\*10 = 1024",
    );
  });

  it("leaves autolinks, bare URLs and link targets untouched", () => {
    for (const text of [
      "See <https://a.com/3**5>.",
      "See https://a.com/3**5 now.",
      "See www.a.com/3**5 now.",
      "[link](https://a.com/3**5)",
    ]) {
      expect(escapePowerStars(text)).toBe(text);
    }
    expect(escapePowerStars("https://a.com/3**5 and 2**10")).toBe(
      "https://a.com/3**5 and 2\\*\\*10",
    );
  });

  it("leaves HTML tags and pre or code elements untouched", () => {
    for (const text of [
      '<img alt="3**5" src="x.png">',
      "<pre>2**10</pre>",
      "<code>2**10</code>",
      "<pre>\nx = 2**10\n",
    ]) {
      expect(escapePowerStars(text)).toBe(text);
    }
    expect(escapePowerStars('<img alt="3**5"> is 3**5')).toBe(
      '<img alt="3**5"> is 3\\*\\*5',
    );
  });
});
