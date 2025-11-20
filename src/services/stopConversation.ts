import api from "./axios";

export type StopConversationResponse = {
  status?: string;
  message_id?: string;
};

export async function stopConversation({
  conversationId,
}: {
  conversationId: string;
}): Promise<StopConversationResponse> {
  const { data } = await api.post(`/conversations/${conversationId}/stop`);
  return (data ?? {}) as StopConversationResponse;
}


