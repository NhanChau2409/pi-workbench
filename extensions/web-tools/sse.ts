export interface SseEvent {
  event: string;
  data: unknown;
}

/** Read JSON Server-Sent Events until EOF or the callback asks to stop. */
export async function readSseEvents(
  response: Response,
  signal: AbortSignal | undefined,
  onEvent: (event: SseEvent) => boolean | void | Promise<boolean | void>,
): Promise<void> {
  if (!response.body) throw new Error("Search response had no body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let eventData: string[] = [];
  let reachedEof = false;

  const flush = async (): Promise<boolean> => {
    if (eventData.length === 0) return false;
    const raw = eventData.join("\n").trim();
    const name = eventName;
    eventName = "";
    eventData = [];
    if (!raw || raw === "[DONE]") return false;

    try {
      return (await onEvent({ event: name, data: JSON.parse(raw) })) === true;
    } catch (error) {
      if (error instanceof SyntaxError) return false;
      throw error;
    }
  };

  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) {
        reachedEof = true;
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
        if (line === "") {
          if (await flush()) return;
        } else if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          eventData.push(line.slice(5).trimStart());
        }
      }
    }

    if (buffer.trim()) {
      const line = buffer.trimEnd();
      if (line.startsWith("data:")) eventData.push(line.slice(5).trimStart());
    }
    await flush();
  } finally {
    if (!reachedEof) {
      try {
        await reader.cancel();
      } catch {
        // Best-effort cleanup after completion or cancellation.
      }
    }
    reader.releaseLock();
  }
}
