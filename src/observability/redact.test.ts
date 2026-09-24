import { describe, expect, it } from "vitest";
import { redactString } from "./redact";

describe("redactString", () => {
  it.each([
    ["Authorization: Bearer abc.def-ghi", "Authorization: Bearer [REDACTED]"],
    [
      "GET /x?api_key=s3cr3t&page=2",
      "GET /x?api_key=[REDACTED]&page=2",
    ],
    ["key eve_" + "0123456789abcdef".repeat(4), "key [REDACTED]"],
    ["runpod rpa_ABCDEFGHIJKLMNOP1234", "runpod [REDACTED]"],
    ["mail jane.doe@example.org now", "mail [REDACTED_EMAIL] now"],
    ["https://user:pw@host/x", "https://[REDACTED]@host/x"],
    ["jwt eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl", "jwt [REDACTED]"],
    ['{"password": "hunter2"}', '{"password": "[REDACTED]"}'],
  ])("redacts %s", (input, expected) => {
    expect(redactString(input)).toBe(expected);
  });

  it("leaves ordinary text and short eve_ identifiers alone", () => {
    for (const text of [
      "model eve_jsc answered",
      "basic setup done",
      "max_tokens=512",
    ]) {
      expect(redactString(text)).toBe(text);
    }
  });

  it("is stable when applied twice", () => {
    const once = redactString("Bearer abc a@b.io ?token=x");
    expect(redactString(once)).toBe(once);
  });
});
