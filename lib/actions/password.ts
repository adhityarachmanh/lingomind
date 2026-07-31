"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { isValidEmail, isValidPassword } from "../validation";
import { sendMail } from "../mail";
import type { ActionResult } from "./types";

const APP_URL = () => process.env.APP_URL || "http://localhost:3000";

export async function verifyEmailAction(token: string): Promise<ActionResult> {
  const record = await db.emailVerificationToken.findFirst({
    where: { token, expiresAt: { gt: new Date() } },
  });
  if (!record) return { error: "Token verifikasi tidak valid atau sudah kedaluwarsa." };

  try {
    await db.user.update({ where: { email: record.email }, data: { isVerified: true } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { error: "Token verifikasi tidak valid atau sudah kedaluwarsa." };
    }
    throw err;
  }
  await db.emailVerificationToken.deleteMany({ where: { email: record.email } });

  return { message: "Akun Anda berhasil diverifikasi! Silakan login." };
}

export async function forgotPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email dan password tidak boleh kosong!" };
  if (!isValidEmail(email)) return { error: "Format email tidak valid." };

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { error: "Email tidak terdaftar di sistem kami." };

  await db.passwordReset.deleteMany({ where: { email } });
  const token = crypto.randomUUID();
  await db.passwordReset.create({
    data: { email, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const resetLink = `${APP_URL()}/reset-password?token=${token}`;
  const subject = "Reset Password - LingoMind";
  const body = `Halo,\n\nKami menerima permintaan untuk mereset password akun LingoMind Anda.\n\nSilakan klik link berikut untuk mereset password Anda (berlaku selama 1 jam):\n${resetLink}\n\nJika Anda tidak merasa mengajukan ini, abaikan email ini.\n\nSalam,\nLingoMind Team`;
  await sendMail(email, subject, body);

  return { message: "Instruksi reset password telah dikirim. Periksa email Anda (atau server console untuk testing)." };
}

export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!isValidPassword(password)) {
    return { error: "Password baru minimal harus berukuran 6 karakter." };
  }

  const record = await db.passwordReset.findFirst({
    where: { token, expiresAt: { gt: new Date() } },
  });
  if (!record) return { error: "Token reset tidak valid atau sudah kedaluwarsa." };

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.update({ where: { email: record.email }, data: { passwordHash } });
  await db.passwordReset.deleteMany({ where: { email: record.email } });

  return { message: "Password Anda berhasil direset! Silakan login dengan password baru Anda." };
}
