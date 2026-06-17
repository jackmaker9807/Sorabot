import { useState, useEffect } from "react";
import { useGetBotSettings, useUpdateBotSettings, getGetBotSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Brain, MessageSquare, Sparkles, Save, ImagePlay, Sticker, Clock, CheckCircle2, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";

const PERSONALITY_PRESETS = [
  {
    id: "ramah",
    label: "Ramah & Santai",
    emoji: "🌸",
    description: "Friendly, hangat, cocok untuk semua umur",
    text: "Namamu adalah Sora, asisten Discord perempuan yang ramah dan helpful. Balas pesan dengan natural, singkat, dan santai seperti teman sungguhan. Gunakan bahasa yang sama dengan pengguna (Indonesia atau Inggris). Jangan terlalu formal. Sesekali pakai emoji yang sesuai.",
  },
  {
    id: "profesional",
    label: "Profesional",
    emoji: "💼",
    description: "Formal, terstruktur, cocok untuk server bisnis",
    text: "Namamu adalah Sora, asisten profesional perempuan di server Discord ini. Berikan jawaban yang akurat, terstruktur, dan sopan. Gunakan bahasa formal Indonesia. Hindari singkatan tidak baku. Fokus pada informasi yang relevan dan berguna.",
  },
  {
    id: "kocak",
    label: "Kocak & Lucu",
    emoji: "😄",
    description: "Humoris, penuh meme, cocok untuk komunitas santai",
    text: "Namamu adalah Sora, cewek bot Discord yang super kocak dan suka bercanda. Balas dengan humor, sedikit lebay, dan sesekali pakai meme atau emoji. Tetap helpful tapi selalu bikin orang senyum. Pakai bahasa gaul Indonesia yang santai banget.",
  },
  {
    id: "gamer",
    label: "Gamer Girl",
    emoji: "🎮",
    description: "Cewek gamer, penuh istilah gaming",
    text: "Namamu adalah Sora, cewek gamer Discord yang seru dan kompetitif. Balas pesan dengan gaya gamer: pakai istilah gaming, singkatan populer (GG, AFK, OP, noob, carry), dan referensi game. Energik, semangat, dan kadang sedikit flexing. Bahasa Indonesia gaul.",
  },
  {
    id: "tsundere",
    label: "Tsundere",
    emoji: "😤",
    description: "Tsundere klasik, pura-pura galak tapi peduli",
    text: "Namamu adalah Sora, cewek tsundere di server Discord ini. Pura-pura tidak peduli dan sedikit galak di awal, tapi sebenarnya sangat mau membantu. Gunakan ekspresi khas: 'B-bukan karena aku peduli ya!', 'Hmph! Makanya dengarkan aku...', 'J-jangan salah paham!'. Tetap berikan jawaban yang berguna. Bahasa Indonesia santai.",
  },
  {
    id: "motivator",
    label: "Motivator",
    emoji: "🔥",
    description: "Penuh semangat dan motivasi, life coach perempuan",
    text: "Namamu adalah Sora, perempuan motivator yang selalu positif dan penuh energi! Setiap balasan mengandung semangat, dorongan, dan kata-kata motivasi yang membara. Pakai tanda seru, emoji 🔥⭐💪. Buat semua orang merasa mereka bisa menaklukkan dunia! Bahasa Indonesia yang super antusias.",
  },
  {
    id: "wise",
    label: "Bijaksana",
    emoji: "🧘",
    description: "Tenang, dalam, seperti kakak perempuan bijak",
    text: "Namamu adalah Sora, perempuan yang bijaksana dan tenang bagaikan kakak yang selalu ada. Berikan jawaban yang mendalam, thoughtful, dan penuh empati. Sesekali gunakan pepatah atau analogi yang menyentuh hati. Tenang dan tidak terburu-buru. Bahasa Indonesia yang lembut dan penuh makna.",
  },
  {
    id: "custom",
    label: "Kustom",
    emoji: "✏️",
    description: "Tulis kepribadian sendiri sesuai kebutuhan",
    text: "",
  },
];

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settings = useGetBotSettings();
  const updateSettings = useUpdateBotSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotSettingsQueryKey() });
        toast({ title: "Pengaturan disimpan", description: "Konfigurasi berhasil diperbarui." });
      },
      onError: () => {
        toast({ title: "Gagal menyimpan", description: "Terjadi kesalahan saat menyimpan pengaturan.", variant: "destructive" });
      },
    },
  });

  const [personality, setPersonality] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [respondToAll, setRespondToAll] = useState(false);
  const [mentionOnly, setMentionOnly] = useState(false);
  const [gifEnabled, setGifEnabled] = useState(false);
  const [gifCooldownSeconds, setGifCooldownSeconds] = useState(60);
  const [stickerEnabled, setStickerEnabled] = useState(false);

  useEffect(() => {
    if (settings.data) {
      const p = settings.data.personality;
      setPersonality(p);
      setAiEnabled(settings.data.aiEnabled);
      setRespondToAll(settings.data.respondToAll);
      setMentionOnly(settings.data.mentionOnly);
      setGifEnabled(settings.data.gifEnabled);
      setGifCooldownSeconds(settings.data.gifCooldownSeconds);
      setStickerEnabled(settings.data.stickerEnabled);

      const match = PERSONALITY_PRESETS.find((pr) => pr.text && pr.text === p);
      setSelectedPreset(match ? match.id : "custom");
    }
  }, [settings.data]);

  function handlePresetSelect(preset: typeof PERSONALITY_PRESETS[0]) {
    setSelectedPreset(preset.id);
    if (preset.id !== "custom") {
      setPersonality(preset.text);
    }
  }

  function handleSave() {
    updateSettings.mutate({
      data: { personality, aiEnabled, respondToAll, mentionOnly, gifEnabled, gifCooldownSeconds, stickerEnabled },
    });
  }

  function formatCooldown(secs: number) {
    if (secs < 60) return `${secs} detik`;
    if (secs < 3600) return `${Math.round(secs / 60)} menit`;
    return `${Math.round(secs / 3600)} jam`;
  }

  if (settings.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pengaturan Bot</h1>
        <p className="text-muted-foreground text-sm mt-1">Konfigurasi kepribadian, AI, GIF, dan stiker bot.</p>
      </div>

      {/* Personality Presets */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Kepribadian Bot</CardTitle>
          </div>
          <CardDescription>Pilih preset kepribadian atau tulis sendiri.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PERSONALITY_PRESETS.map((preset) => {
              const isSelected = selectedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                  className={cn(
                    "relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:bg-muted/50",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background"
                  )}
                >
                  {isSelected && (
                    <CheckCircle2 className="absolute top-2 right-2 w-3.5 h-3.5 text-primary" />
                  )}
                  <span className="text-xl leading-none">{preset.emoji}</span>
                  <span className={cn("text-xs font-semibold leading-tight", isSelected ? "text-primary" : "text-foreground")}>
                    {preset.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{preset.description}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">
                {selectedPreset === "custom" ? "Tulis Kepribadian" : "Preview Teks"}
              </Label>
              <span className="text-xs text-muted-foreground">{personality.length} karakter</span>
            </div>
            <Textarea
              value={personality}
              onChange={(e) => {
                setPersonality(e.target.value);
                setSelectedPreset("custom");
              }}
              placeholder="Tulis instruksi kepribadian bot di sini..."
              className="min-h-[120px] resize-none text-sm font-mono bg-background border-border"
            />
            {selectedPreset !== "custom" && (
              <p className="text-xs text-muted-foreground">
                💡 Edit teks di atas untuk menyesuaikan preset <strong>{PERSONALITY_PRESETS.find(p => p.id === selectedPreset)?.label}</strong>.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Mode */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Mode AI</CardTitle>
          </div>
          <CardDescription>Aktifkan AI untuk balasan yang lebih natural dan kontekstual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="ai-enabled" className="text-sm font-medium text-foreground">Aktifkan AI</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Bot menggunakan AI untuk membalas pesan secara natural</p>
            </div>
            <Switch id="ai-enabled" checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border">
            <div>
              <Label htmlFor="respond-all" className="text-sm font-medium text-foreground">Balas Semua Pesan</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aktif: bot membalas semua pesan. Nonaktif: hanya pesan yang cocok rules.
              </p>
            </div>
            <Switch id="respond-all" checked={respondToAll} onCheckedChange={setRespondToAll} />
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border">
            <div>
              <Label htmlFor="mention-only" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-primary" />
                Hanya Balas Saat Di-mention
                {mentionOnly && <Badge variant="secondary" className="text-xs">Aktif</Badge>}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bot hanya merespons jika pesan menyebut <code className="bg-muted px-1 rounded text-[10px]">@Sora</code> secara langsung
              </p>
            </div>
            <Switch id="mention-only" checked={mentionOnly} onCheckedChange={setMentionOnly} />
          </div>
          {mentionOnly && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 leading-relaxed">
              💡 Dalam mode ini, bot mengabaikan semua pesan biasa dan hanya aktif ketika ada yang menyebut <strong>@Sora</strong>. Teks mention otomatis dibersihkan sebelum dikirim ke AI.
            </p>
          )}
        </CardContent>
      </Card>

      {/* GIF Settings */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ImagePlay className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">GIF Otomatis</CardTitle>
          </div>
          <CardDescription>Bot menyertakan GIF relevan dari Tenor saat membalas pesan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="gif-enabled" className="text-sm font-medium text-foreground">
                Aktifkan GIF
                {gifEnabled && <Badge variant="secondary" className="ml-2 text-xs">Aktif</Badge>}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Bot menyertakan GIF relevan dari Tenor dalam setiap balasan</p>
            </div>
            <Switch id="gif-enabled" checked={gifEnabled} onCheckedChange={setGifEnabled} />
          </div>
          {gifEnabled && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium text-foreground">Cooldown Anti-Spam</Label>
                </div>
                <span className="text-sm font-semibold text-primary tabular-nums">{formatCooldown(gifCooldownSeconds)}</span>
              </div>
              <Slider
                min={10}
                max={3600}
                step={10}
                value={[gifCooldownSeconds]}
                onValueChange={([val]) => setGifCooldownSeconds(val ?? gifCooldownSeconds)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10 dtk</span>
                <span>1 jam</span>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 leading-relaxed">
                💡 Bot menunggu <strong>{formatCooldown(gifCooldownSeconds)}</strong> sebelum kirim GIF lagi di channel yang sama.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticker Settings */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Sticker className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Stiker Discord</CardTitle>
          </div>
          <CardDescription>Bot menyertakan stiker acak dari server Discord saat membalas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="sticker-enabled" className="text-sm font-medium text-foreground">
                Aktifkan Stiker
                {stickerEnabled && <Badge variant="secondary" className="ml-2 text-xs">Aktif</Badge>}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Bot memilih stiker acak dari koleksi stiker server</p>
            </div>
            <Switch id="sticker-enabled" checked={stickerEnabled} onCheckedChange={setStickerEnabled} />
          </div>
          {stickerEnabled && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 leading-relaxed">
              🎨 Stiker diambil dari server Discord tempat bot berada. Jika server tidak memiliki stiker kustom, bot tetap balas tanpa stiker.
            </p>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Cara Kerja</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Pesan masuk dicek dengan semua rules aktif</li>
            <li>Jika ada rule cocok, response-nya jadi panduan untuk AI</li>
            <li>AI membalas dengan gaya kepribadian yang dipilih</li>
            {gifEnabled && <li>Bot mencari GIF relevan dari Tenor (cooldown: {formatCooldown(gifCooldownSeconds)} per channel)</li>}
            {stickerEnabled && <li>Bot memilih stiker acak dari koleksi server Discord</li>}
            <li>Setiap balasan disimpan ke Message Logs</li>
          </ol>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full sm:w-auto">
        <Save className="w-4 h-4 mr-2" />
        {updateSettings.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
      </Button>
    </div>
  );
}
