"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { isValidEmail, isValidPassword } from "../validation";
import { setSessionCookie, clearSessionCookie } from "../auth";
import { sendMail } from "../mail";
import type { ActionResult } from "./types";

const APP_URL = () => process.env.APP_URL || "http://localhost:3000";

export async function registerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Nama lengkap, email, dan password wajib diisi." };
  }
  if (!isValidEmail(email)) return { error: "Format email tidak valid." };
  if (!isValidPassword(password)) return { error: "Password minimal 6 karakter." };

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await db.user.create({ data: { fullName, email, passwordHash } });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") return { error: "Email sudah digunakan." };
    throw e;
  }

  const token = crypto.randomUUID();
  await db.emailVerificationToken.create({ data: { email, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });

  const verifyLink = `${APP_URL()}/verify-email?token=${token}`;
  const subject = "Verifikasi Akun - LingoMind";
  const body = `Halo ${fullName},\n\nKlik untuk verifikasi: ${verifyLink}\n`;
  await sendMail(email, subject, body);

  return { message: "Pendaftaran berhasil! Cek email untuk verifikasi." };
}

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email dan password tidak boleh kosong." };
  if (!isValidEmail(email)) return { error: "Format email tidak valid." };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) return { error: "Email atau password salah." };

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return { error: "Email atau password salah." };

  if (!user.isVerified) return { error: "UNVERIFIED:Akun belum diverifikasi. Cek email Anda." };

  await setSessionCookie({ email: user.email, full_name: user.fullName ?? "", role: user.role ?? "user" });
  redirect("/chat");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
