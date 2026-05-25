export interface SseEvent {
  event: string | null;
  data: string;
  done: boolean;
}

export class SseParser {
  private buffer = "";

  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const blocks = this.buffer.split(/\r?\n\r?\n/);
    this.buffer = blocks.pop() ?? "";
    return blocks.flatMap((block) => this.parseBlock(block));
  }

  finish(): SseEvent[] {
    if (!this.buffer.trim()) {
      this.buffer = "";
      return [];
    }
    const events = this.parseBlock(this.buffer);
    this.buffer = "";
    return events;
  }

  private parseBlock(block: string): SseEvent[] {
    const dataLines: string[] = [];
    let event: string | null = null;

    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) {
        continue;
      }

      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        continue;
      }

      const field = line.slice(0, separatorIndex);
      const value = line.slice(separatorIndex + 1).replace(/^ /, "");
      if (field === "event") {
        event = value;
      }
      if (field === "data") {
        dataLines.push(value);
      }
    }

    if (dataLines.length === 0) {
      return [];
    }

    const data = dataLines.join("\n");
    return [
      {
        event,
        data,
        done: data.trim() === "[DONE]"
      }
    ];
  }
}
