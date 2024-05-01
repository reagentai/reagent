/**
 * This converts a readable stream with JSON data to async iterable.
 * Returns `{ json: data }` with parsed data as the json field.
 *
 * If parsing the data as JSON fails, it will return `{ text }`
 */
async function* jsonStreamToAsyncIterator(stream: ReadableStream) {
  const reader = stream.getReader();
  try {
    let data = await reader?.read();
    var enc = new TextDecoder("utf-8");
    while (data && !data.done) {
      const text = enc.decode(data?.value);
      const lines = text.split(/\r?\n/);
      for (let line of lines) {
        if (line.startsWith("data:")) {
          line = line.substring(5);
          try {
            yield { json: JSON.parse(line) };
          } catch (e) {
            yield { text: line.trim() };
          }
        }
      }
      data = await reader?.read();
    }
  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    reader.cancel().catch((e) => {});
    reader.releaseLock();
  }
}

export { jsonStreamToAsyncIterator };
