type Listener<T> = (event: T) => void;

export class LiveUpdates<T extends { type: string }> {
  private listeners = new Set<Listener<T>>();

  subscribe(listener: Listener<T>) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: T) {
    for (const listener of this.listeners) listener(event);
  }
}

export const inboxLiveUpdates = new LiveUpdates<{
  type: "message" | "status";
  conversationId: string;
  payload: unknown;
}>();
