"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const errorMsg = (state.error ?? "").replace("UNVERIFIED:", "");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-6">
      <div className="bg-card p-8 rounded-2xl shadow-lg max-w-md w-full border border-border text-center">
        <img src="/logo.png" alt="LingoMind Logo" className="w-20 h-20 rounded-3xl mx-auto mb-4 shadow-md object-cover border border-border/60" />
        <p className="text-2xl font-black">LingoMind</p>
        <p className="text-xs text-muted-foreground mt-1">AI Language Tutor</p>
        {errorMsg && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs text-left font-semibold">{errorMsg}</div>
        )}
        <form action={formAction} className="text-left mt-6 space-y-4">
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Email</Label>
            <Input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending} placeholder="email@lingomind.com" />
          </div>
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Password</Label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
                placeholder="••••••••"
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
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk"}
          </Button>
        </form>
        <p className="mt-5 text-xs text-muted-foreground">
          Belum punya akun?{" "}
          <Link href="/register" className="text-primary hover:underline font-bold">Daftar Gratis</Link>
        </p>
        <p className="mt-2 text-xs">
          <Link href="/forgot-password" className="text-muted-foreground hover:text-primary hover:underline">Lupa password?</Link>
        </p>
      </div>
    </div>
  );
}
