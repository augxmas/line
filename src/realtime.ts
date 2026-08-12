import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

type RealtimeEvent = {
  type: 'request.changed';
  occurredAt: number;
};

let websocketServer: WebSocketServer | null = null;

export function attachRealtimeServer(server: Server): void {
  websocketServer = new WebSocketServer({ server, path: '/ws/requests' });
  websocketServer.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'connected', occurredAt: Date.now() }));
    socket.on('error', () => undefined);
  });
}

export function publishRequestChanged(): void {
  if (!websocketServer) return;
  const event: RealtimeEvent = { type: 'request.changed', occurredAt: Date.now() };
  const payload = JSON.stringify(event);
  websocketServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}
