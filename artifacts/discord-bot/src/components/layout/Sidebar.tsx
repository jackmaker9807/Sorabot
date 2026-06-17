import { Link, useLocation } from "wouter";
import { LayoutDashboard, Settings2, ScrollText, LogOut, Sparkles, KeyRound, User, UserCog, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { getStoredTheme, applyTheme, type Theme } from "@/lib/theme";

import type { ConnectionStatus } from "@/hooks/useRealtimeUpdates";

interface SidebarProps {
  username?: string;
  onLogout?: () => void;
  liveStatus?: ConnectionStatus;
}

export function Sidebar({ username, onLogout, liveStatus }: SidebarProps) {
  const [location] = useLocation();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const routes = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/rules", label: "Rules Engine", icon: Settings2 },
    { href: "/logs", label: "Message Logs", icon: ScrollText },
    { href: "/credentials", label: "Kredensial", icon: KeyRound },
    { href: "/settings", label: "Pengaturan", icon: Sparkles },
    { href: "/account", label: "Ubah Akun", icon: UserCog },
  ];

  return (
    <aside className="w-64 border-r border-border bg-sidebar h-full flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3 font-semibold text-xl text-foreground">
          <div className="bg-primary/20 p-2 rounded-lg text-primary">
            <span className="text-xl leading-none">🌸</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span>Sora</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-normal text-muted-foreground">Discord AI Bot</span>
              {liveStatus === "connected" && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-green-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  LIVE
                </span>
              )}
              {liveStatus === "disconnected" && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  OFF
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-1">
        {routes.map((route) => {
          const active = location === route.href;
          return (
            <Link key={route.href} href={route.href} className="block">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <route.icon className="w-4 h-4" />
                {route.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 mt-auto border-t border-border space-y-1">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition-colors"
        >
          {theme === "dark" ? (
            <>
              <Sun className="w-4 h-4" />
              Mode Terang
            </>
          ) : (
            <>
              <Moon className="w-4 h-4" />
              Mode Gelap
            </>
          )}
        </button>

        {username && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <User className="w-3.5 h-3.5" />
            <span className="truncate">{username}</span>
          </div>
        )}

        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
