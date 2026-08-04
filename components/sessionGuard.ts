const SESSION_EXPIRED_PREFIX = "Sesi berakhir";

// Pesan error sesi dari server action (uniform di semua lib/actions/*).
export function isSessionExpired(message: string | null | undefined): boolean {
  return typeof message === "string" && message.startsWith(SESSION_EXPIRED_PREFIX);
}

// Redirect ke /login saat sesi kedaluwarsa — panggil di handler error server action.
export function redirectIfSessionExpired(message: string | null | undefined): boolean {
  if (isSessionExpired(message)) {
    window.location.assign("/login");
    return true;
  }
  return false;
}
