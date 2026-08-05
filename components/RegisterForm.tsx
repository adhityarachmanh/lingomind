"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { registerAction, resendVerificationAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, {});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  async function resend() {
    setResendMsg(null);
    const res = await resendVerificationAction(email);
    setResendMsg(res.error ?? res.message ?? null);
  }

  const successMsg = state.message ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-6">
      <div className="bg-card p-8 rounded-2xl shadow-lg max-w-md w-full border border-border text-center">
        <img src="/logo.png" alt="LingoMind Logo" className="w-20 h-20 rounded-3xl mx-auto mb-4 shadow-md object-cover border border-border/60" />
        <p className="text-2xl font-black">Buat Akun Baru</p>
        <p className="text-xs text-muted-foreground mt-1">Mulai belajar bahasa dengan AI</p>

        {state.error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs text-left font-semibold">{state.error}</div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary/30 rounded-lg text-primary text-xs text-left font-semibold">
            {successMsg}
            <button type="button" onClick={resend} className="ml-2 underline font-bold">Kirim Ulang</button>
            {resendMsg && <p className="mt-1 text-[11px]">{resendMsg}</p>}
          </div>
        )}

        <form action={formAction} className="text-left mt-6 space-y-4">
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Nama Lengkap</Label>
            <Input name="full_name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} placeholder="John Doe" />
          </div>
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Email</Label>
            <Input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending} placeholder="email@lingomind.com" />
          </div>
          <div className="relative">
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Password</Label>
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
              className="absolute top-8 right-0 h-9 w-9 px-0 text-muted-foreground hover:text-primary"
              aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Daftar Gratis"}
          </Button>
        </form>
        <p className="mt-5 text-xs text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-primary hover:underline font-bold">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
