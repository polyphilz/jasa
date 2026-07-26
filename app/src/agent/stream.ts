export const FOLLOW_UPS_MARKER = "===FOLLOW-UPS===";

export type AgentStreamEvent =
  | { kind: "delta"; text: string }
  | { kind: "result"; success: boolean; text: string; error?: string };

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

/**
 * Parse one line of `claude -p --output-format stream-json` output into the
 * two events jasa cares about: streamed text deltas and the final result.
 */
export const parseAgentLine = (line: string): AgentStreamEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  const event = asRecord(parsed);
  if (event === null) {
    return null;
  }

  if (event.type === "stream_event") {
    const stream = asRecord(event.event);
    const delta = asRecord(stream?.delta);
    if (stream?.type === "content_block_delta" && delta?.type === "text_delta") {
      return { kind: "delta", text: String(delta.text ?? "") };
    }
    return null;
  }

  if (event.type === "result") {
    const text = typeof event.result === "string" ? event.result : "";
    const failed = event.is_error === true || event.subtype !== "success";
    if (failed) {
      const error = text.trim() || `generation failed (${String(event.subtype ?? "unknown")})`;
      return { kind: "result", success: false, text, error };
    }
    return { kind: "result", success: true, text };
  }

  return null;
};

/** Split a finished response into the answer body and suggested follow-ups. */
export const splitFollowUps = (text: string): { answer: string; suggestions: string[] } => {
  const index = text.indexOf(FOLLOW_UPS_MARKER);
  if (index === -1) {
    return { answer: text.trim(), suggestions: [] };
  }
  const suggestions = text
    .slice(index + FOLLOW_UPS_MARKER.length)
    .split("\n")
    .filter((line) => /^\s*[-*]\s+\S/.test(line))
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .slice(0, 4);
  return { answer: text.slice(0, index).trim(), suggestions };
};

/**
 * Text safe to show while streaming: everything before the follow-ups marker,
 * including trimming a partially received marker at the tail.
 */
export const visibleAnswer = (text: string): string => {
  const index = text.indexOf(FOLLOW_UPS_MARKER);
  if (index !== -1) {
    return text.slice(0, index).trimEnd();
  }
  for (let length = FOLLOW_UPS_MARKER.length - 1; length > 0; length--) {
    if (text.endsWith(FOLLOW_UPS_MARKER.slice(0, length))) {
      return text.slice(0, text.length - length).trimEnd();
    }
  }
  return text;
};
