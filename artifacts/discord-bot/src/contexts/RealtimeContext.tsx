import { createContext, useContext, ReactNode } from "react";
import type { ConnectionStatus, NewLogEvent } from "@/hooks/useRealtimeUpdates";

interface RealtimeContextValue {
  status: ConnectionStatus;
  lastLogEvent: NewLogEvent | null;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  status: "connecting",
  lastLogEvent: null,
});

export function RealtimeProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: RealtimeContextValue;
}) {
  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
