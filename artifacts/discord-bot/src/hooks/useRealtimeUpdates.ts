import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetBotStatusQueryKey,
  getGetStatsQueryKey,
  getListLogsQueryKey,
} from "@workspace/api-client-react";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type NewLogEvent = {
  id: number;
  authorUsername: string;
  channelName: string;
  guildName: string | null;
  triggerMessage: string;
  botResponse: string;
  createdAt: string;
};

type StatsShape = {
  totalReplies: number;
  todayReplies: number;
  activeRules: number;
  totalRules: number;
};

export function useRealtimeUpdates() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastLogEvent, setLastLogEvent] = useState<NewLogEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;
      setStatus("connecting");

      ws.onopen = () => {
        if (!unmountedRef.current) setStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; data: unknown };

          if (msg.type === "bot_status") {
            void queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });

          } else if (msg.type === "new_log") {
            const logData = msg.data as NewLogEvent;

            // Instantly bump stats counters in cache (no HTTP round-trip)
            queryClient.setQueryData<StatsShape>(getGetStatsQueryKey(), (old) => {
              if (!old) return old;
              return {
                ...old,
                totalReplies: old.totalReplies + 1,
                todayReplies: old.todayReplies + 1,
              };
            });

            // Prepend the new log to every cached list (whatever limit params)
            queryClient.setQueriesData<NewLogEvent[]>(
              { queryKey: getListLogsQueryKey() },
              (old) => {
                if (!Array.isArray(old)) return old;
                return [logData, ...old];
              },
            );

            if (!unmountedRef.current) setLastLogEvent(logData);

          } else if (msg.type === "stats_update") {
            void queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        setStatus("disconnected");
        reconnectTimerRef.current = setTimeout(connect, 4000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [queryClient]);

  return { status, lastLogEvent };
}
