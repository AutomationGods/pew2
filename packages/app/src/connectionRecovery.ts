/** Remember a real background visit across iOS's intervening inactive state. */
export function foregroundState(backgrounded: boolean, state: string): { backgrounded: boolean; refresh: boolean } {
  return {
    backgrounded: state === "background" || (state !== "active" && backgrounded),
    refresh: state === "active" && backgrounded,
  };
}

type RecoverableSocket = {
  readonly readyState: number;
  onopen?: unknown;
  onmessage?: unknown;
  onclose: unknown;
  onerror?: unknown;
  close(): void;
};

/** OPEN is only a local flag after suspension, not evidence the peer is alive. */
export function prepareReconnect(socket: RecoverableSocket | null, refreshOpen: boolean): boolean {
  if (socket && !refreshOpen &&
      (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return false;
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.close();
  }
  return true;
}
