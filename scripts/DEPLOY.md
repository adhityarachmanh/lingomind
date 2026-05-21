# Deploy Script (Local -> VPS)

Script ini menjalankan deploy dari laptop/PC lokal ke VPS:
1. SSH ke VPS.
2. `git pull` branch target di server.
3. Build bundle Dioxus (`debug` atau `release`).
4. Sinkron ke `/opt/lingomind/current`.
5. Restart service `lingomind`.

## 1) Isi credential

```bash
cp scripts/deploy.local.env.example scripts/deploy.local.env
```

Edit `scripts/deploy.local.env`:
- `VPS_HOST`
- `VPS_USER`
- `SSH_KEY`
- `REMOTE_APP_DIR`
- `REMOTE_RELEASE_DIR`
- `SERVICE_NAME`
- `BRANCH`
- `BUILD_MODE`

## 2) Jalankan deploy

Linux/macOS/WSL:

```bash
bash scripts/deploy_vps.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy_vps.ps1
```

## Catatan mode build

- `BUILD_MODE="debug"`: paling aman jika `wasm-opt` release masih error.
- `BUILD_MODE="release"`: lebih optimal, tapi bisa gagal kalau issue `wasm-opt` belum beres.
