import type { ChatMessage } from "@contracts/ai";

const CJK_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/g;

export class TokenEstimator {
  estimateText(text: string): number {
    const cjkCount = text.match(CJK_PATTERN)?.length ?? 0;
    const nonCjkLength = Math.max(text.length - cjkCount, 0);
    return Math.max(Math.ceil(cjkCount + nonCjkLength / 4), 0);
  }

  estimateMessages(messages: ChatMessage[]): number {
    return messages.reduce((total, message) => total + 4 + this.estimateText(message.content), 0);
  }
}
