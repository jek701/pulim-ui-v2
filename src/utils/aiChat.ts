import { api } from '../api/client';
import { auth } from '../firebase';

export type ChatRole = 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatStreamInput {
  /** Omit to start a new chat; the server returns the new id via the `meta` event. */
  chatId?: string;
  message: string;
  language: string;
}

export interface StreamCallbacks {
  onMeta?: (chatId: string) => void;
  onThinkingStart?: () => void;
  onDelta: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (err: Error) => void;
}

/**
 * Stream a chat reply from the API over Server-Sent Events. Returns an abort
 * function. The server assembles the financial context, enforces usage limits,
 * picks the model, and persists both the user and assistant messages.
 */
export function streamChatReply(input: ChatStreamInput, callbacks: StreamCallbacks): () => void {
  const aborter = new AbortController();

  (async () => {
    try {
      callbacks.onThinkingStart?.();
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch(`${api.baseUrl}/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(input),
        signal: aborter.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'AI request failed.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const lines = frame.split('\n');
          const eventLine = lines.find((l) => l.startsWith('event: '));
          const dataLine = lines.find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          const event = eventLine ? eventLine.slice(7).trim() : 'message';
          const payload = JSON.parse(dataLine.slice(6));
          if (event === 'meta') callbacks.onMeta?.(payload.chatId);
          else if (event === 'delta') callbacks.onDelta(payload.text);
          else if (event === 'done') full = payload.text ?? full;
          else if (event === 'error') throw new Error(payload.message || 'AI error');
        }
      }
      callbacks.onComplete(full);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      callbacks.onError(err as Error);
    }
  })();

  return () => aborter.abort();
}
