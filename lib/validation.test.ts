import { describe, expect, it } from "vitest";
import { isValidEmail, isValidPassword } from "./validation";

describe("isValidEmail", () => {
  it("menerima email normal", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });
  it("menolak tanpa @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });
  it("menolak tanpa dot di domain", () => {
    expect(isValidEmail("user@example")).toBe(false);
  });
  it("menolak double @", () => {
    expect(isValidEmail("a@b@c.com")).toBe(false);
  });
  it("menolak kosong", () => {
    expect(isValidEmail("")).toBe(false);
  });
  it("trim whitespace", () => {
    expect(isValidEmail(" user@example.com ")).toBe(true);
  });
});

describe("isValidPassword", () => {
  it("menerima 6 karakter", () => {
    expect(isValidPassword("abcdef")).toBe(true);
  });
  it("menolak kurang dari 6", () => {
    expect(isValidPassword("abcde")).toBe(false);
  });
});
