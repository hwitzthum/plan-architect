/**
 * Parse a fetch Response body as NDJSON (newline-delimited JSON). Yields each
 * decoded object as the stream arrives. Malformed lines are skipped silently.
 */
export async function* parseNdjsonStream<T>(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<T, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line.length > 0) {
          try {
            yield JSON.parse(line) as T;
          } catch {
            // Skip malformed chunk; the producer may have flushed mid-line.
          }
        }
        newlineIndex = buffer.indexOf("\n");
      }
    }

    const trailing = buffer.trim();
    if (trailing.length > 0) {
      try {
        yield JSON.parse(trailing) as T;
      } catch {
        // Trailing partial; ignore.
      }
    }
  } finally {
    reader.releaseLock();
  }
}
