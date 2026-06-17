import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "./logger";

let wss: WebSocketServer | null = null;

export type WsEvent =
  | { type: "bot_status"; data: { running: boolean; username: string | null; guildCount: number; ping: number | null } }
  | { type: "new_log"; data: { id: number; authorUsername: string; channelName: string; guildName: string | null; triggerMessage: string; botResponse: string; createdAt: string } }
  | { type: "stats_update"; data: { totalReplies: number; todayReplies: number } };

export function initWss(server: Server): void {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    logger.info({ ip: req.socket.remoteAddress }, "WebSocket client connected");
    ws.on("error", (err) => logger.warn({ err }, "WebSocket client error"));
    ws.on("close", () => logger.debug("WebSocket client disconnected"));
    ws.send(JSON.stringify({ type: "connected", data: {} }));
  });

  logger.info("WebSocket server initialized at /ws");
}

export function broadcast(event: WsEvent): void {
  if (!wss) return;
  const message = JSON.stringify(event);
  let sent = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent++;
    }
  });
  if (sent > 0) logger.debug({ type: event.type, clients: sent }, "WS broadcast");
}
