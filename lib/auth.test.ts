import { describe, expect, it } from "vitest";
import { createSessionToken, isAdminRole, verifySessionToken } from "./auth";

process.env.AUTH_SECRET = "test-secret-0123456789abcdef";

const user = { email: "a@b.com", full_name: "Test User", role: "user" };

describe("session token", () => {
  it("round-trip menghasilkan payload sama", async () => {
    const token = await createSessionToken(user);
    const decoded = await verifySessionToken(token);
    expect(decoded).toEqual(user);
  });
  it("menolak token yang diubah", async () => {
    const token = await createSessionToken(user);
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifySessionToken(tampered)).toBeNull();
  });
  it("menolak sampah", async () => {
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });
});

describe("isAdminRole", () => {
  it("admin → true", () => {
    expect(isAdminRole("admin")).toBe(true);
  });
  it("user → false", () => {
    expect(isAdminRole("user")).toBe(false);
  });
  it("null/undefined → false", () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
  it("string lain → false", () => {
    expect(isAdminRole("moderator")).toBe(false);
  });
});
