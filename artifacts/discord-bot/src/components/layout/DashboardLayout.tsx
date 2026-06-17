import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import type { ConnectionStatus } from "@/hooks/useRealtimeUpdates";

interface DashboardLayoutProps {
  children: ReactNode;
  username?: string;
  onLogout?: () => void;
  liveStatus?: ConnectionStatus;
}

export function DashboardLayout({ children, username, onLogout, liveStatus }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar username={username} onLogout={onLogout} liveStatus={liveStatus} />
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-6xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
