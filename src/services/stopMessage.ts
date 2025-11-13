import api from "./axios";

export async function stopMessage({
  conversationId,
  messageId,
}: {
  conversationId: string;
  messageId: string;
}) {
  await api.post(`/conversations/${conversationId}/messages/${messageId}/stop`);
}
