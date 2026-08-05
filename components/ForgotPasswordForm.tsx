"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { forgotPasswordAction } from "@/lib/actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, {});
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-6">
      <div className="bg-card p-8 rounded-2xl shadow-lg max-w-md w-full border border-border text-center">
        <div className="w-16 h-16 rounded-3xl mx-auto mb-4 bg-primary/10 flex items-center justify-center">
          <KeyRound className="h-8 w-8 text-primary" />
        </div>
        <p className="text-xl font-black">Lupa Password</p>
        <p className="text-xs text-muted-foreground mt-1">Masukkan email — kami kirim tautan reset</p>

        {state.error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs text-left font-semibold">{state.error}</div>
        )}
        {state.message && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary/30 rounded-lg text-primary text-xs text-left font-semibold">{state.message}</div>
        )}

        <form action={formAction} className="text-left mt-6 space-y-4">
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Email</Label>
            <Input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending} placeholder="email@lingomind.com" />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim Tautan Reset"}
          </Button>
        </form>
        <p className="mt-5 text-xs text-muted-foreground">
          Ingat password?{" "}
          <Link href="/login" className="text-primary hover:underline font-bold">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
