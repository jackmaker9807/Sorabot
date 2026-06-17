import {
  useGetBotStatus,
  useGetStats,
  useListLogs,
  useToggleBot,
  getGetBotStatusQueryKey
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, MessageSquare, Zap, ShieldAlert, Bot, Users, Server } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { getToken } from "@/lib/auth";
import { useRealtime } from "@/contexts/RealtimeContext";
import { useEffect, useRef, useState } from "react";

type GuildInfo = {
  id: string;
  name: string;
  memberCount: number;
  iconUrl: string | null;
};

function useGuilds() {
  return useQuery<GuildInfo[]>({
    queryKey: ["bot-guilds"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/bot/guilds", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      return res.json() as Promise<GuildInfo[]>;
    },
    refetchInterval: 30_000,
  });
}

export default function Home() {
  const queryClient = useQueryClient();
  const { data: botStatus, isLoading: loadingStatus } = useGetBotStatus();
  const { data: stats, isLoading: loadingStats } = useGetStats();
  const { data: logs, isLoading: loadingLogs } = useListLogs({ limit: 5 });
  const { data: guilds, isLoading: loadingGuilds } = useGuilds();
  const { status: wsStatus, lastLogEvent } = useRealtime();

  const [newLogIds, setNewLogIds] = useState<Set<number>>(new Set());
  const prevLastLogRef = useRef<typeof lastLogEvent>(null);

  useEffect(() => {
    if (!lastLogEvent || lastLogEvent === prevLastLogRef.current) return;
    prevLastLogRef.current = lastLogEvent;
    setNewLogIds((prev) => new Set([...prev, lastLogEvent.id]));
    const timer = setTimeout(() => {
      setNewLogIds((prev) => {
        const next = new Set(prev);
        next.delete(lastLogEvent.id);
        return next;
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [lastLogEvent]);

  const toggleBotMutation = useToggleBot({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetBotStatusQueryKey(), data);
      }
    }
  });

  const handleToggle = (checked: boolean) => {
    toggleBotMutation.mutate({ data: { running: checked } });
  };

  const isLive = wsStatus === "connected";

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">Status and performance metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Card */}
        <Card className="col-span-1 border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
            <Bot className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loadingStatus ? <Skeleton className="h-8 w-24" /> : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 mt-1">
                  <Switch
                    checked={botStatus?.running || false}
                    onCheckedChange={handleToggle}
                    disabled={toggleBotMutation.isPending}
                    className="data-[state=checked]:bg-primary"
                  />
                  <Badge variant={botStatus?.running ? "default" : "secondary"}>
                    {botStatus?.running ? "ONLINE" : "OFFLINE"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-2">
                  <Activity className="h-3 w-3" />
                  {botStatus?.ping ? `${botStatus.ping}ms ping` : "No connection"}
                  <span className="text-muted-foreground/30">•</span>
                  {botStatus?.guildCount || 0} servers
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Replies</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-3xl font-bold">{stats?.todayReplies?.toLocaleString() ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Automated messages sent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-3xl font-bold">{stats?.activeRules?.toLocaleString() ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Out of {stats?.totalRules ?? 0} total rules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">All Time Replies</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-3xl font-bold">{stats?.totalReplies?.toLocaleString() ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Since deployment</p>
          </CardContent>
        </Card>
      </div>

      {/* Server Info */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Server className="w-5 h-5 text-primary" />
          Server Terhubung
        </h2>
        {loadingGuilds ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : guilds && guilds.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {guilds.map((guild) => (
              <Card key={guild.id} className="border-border bg-card/50">
                <CardContent className="p-4 flex items-center gap-4">
                  {guild.iconUrl ? (
                    <img
                      src={guild.iconUrl}
                      alt={guild.name}
                      className="w-12 h-12 rounded-full object-cover shrink-0 border border-border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-border">
                      <Bot className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate text-foreground">{guild.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3" />
                      {guild.memberCount.toLocaleString()} member
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-border bg-card/30">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Bot belum terhubung ke server manapun.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Activity — Live Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Recent Activity
                {isLive && (
                  <span className="flex items-center gap-1.5 text-xs font-normal text-emerald-500">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    LIVE
                  </span>
                )}
                {wsStatus === "disconnected" && (
                  <span className="text-xs font-normal text-muted-foreground">(reconnecting...)</span>
                )}
              </CardTitle>
              <CardDescription>Latest auto-responses triggered across all servers.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-3">
              {logs.slice(0, 5).map(log => {
                const isNew = newLogIds.has(log.id);
                return (
                  <div
                    key={log.id}
                    className={[
                      "flex flex-col gap-2 p-4 rounded-lg border bg-card/50 transition-all duration-700",
                      isNew
                        ? "border-primary/50 bg-primary/5 shadow-sm shadow-primary/10"
                        : "border-border",
                    ].join(" ")}
                    style={isNew ? { animation: "slideInDown 0.3s ease-out" } : undefined}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isNew && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            New
                          </span>
                        )}
                        <span className="font-semibold text-primary">@{log.authorUsername}</span>
                        <span className="text-muted-foreground">in</span>
                        <span className="font-medium">#{log.channelName}</span>
                        {log.guildName && (
                          <span className="text-muted-foreground text-xs bg-secondary px-2 py-0.5 rounded">
                            {log.guildName}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(log.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <div className="text-sm border-l-2 border-muted pl-3 py-1 text-muted-foreground">
                      {log.triggerMessage}
                    </div>
                    <div className="text-sm pl-3 py-1 flex items-start gap-2">
                      <Bot className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{log.botResponse}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No recent activity.</p>
              {isLive && (
                <p className="text-xs mt-1 text-emerald-500/70">Watching for new messages...</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <style>{`
        @keyframes slideInDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
