import { useState, useEffect } from "react";
import {
  useGetBotSettings,
  useUpdateBotSettings,
  useListAiProviders,
  useCreateAiProvider,
  useDeleteAiProvider,
  useToggleAiProvider,
  getGetBotSettingsQueryKey,
  getListAiProvidersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Save,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  HardDrive,
  Cloud,
  RotateCcw,
} from "lucide-react";

type DbProvider = "postgres" | "sqlite";
type DbConfig = { provider: DbProvider; sqliteUrl: string; hasCustomPostgresUrl: boolean };
type DbTestState = { loading: boolean; result: { ok: boolean; message: string } | null };

function useDatabaseConfig() {
  const { toast } = useToast();
  const [config, setConfig] = useState<DbConfig | null>(null);
  const [selected, setSelected] = useState<DbProvider>("postgres");
  const [postgresUrl, setPostgresUrl] = useState("");
  const [sqliteUrl, setSqliteUrl] = useState("file:./data/sora.db");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<DbTestState>({ loading: false, result: null });

  useEffect(() => {
    const token = getToken();
    fetch("/api/database/config", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json() as Promise<DbConfig>)
      .then((data) => {
        setConfig(data);
        setSelected(data.provider);
        setSqliteUrl(data.sqliteUrl ?? "file:./data/sora.db");
      })
      .catch(() => {});
  }, []);

  async function saveConfig() {
    setSaving(true);
    setSaved(false);
    try {
      const token = getToken();
      const res = await fetch("/api/database/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          provider: selected,
          sqliteUrl: sqliteUrl || "file:./data/sora.db",
          postgresUrl: postgresUrl || undefined,
        }),
      });
      if (res.ok) {
        setSaved(true);
        toast({ title: "Konfigurasi database disimpan", description: "Restart server untuk menerapkan perubahan." });
      }
    } catch {
      toast({ title: "Gagal menyimpan konfigurasi", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTestState({ loading: true, result: null });
    try {
      const token = getToken();
      const res = await fetch("/api/database/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          provider: selected,
          sqliteUrl: sqliteUrl || "file:./data/sora.db",
          postgresUrl: postgresUrl || undefined,
        }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      setTestState({ loading: false, result: data });
    } catch {
      setTestState({ loading: false, result: { ok: false, message: "Koneksi gagal" } });
    }
  }

  return {
    config, selected, setSelected, postgresUrl, setPostgresUrl,
    sqliteUrl, setSqliteUrl, saving, saved, testState,
    saveConfig, testConnection,
  };
}

type TestResult = {
  discord: { ok: boolean; message: string };
};

type ProviderPreset = {
  label: string;
  baseUrl: string | null;
  defaultModel: string;
  models: string[];
  keyPlaceholder: string;
  keyHint: string;
};

const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  gemini: {
    label: "Google Gemini",
    baseUrl: null,
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash-lite-preview-06-17"],
    keyPlaceholder: "AIzaSy...",
    keyHint: "Dapatkan gratis di aistudio.google.com/apikey",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    keyPlaceholder: "sk-...",
    keyHint: "Dapatkan di platform.openai.com/api-keys",
  },
  groq: {
    label: "Groq (gratis & cepat)",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-8b-instant",
    models: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
    keyPlaceholder: "gsk_...",
    keyHint: "Dapatkan gratis di console.groq.com/keys",
  },
  openrouter: {
    label: "OpenRouter (banyak model)",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.1-8b-instruct:free",
    models: [
      "meta-llama/llama-3.1-8b-instruct:free",
      "google/gemma-3-27b-it:free",
      "mistralai/mistral-7b-instruct:free",
      "anthropic/claude-3.5-haiku",
      "openai/gpt-4o-mini",
    ],
    keyPlaceholder: "sk-or-...",
    keyHint: "Dapatkan di openrouter.ai/keys — ada banyak model gratis",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    defaultModel: "",
    models: [],
    keyPlaceholder: "API key...",
    keyHint: "Mendukung Ollama, LM Studio, dan server OpenAI-compatible lainnya",
  },
};

const PROVIDER_BADGE_COLORS: Record<string, string> = {
  gemini: "text-blue-500 border-blue-500",
  openai: "text-green-500 border-green-500",
  groq: "text-orange-500 border-orange-500",
  openrouter: "text-purple-500 border-purple-500",
  custom: "text-muted-foreground border-border",
};

export default function Credentials() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settings = useGetBotSettings();
  const providers = useListAiProviders();

  const updateSettings = useUpdateBotSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotSettingsQueryKey() });
        toast({ title: "Discord Token disimpan" });
        setDiscordToken("");
        setTestResult(null);
      },
      onError: () => {
        toast({ title: "Gagal menyimpan", variant: "destructive" });
      },
    },
  });

  const createProvider = useCreateAiProvider({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiProvidersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBotSettingsQueryKey() });
        toast({ title: "AI Provider ditambahkan" });
        resetForm();
      },
      onError: () => {
        toast({ title: "Gagal menambahkan provider", variant: "destructive" });
      },
    },
  });

  const deleteProvider = useDeleteAiProvider({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiProvidersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBotSettingsQueryKey() });
        toast({ title: "Provider dihapus" });
      },
    },
  });

  const toggleProvider = useToggleAiProvider({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiProvidersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBotSettingsQueryKey() });
      },
    },
  });

  // Discord token state
  const [discordToken, setDiscordToken] = useState("");
  const [showDiscordToken, setShowDiscordToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // New provider form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [newModel, setNewModel] = useState(PROVIDER_PRESETS.gemini.defaultModel);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [testState, setTestState] = useState<{ testing: boolean; result: { ok: boolean; message: string } | null }>({ testing: false, result: null });

  function resetForm() {
    setNewLabel("");
    setNewKey("");
    setNewModel(PROVIDER_PRESETS.gemini.defaultModel);
    setCustomBaseUrl("");
    setTestState({ testing: false, result: null });
    setShowAddForm(false);
  }

  function handleProviderChange(val: string) {
    setSelectedProvider(val);
    setNewModel(PROVIDER_PRESETS[val]?.defaultModel ?? "");
    setTestState({ testing: false, result: null });
  }

  const preset = PROVIDER_PRESETS[selectedProvider] ?? PROVIDER_PRESETS.custom;

  async function handleTestDiscord() {
    setTesting(true);
    setTestResult(null);
    try {
      const token = getToken();
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ discordToken: discordToken || undefined }),
      });
      const data = await res.json() as TestResult;
      setTestResult(data);
    } catch {
      toast({ title: "Gagal menguji koneksi", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  async function handleTestProvider() {
    if (!newKey.trim() || !newModel.trim()) return;
    setTestState({ testing: true, result: null });
    try {
      const token = getToken();
      const effectiveBaseUrl = selectedProvider === "custom" ? customBaseUrl : preset.baseUrl;
      const res = await fetch("/api/settings/ai-providers/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          provider: selectedProvider,
          key: newKey.trim(),
          baseUrl: effectiveBaseUrl || undefined,
          model: newModel.trim(),
        }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      setTestState({ testing: false, result: data });
    } catch {
      setTestState({ testing: false, result: { ok: false, message: "Gagal menguji provider" } });
    }
  }

  function handleAddProvider() {
    if (!newKey.trim() || !newModel.trim()) {
      toast({ title: "Key dan model wajib diisi", variant: "destructive" });
      return;
    }
    const effectiveBaseUrl = selectedProvider === "custom" ? customBaseUrl : preset.baseUrl;
    createProvider.mutate({
      data: {
        provider: selectedProvider,
        key: newKey.trim(),
        model: newModel.trim(),
        label: newLabel.trim() || undefined,
        baseUrl: effectiveBaseUrl || undefined,
      },
    });
  }

  const db = useDatabaseConfig();

  if (settings.isLoading || providers.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const hasDiscordToken = settings.data?.hasDiscordToken ?? false;
  const providerList = providers.data ?? [];

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Kredensial</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Kelola database, Discord Bot Token, dan AI Provider.
        </p>
      </div>

      {/* Database Config */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Database</CardTitle>
          </div>
          <CardDescription>
            Pilih penyimpanan data bot. Perubahan memerlukan restart server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider Selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { db.setSelected("postgres"); db.testState.result && void 0; }}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                db.selected === "postgres"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-border/80"
              }`}
            >
              <Cloud className="w-5 h-5" />
              <span>PostgreSQL</span>
              <span className="text-[10px] font-normal opacity-70">Cloud / Server</span>
            </button>
            <button
              onClick={() => db.setSelected("sqlite")}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                db.selected === "sqlite"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-border/80"
              }`}
            >
              <HardDrive className="w-5 h-5" />
              <span>SQLite</span>
              <span className="text-[10px] font-normal opacity-70">Lokal / File</span>
            </button>
          </div>

          {/* Active badge */}
          {db.config && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Aktif sekarang:</span>
              <Badge variant="outline" className="text-[10px] gap-1">
                {db.config.provider === "postgres" ? <Cloud className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
                {db.config.provider === "postgres" ? "PostgreSQL" : "SQLite"}
              </Badge>
              {db.config.provider !== db.selected && (
                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/50">
                  Belum disimpan
                </Badge>
              )}
            </div>
          )}

          {/* PostgreSQL URL */}
          {db.selected === "postgres" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Connection URL (opsional)</Label>
              <Input
                type="password"
                placeholder={db.config?.hasCustomPostgresUrl ? "URL custom sudah diatur" : "postgresql://user:pass@host/db (kosongkan untuk gunakan default)"}
                value={db.postgresUrl}
                onChange={(e) => db.setPostgresUrl(e.target.value)}
                className="text-sm bg-background border-border font-mono"
              />
              <p className="text-xs text-muted-foreground">Cocok untuk Supabase, Neon, Railway, PlanetScale, dll.</p>
            </div>
          )}

          {/* SQLite path */}
          {db.selected === "sqlite" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">File path</Label>
              <Input
                placeholder="file:./data/sora.db"
                value={db.sqliteUrl}
                onChange={(e) => db.setSqliteUrl(e.target.value)}
                className="text-sm bg-background border-border font-mono"
              />
              <p className="text-xs text-muted-foreground">Data disimpan sebagai file lokal di server. Gratis, tidak perlu koneksi internet.</p>
            </div>
          )}

          {/* Test result */}
          {db.testState.result && (
            <div className={`flex items-center gap-1.5 text-xs ${db.testState.result.ok ? "text-green-600" : "text-red-500"}`}>
              {db.testState.result.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {db.testState.result.message}
            </div>
          )}

          {/* Restart notice */}
          {db.saved && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs">
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              Konfigurasi disimpan. Restart API server agar perubahan diterapkan.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void db.testConnection()}
              disabled={db.testState.loading}
              className="gap-2"
            >
              {db.testState.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              Test
            </Button>
            <Button
              size="sm"
              onClick={() => void db.saveConfig()}
              disabled={db.saving}
              className="gap-2"
            >
              {db.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Simpan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Discord Token */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Discord Bot Token</CardTitle>
          </div>
          <CardDescription>Token untuk menghubungkan bot ke server Discord kamu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Status</Label>
            {hasDiscordToken ? (
              <Badge variant="outline" className="text-xs text-green-600 border-green-600 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Sudah diatur
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-600 gap-1">
                <AlertCircle className="w-3 h-3" /> Belum diatur
              </Badge>
            )}
          </div>
          <div className="relative">
            <Input
              type={showDiscordToken ? "text" : "password"}
              value={discordToken}
              onChange={(e) => setDiscordToken(e.target.value)}
              placeholder={hasDiscordToken ? "Biarkan kosong jika tidak ingin mengubah" : "Masukkan Discord Bot Token..."}
              className="pr-10 text-sm bg-background border-border font-mono"
            />
            <button
              type="button"
              onClick={() => setShowDiscordToken((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showDiscordToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {testResult && (
            <div className={`flex items-center gap-1.5 text-xs ${testResult.discord.ok ? "text-green-600" : "text-red-500"}`}>
              {testResult.discord.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {testResult.discord.message}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Dapatkan di{" "}
            <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              discord.com/developers/applications
            </a>{" "}
            → Bot → Token. Aktifkan <strong>Message Content Intent</strong>.
          </p>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleTestDiscord} disabled={testing || !discordToken} className="gap-2">
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              Test
            </Button>
            <Button size="sm" onClick={() => updateSettings.mutate({ data: { discordToken } })} disabled={updateSettings.isPending || !discordToken} className="gap-2">
              {updateSettings.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Simpan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Providers */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">AI Providers</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {providerList.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {providerList.filter((p) => p.enabled).length}/{providerList.length} aktif
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7"
                onClick={() => queryClient.invalidateQueries({ queryKey: getListAiProvidersQueryKey() })}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <CardDescription>
            Tambahkan multiple AI provider — jika satu provider gagal atau rate limit, sistem otomatis coba provider berikutnya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider list */}
          {providerList.length > 0 ? (
            <div className="space-y-2">
              {providerList.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-md border border-border p-3 bg-background"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">
                        {p.label || `${PROVIDER_PRESETS[p.provider]?.label ?? p.provider} #${p.id}`}
                      </span>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${PROVIDER_BADGE_COLORS[p.provider] ?? ""}`}>
                        {PROVIDER_PRESETS[p.provider]?.label ?? p.provider}
                      </Badge>
                      {p.enabled ? (
                        <Badge variant="outline" className="text-[10px] text-green-600 border-green-600 shrink-0">Aktif</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">Nonaktif</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.maskedKey} · {p.model}</p>
                  </div>
                  <Switch
                    checked={p.enabled}
                    onCheckedChange={() => toggleProvider.mutate({ id: p.id })}
                    className="shrink-0"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-red-500 shrink-0"
                    onClick={() => {
                      if (confirm(`Hapus provider "${p.label || `#${p.id}`}"?`)) {
                        deleteProvider.mutate({ id: p.id });
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-6 text-center">
              <Cpu className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">Belum ada AI Provider.</p>
              <p className="text-xs text-muted-foreground mt-1">Tambahkan provider di bawah untuk mengaktifkan AI reply.</p>
            </div>
          )}

          {/* Add form toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm((v) => !v)}
            className="w-full gap-2"
          >
            {showAddForm ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showAddForm ? "Tutup" : "Tambah AI Provider"}
          </Button>

          {/* Add provider form */}
          {showAddForm && (
            <div className="rounded-md border border-border p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-semibold text-foreground">Tambah Provider Baru</p>

              {/* Provider select */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Provider</Label>
                <Select value={selectedProvider} onValueChange={handleProviderChange}>
                  <SelectTrigger className="bg-background border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
                      <SelectItem key={key} value={key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Label */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Label (opsional)</Label>
                <Input
                  placeholder="Misal: Key Utama, Backup, dll."
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="text-sm bg-background border-border"
                />
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">API Key</Label>
                <div className="relative">
                  <Input
                    type={showNewKey ? "text" : "password"}
                    placeholder={preset.keyPlaceholder}
                    value={newKey}
                    onChange={(e) => { setNewKey(e.target.value); setTestState({ testing: false, result: null }); }}
                    className="pr-10 text-sm bg-background border-border font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{preset.keyHint}</p>
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Model</Label>
                {preset.models.length > 0 ? (
                  <Select value={newModel} onValueChange={setNewModel}>
                    <SelectTrigger className="bg-background border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {preset.models.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Nama model, misal: llama3, mistral, dll."
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="text-sm bg-background border-border font-mono"
                  />
                )}
              </div>

              {/* Custom base URL */}
              {selectedProvider === "custom" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Base URL</Label>
                  <Input
                    placeholder="http://localhost:11434/v1"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    className="text-sm bg-background border-border font-mono"
                  />
                </div>
              )}

              {/* Test result */}
              {testState.result && (
                <div className={`flex items-start gap-1.5 text-xs ${testState.result.ok ? "text-green-600" : "text-red-500"}`}>
                  {testState.result.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                  {testState.result.message}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestProvider}
                  disabled={!newKey.trim() || !newModel.trim() || testState.testing}
                  className="gap-2"
                >
                  {testState.testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                  Test
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddProvider}
                  disabled={!newKey.trim() || !newModel.trim() || createProvider.isPending}
                  className="gap-2"
                >
                  {createProvider.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Tambahkan
                </Button>
                <Button variant="ghost" size="sm" onClick={resetForm} className="text-muted-foreground">
                  Batal
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
