import { describe, expect, it } from "vitest";
import {
  applyStoppedPartial,
  mergeStoppedPartial,
  rememberStoppedPartial,
  type StoppedPartials,
} from "./stoppedPartials";
import type { ChaMessageType, MessageType } from "@/types";

const message = (over: Partial<MessageType> = {}): MessageType =>
  ({
    id: "m1",
    conversation_id: "c1",
    input: "why is the sky blue?",
    output: "",
    feedback: null,
    documents: [],
    timestamp: new Date(0),
    request_input: { llm_type: null },
    ...over,
  }) as MessageType;

const conversation = (messages: MessageType[]): ChaMessageType =>
  ({
    id: "c1",
    name: "c",
    user_id: "u",
    timestamp: new Date(0),
    messages,
  }) as ChaMessageType;

describe("mergeStoppedPartial", () => {
  it("leaves the response untouched when nothing was stopped", () => {
    const data = conversation([message({ output: "done" })]);
    const result = mergeStoppedPartial(data, {}, "c1");

    expect(result.data).toBe(data);
    expect(result.partials).toEqual({});
  });

  it("restores the partial on the mid-generation row the refetch brings back", () => {
    const partials: StoppedPartials = {
      c1: [{ index: 1, output: "The sky is" }],
    };
    const data = conversation([
      message({ id: "m0", output: "an older answer" }),
      message({ id: "m1", output: "" }),
    ]);

    const result = mergeStoppedPartial(data, partials, "c1");

    expect(result.data.messages[1].output).toBe("The sky is");
    expect(result.data.messages[1].stopped).toBe(true);
    // Untouched turns keep their identity, and the earlier row is not rewritten.
    expect(result.data.messages[0]).toBe(data.messages[0]);
    // Still remembered: the backend has not persisted its own copy yet.
    expect(result.partials).toEqual(partials);
  });

  it("keeps merging on every later refetch while the row stays empty", () => {
    const partials: StoppedPartials = {
      c1: [{ index: 0, output: "The sky is" }],
    };
    const first = mergeStoppedPartial(
      conversation([message({ output: "" })]),
      partials,
      "c1",
    );
    const second = mergeStoppedPartial(
      conversation([message({ output: "" })]),
      first.partials,
      "c1",
    );

    expect(second.data.messages[0].output).toBe("The sky is");
    expect(second.data.messages[0].stopped).toBe(true);
  });

  it("merges onto a row the backend already flagged as stopped but left empty", () => {
    const partials: StoppedPartials = {
      c1: [{ index: 0, output: "The sky is" }],
    };
    const data = conversation([message({ output: "", stopped: true })]);

    const result = mergeStoppedPartial(data, partials, "c1");

    expect(result.data.messages[0].output).toBe("The sky is");
  });

  it("treats a whitespace-only server row as empty", () => {
    const partials: StoppedPartials = {
      c1: [{ index: 0, output: "The sky is" }],
    };
    const data = conversation([message({ output: "  \n " })]);

    const result = mergeStoppedPartial(data, partials, "c1");

    expect(result.data.messages[0].output).toBe("The sky is");
    expect(result.partials).toEqual(partials);
  });

  it("forgets the partial once the server row carries the persisted output", () => {
    const partials: StoppedPartials = {
      c1: [{ index: 0, output: "The sky is" }],
    };
    const data = conversation([
      message({ output: "The sky is blue because", stopped: true }),
    ]);

    const result = mergeStoppedPartial(data, partials, "c1");

    // The server text wins, and nothing is left to repair on later refetches.
    expect(result.data).toBe(data);
    expect(result.partials).toEqual({});
  });

  it("keeps the partial while the turn is missing from the response", () => {
    const partials: StoppedPartials = {
      c1: [{ index: 3, output: "The sky is" }],
    };
    const data = conversation([message()]);

    const result = mergeStoppedPartial(data, partials, "c1");

    expect(result.data).toBe(data);
    expect(result.partials).toEqual(partials);
  });

  it("ignores a partial belonging to another conversation", () => {
    const partials: StoppedPartials = {
      c2: [{ index: 0, output: "The sky is" }],
    };
    const data = conversation([message({ output: "" })]);

    const result = mergeStoppedPartial(data, partials, "c1");

    expect(result.data).toBe(data);
    expect(result.partials).toEqual(partials);
  });

  it("does nothing without a conversation id", () => {
    const partials: StoppedPartials = {
      c1: [{ index: 0, output: "The sky is" }],
    };
    const data = conversation([message({ output: "" })]);

    const result = mergeStoppedPartial(data, partials, undefined);

    expect(result.data).toBe(data);
    expect(result.partials).toEqual(partials);
  });

  it("survives a response with no messages", () => {
    const partials: StoppedPartials = {
      c1: [{ index: 0, output: "The sky is" }],
    };
    const data = { id: "c1" } as ChaMessageType;

    const result = mergeStoppedPartial(data, partials, "c1");

    expect(result.data).toBe(data);
    expect(result.partials).toEqual(partials);
  });

  it("repairs two stopped turns in the same conversation independently", () => {
    const partials: StoppedPartials = {
      c1: [
        { index: 0, output: "The sky is" },
        { index: 1, output: "Rayleigh scattering" },
      ],
    };
    const data = conversation([
      message({ id: "m0", output: "" }),
      message({ id: "m1", output: "" }),
    ]);

    const result = mergeStoppedPartial(data, partials, "c1");

    expect(result.data.messages[0].output).toBe("The sky is");
    expect(result.data.messages[1].output).toBe("Rayleigh scattering");

    // The backend catches up on the first turn only: the second stays repaired
    // and only the first memory is released.
    const next = mergeStoppedPartial(
      conversation([
        message({ id: "m0", output: "The sky is blue" }),
        message({ id: "m1", output: "" }),
      ]),
      result.partials,
      "c1",
    );

    expect(next.data.messages[0].output).toBe("The sky is blue");
    expect(next.data.messages[1].output).toBe("Rayleigh scattering");
    expect(next.partials).toEqual({
      c1: [{ index: 1, output: "Rayleigh scattering" }],
    });
  });
});

describe("rememberStoppedPartial and applyStoppedPartial", () => {
  it("repairs the next response for that conversation, then stops", () => {
    rememberStoppedPartial("store-1", 0, "The sky is");

    const repaired = applyStoppedPartial(
      conversation([message({ output: "" })]),
      "store-1",
    );
    expect(repaired.messages[0].output).toBe("The sky is");
    expect(repaired.messages[0].stopped).toBe(true);

    const persisted = applyStoppedPartial(
      conversation([message({ output: "The sky is blue" })]),
      "store-1",
    );
    expect(persisted.messages[0].output).toBe("The sky is blue");

    // The memory is spent: an empty row later is a different failure and must
    // not be painted with the old text.
    const afterwards = applyStoppedPartial(
      conversation([message({ output: "" })]),
      "store-1",
    );
    expect(afterwards.messages[0].output).toBe("");
    expect(afterwards.messages[0].stopped).toBeUndefined();
  });

  it("remembers nothing when the stream painted nothing visible", () => {
    rememberStoppedPartial("store-2", 0, "  \n ");

    const data = applyStoppedPartial(
      conversation([message({ output: "" })]),
      "store-2",
    );
    expect(data.messages[0].output).toBe("");
  });

  it("remembers nothing when there is no optimistic row to point at", () => {
    rememberStoppedPartial("store-3", -1, "The sky is");

    const data = applyStoppedPartial(
      conversation([message({ output: "" })]),
      "store-3",
    );
    expect(data.messages[0].output).toBe("");
  });

  it("replaces the memory for a turn instead of stacking two of them", () => {
    rememberStoppedPartial("store-4", 0, "first attempt");
    rememberStoppedPartial("store-4", 0, "second attempt");

    const data = applyStoppedPartial(
      conversation([message({ output: "" })]),
      "store-4",
    );
    expect(data.messages[0].output).toBe("second attempt");
  });
});
