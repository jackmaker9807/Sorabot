import { useState, useEffect, type FormEvent } from "react";
import { Eye, EyeOff, CheckCircle2, ArrowRight, ArrowLeft, Bot, KeyRound, Sparkles, ShieldCheck, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStoredTheme, applyTheme, type Theme } from "@/lib/theme";

interface SetupProps {
  onComplete: () => void;
}

const AI_PROVIDERS = [
  { value: "gemini", label: "Google Gemini", defaultModel: "gemini-2.5-flash", placeholder: "AIzaSy..." },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini", placeholder: "sk-..." },
  { value: "openrouter", label: "OpenRouter", defaultModel: "openai/gpt-4o-mini", placeholder: "sk-or-..." },
  { value: "custom", label: "Custom (OpenAI-compatible)", defaultModel: "gpt-4o-mini", placeholder: "sk-..." },
];

const STEPS = [
  { id: "welcome", title: "Selamat Datang", icon: "🌸" },
  { id: "credentials", title: "Akun Admin", icon: "🔑" },
  { id: "discord", title: "Discord Token", icon: "🤖" },
  { id: "ai", title: "AI Provider", icon: "✨" },
  { id: "done", title: "Selesai", icon: "🎉" },
];

export default function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState(0);
  const [theme, setTheme] = useState<Theme>("dark");

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [discordToken, setDiscordToken] = useState("");
  const [discordSkip, setDiscordSkip] = useState(false);
  const [discordTesting, setDiscordTesting] = useState(false);
  const [discordTestResult, setDiscordTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [aiProvider, setAiProvider] = useState("gemini");
  const [aiLabel, setAiLabel] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState("gemini-2.5-flash");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiSkip, setAiSkip] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  function handleProviderChange(val: string) {
    setAiProvider(val);
    const p = AI_PROVIDERS.find((x) => x.value === val);
    if (p) setAiModel(p.defaultModel);
    setAiKey("");
    setAiBaseUrl("");
  }

  async function testDiscordToken() {
    if (!discordToken.trim()) return;
    setDiscordTesting(true);
    setDiscordTestResult(null);
    try {
      const r = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordToken }),
      });
      const data = await r.json() as { discord?: { ok: boolean; message: string } };
      if (data.discord) setDiscordTestResult(data.discord);
    } catch {
      setDiscordTestResult({ ok: false, message: "Tidak dapat terhubung ke server." });
    } finally {
      setDiscordTesting(false);
    }
  }

  function canProceed(): boolean {
    if (step === 1) {
      return username.trim().length >= 3 && password.length >= 6 && password === confirmPassword;
    }
    if (step === 2) return discordSkip || discordToken.trim().length > 0;
    if (step === 3) return aiSkip || aiKey.trim().length > 0;
    return true;
  }

  function nextStep() {
    setError("");
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  }

  function prevStep() {
    setError("");
    if (step > 0) setStep((s) => s - 1);
  }

  async function handleComplete(e: FormEvent) {
    e.preventDefault();
    if (!canProceed()) return;
    setError("");
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { username, password };
      if (!discordSkip && discordToken.trim()) body.discordToken = discordToken.trim();
      if (!aiSkip && aiKey.trim()) {
        body.aiProvider = {
          provider: aiProvider,
          label: aiLabel || AI_PROVIDERS.find((x) => x.value === aiProvider)?.label || aiProvider,
          keyValue: aiKey.trim(),
          model: aiModel.trim(),
          baseUrl: aiBaseUrl.trim() || undefined,
        };
      }
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setStep(4);
      } else {
        setError(data.error ?? "Terjadi kesalahan. Coba lagi.");
      }
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setSubmitting(false);
    }
  }

  const currentProvider = AI_PROVIDERS.find((p) => p.value === aiProvider)!;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <button
        onClick={toggleTheme}
        title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
        className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-lg">
        {/* Stepper */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-1 mb-8">
            {STEPS.slice(0, 4).map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                      ? "bg-primary/20 text-primary border-2 border-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                {i < 3 && (
                  <div className={`w-8 h-0.5 mx-1 ${i < step ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-6">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-primary/20 p-5 rounded-2xl text-5xl leading-none select-none">🌸</div>
              <h1 className="text-2xl font-bold text-foreground">Halo! Saya Sora 💜</h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
                Sepertinya ini pertama kalinya kamu memasang Sora. Mari saya bantu kamu menyiapkan semuanya dalam beberapa langkah.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              {[
                { icon: <ShieldCheck className="w-4 h-4" />, label: "Akun Admin", desc: "Atur username & password" },
                { icon: <Bot className="w-4 h-4" />, label: "Discord Token", desc: "Hubungkan bot ke Discord" },
                { icon: <Sparkles className="w-4 h-4" />, label: "AI Provider", desc: "Aktifkan kecerdasan AI" },
                { icon: <CheckCircle2 className="w-4 h-4" />, label: "Siap!", desc: "Bot langsung jalan" },
              ].map((item) => (
                <div key={item.label} className="flex gap-3 bg-muted/50 rounded-lg p-3">
                  <div className="text-primary mt-0.5 shrink-0">{item.icon}</div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={nextStep} className="w-full gap-2">
              Mulai Setup <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 1: Credentials */}
        {step === 1 && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <KeyRound className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Buat Akun Admin</h2>
                <p className="text-xs text-muted-foreground">Ini akan digunakan untuk masuk ke dashboard</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="setup-username" className="text-sm">Username</Label>
                <Input
                  id="setup-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  minLength={3}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">Minimal 3 karakter</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="setup-password" className="text-sm">Password</Label>
                <div className="relative">
                  <Input
                    id="setup-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10 bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Minimal 6 karakter</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="setup-confirm" className="text-sm">Konfirmasi Password</Label>
                <Input
                  id="setup-confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-background"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500">Password tidak cocok</p>
                )}
                {confirmPassword && password === confirmPassword && password.length >= 6 && (
                  <p className="text-xs text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Password cocok
                  </p>
                )}
              </div>
            </div>

            {/* Validation checklist */}
            <div className="bg-muted/40 rounded-lg px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground mb-1">Syarat untuk lanjut:</p>
              {[
                { ok: username.trim().length >= 3, label: `Username minimal 3 karakter (sekarang: ${username.trim().length})` },
                { ok: password.length >= 6, label: `Password minimal 6 karakter (sekarang: ${password.length})` },
                { ok: password.length >= 6 && password === confirmPassword, label: "Konfirmasi password harus cocok" },
              ].map((item) => (
                <div key={item.label} className={`flex items-center gap-2 text-xs ${item.ok ? "text-green-600" : "text-muted-foreground"}`}>
                  {item.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-500" />
                    : <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                  }
                  {item.label}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={prevStep} className="gap-1">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button onClick={nextStep} disabled={!canProceed()} className="flex-1 gap-2">
                Lanjut <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Discord Token */}
        {step === 2 && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Bot className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Discord Bot Token</h2>
                <p className="text-xs text-muted-foreground">Token bot dari Discord Developer Portal</p>
              </div>
            </div>

            <div className="space-y-4">
              {!discordSkip && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="setup-token" className="text-sm">Bot Token</Label>
                    <Input
                      id="setup-token"
                      type="password"
                      value={discordToken}
                      onChange={(e) => { setDiscordToken(e.target.value); setDiscordTestResult(null); }}
                      placeholder="MTxxxxxxxxx..."
                      className="bg-background font-mono text-sm"
                    />
                  </div>

                  {discordTestResult && (
                    <div className={`text-sm rounded-lg px-3 py-2 flex items-center gap-2 ${
                      discordTestResult.ok
                        ? "bg-green-500/10 border border-green-500/20 text-green-600"
                        : "bg-red-500/10 border border-red-500/20 text-red-500"
                    }`}>
                      {discordTestResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : "❌"}
                      {discordTestResult.message}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={testDiscordToken}
                    disabled={!discordToken.trim() || discordTesting}
                    className="w-full"
                  >
                    {discordTesting ? "Menguji..." : "Uji Koneksi Token"}
                  </Button>

                  <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Cara mendapatkan token:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Buka discord.com/developers/applications</li>
                      <li>Buat aplikasi baru / pilih yang sudah ada</li>
                      <li>Masuk ke tab <strong>Bot</strong></li>
                      <li>Klik <strong>Reset Token</strong> dan salin</li>
                    </ol>
                  </div>
                </>
              )}

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={discordSkip}
                  onChange={(e) => { setDiscordSkip(e.target.checked); setDiscordTestResult(null); }}
                  className="rounded"
                />
                <span className="text-sm text-muted-foreground">Lewati dulu, atur nanti di Settings</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={prevStep} className="gap-1">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button onClick={nextStep} disabled={!canProceed()} className="flex-1 gap-2">
                Lanjut <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: AI Provider */}
        {step === 3 && (
          <form onSubmit={handleComplete} className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-base font-semibold text-foreground">AI Provider</h2>
                <p className="text-xs text-muted-foreground">Sumber kecerdasan bot Sora (opsional)</p>
              </div>
            </div>

            <div className="space-y-4">
              {!aiSkip && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Provider</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {AI_PROVIDERS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => handleProviderChange(p.value)}
                          className={`rounded-lg border px-3 py-2 text-sm text-left transition-all ${
                            aiProvider === p.value
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-key" className="text-sm">API Key</Label>
                    <Input
                      id="ai-key"
                      type="password"
                      value={aiKey}
                      onChange={(e) => setAiKey(e.target.value)}
                      placeholder={currentProvider.placeholder}
                      className="bg-background font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-model" className="text-sm">Model</Label>
                    <Input
                      id="ai-model"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder={currentProvider.defaultModel}
                      className="bg-background"
                    />
                  </div>

                  {aiProvider === "custom" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="ai-baseurl" className="text-sm">Base URL</Label>
                      <Input
                        id="ai-baseurl"
                        value={aiBaseUrl}
                        onChange={(e) => setAiBaseUrl(e.target.value)}
                        placeholder="https://api.example.com/v1"
                        className="bg-background"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-label" className="text-sm">Label (opsional)</Label>
                    <Input
                      id="ai-label"
                      value={aiLabel}
                      onChange={(e) => setAiLabel(e.target.value)}
                      placeholder={`Contoh: ${currentProvider.label} - Main`}
                      className="bg-background"
                    />
                  </div>
                </>
              )}

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={aiSkip}
                  onChange={(e) => setAiSkip(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-muted-foreground">Lewati dulu, atur nanti di AI Providers</span>
              </label>
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={prevStep} className="gap-1">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button type="submit" disabled={!canProceed() || submitting} className="flex-1 gap-2">
                {submitting ? "Menyimpan..." : "Selesaikan Setup"}
                {!submitting && <CheckCircle2 className="w-4 h-4" />}
              </Button>
            </div>
          </form>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-6">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-green-500/20 p-5 rounded-full text-5xl leading-none select-none animate-bounce">
                🎉
              </div>
              <h2 className="text-2xl font-bold text-foreground">Setup Selesai!</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Sora sudah siap digunakan. Kamu bisa login sekarang dengan kredensial yang baru dibuat.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-left">
              <p className="text-xs font-medium text-foreground">Ringkasan setup:</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  Akun admin <code className="bg-muted px-1 rounded">{username}</code> dibuat
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {!discordSkip && discordToken ? (
                    <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Discord token dikonfigurasi</>
                  ) : (
                    <><span className="w-3.5 h-3.5 inline-block text-center leading-none text-yellow-500">⚠</span> Discord token belum diatur</>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {!aiSkip && aiKey ? (
                    <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> AI provider dikonfigurasi ({aiProvider})</>
                  ) : (
                    <><span className="w-3.5 h-3.5 inline-block text-center leading-none text-yellow-500">⚠</span> AI provider belum diatur</>
                  )}
                </div>
              </div>
            </div>

            <Button onClick={onComplete} className="w-full gap-2">
              Masuk ke Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
