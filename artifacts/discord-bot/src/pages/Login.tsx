import { useState, useEffect, type FormEvent } from "react";
import { Eye, EyeOff, Lock, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAuth } from "@/lib/auth";
import { getStoredTheme, applyTheme, type Theme } from "@/lib/theme";

interface LoginProps {
  onLogin: (token: string, username: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json() as { authenticated?: boolean; token?: string; error?: string };

      if (res.ok && data.authenticated && data.token) {
        saveAuth(data.token, username);
        onLogin(data.token, username);
      } else {
        setError(data.error ?? "Login gagal. Coba lagi.");
      }
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      {/* Theme toggle - top right */}
      <button
        onClick={toggleTheme}
        title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
        className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="bg-primary/20 p-4 rounded-2xl text-primary text-4xl leading-none select-none">
            🌸
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sora</h1>
            <p className="text-sm text-muted-foreground mt-1">Asisten Discord AI perempuanmu 💜</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground pb-2 border-b border-border">
            <Lock className="w-4 h-4 text-primary" />
            Masuk ke Dashboard
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm text-muted-foreground">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
              className="bg-background border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="pr-10 bg-background border-border"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Masuk..." : "Masuk"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Default: <code className="bg-muted px-1 rounded">admin</code> / <code className="bg-muted px-1 rounded">admin</code>
          </p>
        </form>
      </div>
    </div>
  );
}
