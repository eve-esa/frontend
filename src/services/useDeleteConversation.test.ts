import { describe, expect, it } from "vitest";
import {
  DELETE_INCOMPLETE_MESSAGE,
  describeDeleteConversationError,
} from "./useDeleteConversation";

const apiError = (status: number | undefined, detail: unknown, message = "") => ({
  message: message || `Request failed with status code ${status}`,
  response: status === undefined ? undefined : { status, data: { detail } },
});

describe("describeDeleteConversationError", () => {
  it("offers a retry when some files could not be erased", () => {
    expect(
      describeDeleteConversationError(
        apiError(503, {
          code: "conversation_delete_incomplete",
          message: "Some files are still stored.",
        })
      )
    ).toEqual({ message: DELETE_INCOMPLETE_MESSAGE, retryable: true });
  });

  it("uses the backend message for another coded error, without a retry", () => {
    expect(
      describeDeleteConversationError(
        apiError(403, { code: "forbidden", message: "Not your conversation" })
      )
    ).toEqual({ message: "Not your conversation", retryable: false });
  });

  it("uses a string detail as is", () => {
    expect(
      describeDeleteConversationError(apiError(404, "Conversation not found"))
    ).toEqual({ message: "Conversation not found", retryable: false });
  });

  it("never shows the raw axios text", () => {
    const network = describeDeleteConversationError(
      apiError(undefined, undefined, "Network Error")
    );
    const bare503 = describeDeleteConversationError(apiError(503, undefined));
    expect(network).toEqual({ message: "Something went wrong!", retryable: false });
    expect(bare503.message).not.toMatch(/status code/);
    expect(bare503.retryable).toBe(false);
  });
});
