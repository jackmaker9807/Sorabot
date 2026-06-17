import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect, useCallback, useRef } from "react";
import NotFound from "@/pages/not-found";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Home from "@/pages/Home";
import Rules from "@/pages/Rules";
import Logs from "@/pages/Logs";
import Settings from "@/pages/Settings";
import Credentials from "@/pages/Credentials";
import Account from "@/pages/Account";
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getToken, clearAuth, saveAuth } from "@/lib/auth";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { RealtimeProvider } from "@/contexts/RealtimeContext";

setAuthTokenGetter(getToken);

type AuthState = "loading" | "authenticated" | "unauthenticated";
type AppState = "checking" | "setup" | AuthState;

function AppRouter() {
  const [appState, setAppState] = useState<AppState>("checking");
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [username, setUsername] = useState("");
  const queryClientRef = useRef<QueryClient | null>(null);

  const handleUnauthorized = useCallback(() => {
    clearAuth();
    setAuthState("unauthenticated");
    setUsername("");
    queryClientRef.current?.clear();
  }, []);

  if (!queryClientRef.current) {
    const onUnauthorized = handleUnauthorized;
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          retry: (failureCount, error) => {
            if ((error as { status?: number }).status === 401) {
              onUnauthorized();
              return false;
            }
            return failureCount < 2;
          },
        },
        mutations: {
          onError: (error) => {
            if ((error as { status?: number }).status === 401) {
              onUnauthorized();
            }
          },
        },
      },
    });
  }

  async function initialize() {
    try {
      const setupRes = await fetch("/api/setup/status");
      if (setupRes.ok) {
        const setupData = await setupRes.json() as { needsSetup: boolean };
        if (setupData.needsSetup) {
          clearAuth();
          setAppState("setup");
          return;
        }
      }
    } catch {
      // network error — proceed to auth check
    }

    const token = getToken();
    if (!token) {
      setAppState("unauthenticated");
      setAuthState("unauthenticated");
      return;
    }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { authenticated: boolean; username: string };
        if (data.authenticated) {
          setUsername(data.username);
          setAppState("authenticated");
          setAuthState("authenticated");
          return;
        }
      }
    } catch {
      // network error
    }
    clearAuth();
    setAppState("unauthenticated");
    setAuthState("unauthenticated");
  }

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSetupComplete() {
    clearAuth();
    setAppState("unauthenticated");
    setAuthState("unauthenticated");
  }

  function handleLogin(token: string, user: string) {
    saveAuth(token, user);
    setUsername(user);
    setAppState("authenticated");
    setAuthState("authenticated");
  }

  async function handleLogout() {
    const token = getToken();
    if (token) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    clearAuth();
    setAppState("unauthenticated");
    setAuthState("unauthenticated");
    setUsername("");
    queryClientRef.current?.clear();
  }

  const content = (() => {
    if (appState === "checking") {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Memuat...</div>
        </div>
      );
    }
    if (appState === "setup") {
      return <Setup onComplete={handleSetupComplete} />;
    }
    if (appState === "unauthenticated" || authState === "unauthenticated") {
      return <Login onLogin={handleLogin} />;
    }
    if (appState === "authenticated") {
      return <AuthenticatedDashboard username={username} onLogout={handleLogout} />;
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Memuat...</div>
      </div>
    );
  })();

  return (
    <QueryClientProvider client={queryClientRef.current}>
      {content}
    </QueryClientProvider>
  );
}

function AuthenticatedDashboard({ username, onLogout }: { username: string; onLogout: () => void }) {
  const { status, lastLogEvent } = useRealtimeUpdates();
  return (
    <RealtimeProvider value={{ status, lastLogEvent }}>
      <DashboardLayout username={username} onLogout={onLogout} liveStatus={status}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/rules" component={Rules} />
          <Route path="/logs" component={Logs} />
          <Route path="/credentials" component={Credentials} />
          <Route path="/settings" component={Settings} />
          <Route path="/account" component={Account} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    </RealtimeProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppRouter />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
