import { describe, expect, it } from "vitest";
import type { ChaMessageType, MessageType } from "@/types";
import {
  CONVERSATION_POLL_MS,
  conversationRefetchInterval,
  runningTurnId,
} from "./runningTurn";
import { turnStartFromId } from "./agentSteps";

const ID = "691ca0e6a1b2c3d4e5f60718";

const row = (overrides: Partial<MessageType> = {}): MessageType =>
  ({
    id: ID,
    conversation_id: "c1",
    input: "q",
    output: "",
    feedback: null,
    timestamp: new Date(),
    documents: [],
    ...overrides,
  }) as MessageType;

const conversation = (
  messages: MessageType[],
  active_message_id?: string | null,
): ChaMessageType =>
  ({
    id: "c1",
    name: "n",
    timestamp: new Date(),
    user_id: "u",
    messages,
    ...(active_message_id === undefined ? {} : { active_message_id }),
  }) as ChaMessageType;

describe("runningTurnId", () => {
  it("names the last row when the backend says it is still generating and it has no output", () => {
    expect(runningTurnId(conversation([row()], ID))).toBe(ID);
  });

  it("is null when the field is null or absent (older backend)", () => {
    expect(runningTurnId(conversation([row()], null))).toBeNull();
    expect(runningTurnId(conversation([row()]))).toBeNull();
    expect(runningTurnId(undefined)).toBeNull();
  });

  it("is null when the active id is not the last row", () => {
    expect(runningTurnId(conversation([row(), row({ id: "other" })], ID))).toBeNull();
  });

  it("is null once the row has output, was stopped, or failed", () => {
    expect(runningTurnId(conversation([row({ output: "Done." })], ID))).toBeNull();
    expect(runningTurnId(conversation([row({ stopped: true })], ID))).toBeNull();
    expect(
      runningTurnId(
        conversation([row({ metadata: { error: { code: "timeout" } } } as Partial<MessageType>)], ID),
      ),
    ).toBeNull();
  });
});

describe("conversationRefetchInterval", () => {
  const query = (data: ChaMessageType | undefined) => ({ state: { data } }) as never;

  it("polls every 5 s while a turn is active", () => {
    expect(CONVERSATION_POLL_MS).toBe(5000);
    expect(conversationRefetchInterval(query(conversation([row()], ID)))).toBe(5000);
  });

  it("stops when the field no longer names the last row (a newer turn, or none)", () => {
    const rows = [row(), row({ id: "newer" })];
    expect(conversationRefetchInterval(query(conversation(rows, ID)))).toBe(false);
    expect(conversationRefetchInterval(query(conversation([], ID)))).toBe(false);
  });

  it("stops when the field turns null, is absent, or there is no data", () => {
    expect(conversationRefetchInterval(query(conversation([row()], null)))).toBe(false);
    expect(conversationRefetchInterval(query(conversation([row()])))).toBe(false);
    expect(conversationRefetchInterval(query(undefined))).toBe(false);
  });
});

describe("turnStartFromId", () => {
  const SENT = new Date("2026-11-18T18:57:10Z").getTime();

  it("keeps the optimistic send time", () => {
    expect(turnStartFromId(`temp-${SENT}`)).toBe(SENT);
  });

  it("reads the creation second of a stored id", () => {
    expect(turnStartFromId(ID)).toBe(parseInt(ID.slice(0, 8), 16) * 1000);
  });

  it("is null for anything else", () => {
    expect(turnStartFromId("srv-1763492230000")).toBeNull();
    expect(turnStartFromId(undefined)).toBeNull();
  });
});
