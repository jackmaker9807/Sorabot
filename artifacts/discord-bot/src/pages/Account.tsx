import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, UserCog, Save, ShieldCheck } from "lucide-react";
import { getToken, getStoredUsername } from "@/lib/auth";

export default function Account() {
  const { toast } = useToast();
  const currentUser = getStoredUsername() ?? "admin";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!currentPassword) {
      toast({ title: "Password lama wajib diisi", variant: "destructive" });
      return;
    }
    if (!newPassword) {
      toast({ title: "Password baru wajib diisi", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Password baru tidak cocok", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          newUsername: newUsername.trim() || undefined,
        }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };

      if (res.ok && data.ok) {
        toast({
          title: "Akun berhasil diperbarui",
          description: "Silakan login ulang dengan kredensial baru.",
        });
        setCurrentPassword("");
        setNewUsername("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({
          title: "Gagal memperbarui akun",
          description: data.error ?? "Terjadi kesalahan.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Tidak dapat terhubung ke server", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ubah Akun</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Perbarui username dan password akun dashboard.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Informasi Akun</CardTitle>
          </div>
          <CardDescription>
            Login saat ini sebagai <strong>{currentUser}</strong>. Masukkan password lama untuk mengonfirmasi perubahan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-sm text-muted-foreground">
              Password Lama <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Masukkan password lama..."
                className="pr-10 bg-background border-border"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-username" className="text-sm text-muted-foreground">
              Username Baru <span className="text-xs text-muted-foreground">(kosongkan jika tidak ingin diubah)</span>
            </Label>
            <Input
              id="new-username"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder={currentUser}
              className="bg-background border-border"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm text-muted-foreground">
              Password Baru <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter..."
                className="pr-10 bg-background border-border"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">
              Konfirmasi Password Baru <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru..."
                className="pr-10 bg-background border-border"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && newPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-500">Password tidak cocok</p>
            )}
          </div>

          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2 text-xs text-amber-600">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Setelah mengubah password, kamu perlu login ulang dengan kredensial baru.
          </div>

          <Button onClick={handleSave} disabled={loading} className="gap-2 w-full sm:w-auto">
            <Save className="w-4 h-4" />
            {loading ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
