import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

export interface SessionUser {
  email: string;
  full_name: string;
  role: string;
}

export const SESSION_COOKIE = "lingomind_session";
const THIRTY_DAYS = 30 * 24 * 60 * 60;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return new Uint8Array();
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${THIRTY_DAYS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  const secret = getSecret();
  if (secret.byteLength === 0) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.email || !payload.full_name || !payload.role) return null;
    return {
      email: payload.email as string,
      full_name: payload.full_name as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export async function requireAdmin(): Promise<{ email: string } | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({ where: { email: session.email } });
  if (!user || !isAdminRole(user.role)) return null;
  return { email: session.email };
}
