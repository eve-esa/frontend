/**
 * The MCP artifact interceptor rewrites captured tool output into a two-line stub:
 * a markdown link/image pointing at `/artifacts/{id}`, followed by a single line of
 * raw JSON metadata (`{"artifact_id": ..., "url": ..., "content_type": ...}`) meant
 * for the frontend to read, not for the user to see. Left in place it renders as
 * unstyled JSON text in the chat bubble. This drops any line that is exactly that
 * metadata object, identified by the `artifact_id` key, while leaving every other
 * line (including the markdown link itself) untouched.
 */
export const stripArtifactMetadata = (text: string): string => {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return true;
      try {
        const parsed = JSON.parse(trimmed);
        return !(parsed && typeof parsed === "object" && "artifact_id" in parsed);
      } catch {
        return true;
      }
    })
    .join("\n");
};
