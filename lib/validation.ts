export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  const parts = trimmed.split("@");
  const local = parts[0] ?? "";
  const domain = parts[1] ?? "";
  return local.length >= 1 && domain.includes(".") && parts.length === 2 && domain.length >= 2;
}

export function isValidPassword(password: string): boolean {
  return password.trim().length >= 6;
}
