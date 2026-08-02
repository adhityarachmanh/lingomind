"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
    return { error: "Nama lengkap, email wajib diisi dan password minimal 6 karakter." };
  }
  if (!isValidEmail(email)) {
    return { error: "Format email tidak valid." };
  }
  if (!isValidPassword(password)) {
    return { error: "Nama lengkap, email wajib diisi dan password minimal 6 karakter." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await db.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        preferredLanguage: "English",
        score: 0,
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { error: "Email sudah digunakan, silakan gunakan email lain." };
    }
    throw e;
  }

  const token = crypto.randomUUID();
  await db.emailVerificationToken.create({
    data: { email, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const verifyLink = `${APP_URL()}/verify-email?token=${token}`;
  const subject = "Verifikasi Akun - LingoMind";
  const body = `Halo ${fullName},\n\nTerima kasih telah mendaftar di LingoMind!\n\nSilakan klik link berikut untuk mengaktifkan akun Anda (berlaku 24 jam):\n${verifyLink}\n\nJika Anda tidak merasa mendaftar, abaikan email ini.\n\nSalam,\nLingoMind Team`;
  await sendMail(email, subject, body);

  return { message: "Pendaftaran berhasil! Tautan verifikasi telah dikirim ke email Anda. Silakan periksa folder Inbox atau Spam." };
}

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email dan password tidak boleh kosong!" };
  }
  if (!isValidEmail(email)) {
    return { error: "Format email tidak valid." };
  }

  const h = await headers();
  const xff = h.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0].trim() : h.get("x-real-ip") ?? "").trim() || "unknown";

  async function recordAttempt(success: boolean): Promise<void> {
    // Berlaku untuk semua login (user + admin) — admin login memakai loginAction yang sama.
    await db.loginAttempt.create({ data: { email, ip, success } }).catch(() => {});
    await db.loginAttempt
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => {});
  }

  const failedCount = await db.loginAttempt.count({
    where: { email, ip, success: false, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
  });
  if (failedCount >= 5) {
    return { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    await recordAttempt(false);
    return { error: "Email atau password salah." };
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    await recordAttempt(false);
    return { error: "Email atau password salah." };
  }

  if (!user.isVerified) {
    await recordAttempt(false);
    return { error: "UNVERIFIED:Akun Anda belum diverifikasi. Silakan cek email Anda." };
  }

  await recordAttempt(true);
  await setSessionCookie({
    email: user.email,
    full_name: user.fullName ?? "",
    role: user.role ?? "user",
  });
  return { message: "ok" };
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function resendVerificationAction(email: string): Promise<ActionResult> {
  const user = await db.user.findUnique({ where: { email: email.trim() } });
  if (!user) return { error: "Email tidak terdaftar." };
  if (user.isVerified) return { error: "Akun ini sudah diverifikasi." };

  await db.emailVerificationToken.deleteMany({ where: { email: user.email } });
  const token = crypto.randomUUID();
  await db.emailVerificationToken.create({
    data: { email: user.email, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const verifyLink = `${APP_URL()}/verify-email?token=${token}`;
  const subject = "Verifikasi Akun - LingoMind";
  const body = `Halo ${user.fullName},\n\nTerima kasih telah mendaftar di LingoMind!\n\nSilakan klik link berikut untuk mengaktifkan akun Anda (berlaku 24 jam):\n${verifyLink}\n\nJika Anda tidak merasa mendaftar, abaikan email ini.\n\nSalam,\nLingoMind Team`;
  await sendMail(user.email, subject, body);

  return { message: "Tautan verifikasi telah dikirim ulang ke email Anda." };
}
