"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { resetPasswordAction } from "@/lib/actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, {});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-6">
      <div className="bg-card p-8 rounded-2xl shadow-lg max-w-md w-full border border-border text-center">
        <div className="w-16 h-16 rounded-3xl mx-auto mb-4 bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <p className="text-xl font-black">Reset Password</p>
        <p className="text-xs text-muted-foreground mt-1">Buat password baru Anda</p>

        {state.error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs text-left font-semibold">{state.error}</div>
        )}
        {state.message && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary/30 rounded-lg text-primary text-xs text-left font-semibold">{state.message}</div>
        )}

        <form action={formAction} className="text-left mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Password Baru</Label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
                placeholder="Minimal 6 karakter"
                className="pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShow((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 px-0 text-muted-foreground hover:text-primary"
                aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Konfirmasi Password</Label>
            <Input
              type={show ? "text" : "password"}
              name="confirm_password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={pending}
              placeholder="Ulangi password"
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Password Baru"}
          </Button>
        </form>
        <p className="mt-5 text-xs text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline font-bold">Kembali ke Login</Link>
        </p>
      </div>
    </div>
  );
}
