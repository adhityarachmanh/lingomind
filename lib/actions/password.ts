"use server";

import bcrypt from "bcryptjs";
import { db } from "../db";
import { isValidEmail, isValidPassword } from "../validation";
import { sendMail } from "../mail";
import type { ActionResult } from "./types";

const APP_URL = () => process.env.APP_URL || "http://localhost:3000";

export async function forgotPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email wajib diisi." };
  if (!isValidEmail(email)) return { error: "Format email tidak valid." };

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { error: "Email tidak terdaftar." };

  await db.passwordResetToken.deleteMany({ where: { email } });
  const token = crypto.randomUUID();
  await db.passwordResetToken.create({
    data: { email, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const resetLink = `${APP_URL()}/reset-password?token=${token}`;
  const subject = "Reset Password - LingoMind";
  const body = `Halo ${user.fullName ?? ""},\n\nKlik link berikut untuk mereset password Anda (berlaku 1 jam):\n${resetLink}\n\nJika Anda tidak meminta reset, abaikan email ini.\n\nSalam,\nLingoMind Team`;
  await sendMail(email, subject, body);

  return { message: "Tautan reset password telah dikirim ke email Anda (berlaku 1 jam)." };
}

export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!token) return { error: "Token tidak ditemukan." };
  if (!isValidPassword(password)) return { error: "Password minimal 6 karakter." };
  if (password !== confirm) return { error: "Konfirmasi password tidak cocok dengan password utama!" };

  const record = await db.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) return { error: "Token tidak valid atau sudah kedaluwarsa." };

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.update({ where: { email: record.email }, data: { passwordHash } });
  await db.passwordResetToken.delete({ where: { id: record.id } });

  return { message: "Password berhasil diganti! Silakan login." };
}
