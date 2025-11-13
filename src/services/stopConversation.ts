import api from "./axios";

export async function stopConversation({ conversationId }: { conversationId: string }) {
  await api.post(`/conversations/${conversationId}/stop`);
}


