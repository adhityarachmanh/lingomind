> **LEGACY (referensi)** — Aplikasi Dioxus LingoMind. Tidak dikembangkan aktif; dipakai sebagai sumber perilaku & pesan error untuk migrasi Next.js di root repo. Baca `AGENTS.md` di root untuk panduan repo aktif.

# LingoMind

Dioxus **0.7.1 fullstack** language-learning app: same Rust code compiles to WASM client and native server. Backend: Neon PostgreSQL (sqlx), Gemini AI, SMTP email, cron jobs. UI strings and code comments are in **Indonesian** — keep new UI text/error messages in Indonesian to match.

## Commands

- Dev with backend: `dx serve --features server` — the `server` cargo feature enables the fullstack server (DB, Gemini, SMTP). Without it you get only the WASM client and every server function fails at runtime.
- Desktop: `dx serve --platform desktop`
- Verify: `cargo check --features server` (server) / `cargo check --target wasm32-unknown-unknown` (client). No tests and no CI exist in this repo.
- One-off DB tools (require `.env` with `DATABASE_URL`): `cargo run --bin reset_db` (drops schema), `cargo run --bin update_admin_pwd`, `cargo run --bin migrate_hearts`, `cargo run --bin test_gemini`, `cargo run --bin scratch_db`, `cargo run --bin test_smtp`.

## Environment (`.env` at repo root, loaded via dotenvy on server)

- `DATABASE_URL` — Neon Postgres; app exits at startup if missing
- `GEMINI_API_KEY` — Google AI Studio key (all AI features)
- `SMTP_USERNAME` / `SMTP_PASSWORD` (Gmail app password), `APP_URL` (default `http://localhost:8080`)
- Model overrides: `GEMINI_MODEL_DEFAULT`, `GEMINI_MODEL_LITE`, and per-feature `GEMINI_MODEL_CHAT` / `_QUIZ` / `_LESSON` etc. (default lite: `gemini-2.5-flash-lite`)

## Architecture

- `src/main.rs` — server bootstrap before `dioxus::launch`: `db::init_db()` (connects pool + runs migrations) and `cron::start_cron_jobs()` (daily reminder emails)
- `src/routes.rs` — single `Route` enum. Legacy routes (`/lesson/:level/:goal`, `/quiz/:level/:goal`, `/chat/:level/:goal`, `/voice-chat/:level/:goal`, `/practice/:level/:goal`) are redirect stubs to the new level-less routes. Admin routes (`/admin/*`) are outside the Navbar layout.
- `src/components/app.rs` — root component: provides context signals (session, `selected_language`, `is_dark_mode`), restores session from localStorage after hydration
- `src/services/` — one file per domain; all backend logic lives in `#[server]` fns (Dioxus 0.7: `use dioxus::prelude::*`, return `Result<_, ServerFnError>`); `db.rs` owns the `PgPool` (via `get_pool()`)
- `src/services/gemini/` — Gemini API wrappers with retry + exponential backoff (`gemini_post_with_retry`)
- `src/views/` — one component per page; admin pages in `views/admin/`; `src/bin/` + `test_smtp.rs` are one-off tools
- `src/models/` — serde structs shared by client and server

## Dioxus 0.7 rules (repo was migrated; older tutorials are wrong)

- `cx`, `Scope`, `use_state` are gone — use `use_signal` / `use_memo` / `use_resource`, props by owned value (plus `ReadOnlySignal` for reactive props)
- Client and server are separate builds. Gate server-only code with `#[cfg(feature = "server")]` (services) or `#[cfg(not(target_arch = "wasm32"))]` (main.rs, db.rs, cron.rs)
- Browser APIs (`web_sys`, localStorage) only run after hydration: wrap in `use_effect` + `#[cfg(target_arch = "wasm32")]`; initial client render must match the server SSR render (use `use_server_future`, not `use_resource`, when first render needs data)
- `clippy.toml` flags holding dioxus signal read/write locks across `.await` — don't fix that lint by `.clone()`ing unrelated state

## Database

- Migrations are timestamped SQL files in `migrations/`, applied automatically at startup (`sqlx::migrate!("./migrations")`) — no manual step, but use a fresh timestamp prefix for new files
- `cached_quizzes` / `cached_lessons` store AI-generated content; `clear_ai_cache.sh` truncates them (prod env file: `/etc/lingomind/lingomind.env`; script falls back to local `.env`)

## Styling & client state

- Tailwind via root `tailwind.css` (auto-compiled by Dioxus). Dark mode = `.dark` class on `<html>`, persisted in localStorage `lingomind_theme`. `apply_dark_mode.py` is a one-off codemod that adds `dark:` variants to class strings.
- localStorage keys: `lingomind_user_session` (UserProfile JSON), `lingomind_theme`, legacy `lingomind_selected_language` (migrated in app.rs)

## Gotchas

- `test_smtp.rs` contains a hardcoded Gmail app password (secret) — don't copy or commit it
- `error.txt` is a stale build log; ignore
- Deploy: `ssh deploy@203.175.11.63` → `/home/deploy/deploy.sh`; logs at `/home/deploy/lingomind/deploy.log`
