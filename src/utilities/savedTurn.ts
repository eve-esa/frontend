import type { MessageType } from "@/types";

/**
 * The conversation after a streamed turn completes: the optimistic `temp-*`
 * row gives way to the saved row. With `keepActivity` (FEATURE_AGENT_STEPS)
 * the saved row takes the streamed tool activity, so the agent steps stay on
 * screen until the refetch brings the stored trace; the saved row has neither.
 */
export const swapTempForSaved = (
  messages: readonly MessageType[],
  saved: MessageType,
  keepActivity: boolean,
): MessageType[] => {
  const streamed = keepActivity
    ? messages.find((msg) => msg.id?.startsWith("temp-"))?.tool_activity
    : undefined;
  return [
    ...messages.filter((msg) => !msg.id?.startsWith("temp-")),
    streamed?.length && !saved.tool_activity?.length
      ? { ...saved, tool_activity: streamed }
      : saved,
  ];
};
