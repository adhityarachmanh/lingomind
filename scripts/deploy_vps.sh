#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${1:-${SCRIPT_DIR}/deploy.local.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERROR] Config file not found: $ENV_FILE"
  echo "Copy template first:"
  echo "  cp ${SCRIPT_DIR}/deploy.local.env.example ${SCRIPT_DIR}/deploy.local.env"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

required_vars=(
  VPS_HOST
  VPS_USER
  SSH_KEY
  REMOTE_APP_DIR
  REMOTE_RELEASE_DIR
  SERVICE_NAME
  BRANCH
  BUILD_MODE
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "[ERROR] Missing value: $var_name"
    exit 1
  fi
done

case "$BUILD_MODE" in
  debug|release) ;;
  *)
    echo "[ERROR] BUILD_MODE must be 'debug' or 'release'. Current: $BUILD_MODE"
    exit 1
    ;;
esac

SSH_KEY_EXPANDED="${SSH_KEY/#\~/$HOME}"
if [[ ! -f "$SSH_KEY_EXPANDED" ]]; then
  echo "[ERROR] SSH key not found: $SSH_KEY_EXPANDED"
  exit 1
fi

SSH_TARGET="${VPS_USER}@${VPS_HOST}"
SSH_OPTS=(
  -i "$SSH_KEY_EXPANDED"
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new
)

echo "[1/5] Testing SSH connection to ${SSH_TARGET}"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "echo 'SSH OK: ' \$(hostname)"

echo "[2/5] Running remote deploy flow (branch=${BRANCH}, mode=${BUILD_MODE})"
ssh -tt "${SSH_OPTS[@]}" "$SSH_TARGET" 'bash -s' -- \
  "$REMOTE_APP_DIR" \
  "$BRANCH" \
  "$BUILD_MODE" \
  "$REMOTE_RELEASE_DIR" \
  "$SERVICE_NAME" \
  "${CARGO_BUILD_JOBS:-1}" <<'REMOTE_SCRIPT'
set -euo pipefail

APP_DIR="$1"
BRANCH="$2"
BUILD_MODE="$3"
RELEASE_DIR="$4"
SERVICE_NAME="$5"
CARGO_BUILD_JOBS="$6"

if [[ ! -d "$APP_DIR" ]]; then
  echo "[ERROR] Remote app dir not found: $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

if [[ -f "$HOME/.cargo/env" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi

if ! command -v dx >/dev/null 2>&1; then
  echo "[ERROR] dioxus-cli (dx) is not installed on remote host."
  exit 1
fi

echo "[remote] Fetch + checkout branch: $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

export CARGO_BUILD_JOBS

if [[ "$BUILD_MODE" == "release" ]]; then
  echo "[remote] Building release bundle"
  CARGO_PROFILE_RELEASE_DEBUG=0 RUSTFLAGS="-C debuginfo=0" dx bundle --web --release
  ARTIFACT_DIR="target/dx/lingomind/release/web"
else
  echo "[remote] Building debug bundle"
  dx bundle --web
  ARTIFACT_DIR="target/dx/lingomind/debug/web"
fi

if [[ ! -f "$ARTIFACT_DIR/server" ]]; then
  echo "[ERROR] server binary not found at $ARTIFACT_DIR/server"
  exit 1
fi

echo "[remote] Sync bundle to $RELEASE_DIR"
sudo mkdir -p "$RELEASE_DIR"
sudo rsync -a --delete "$ARTIFACT_DIR/" "$RELEASE_DIR/"
sudo chown -R "$(id -un)":"$(id -gn)" "$RELEASE_DIR"

echo "[remote] Restarting service: $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl --no-pager --full status "$SERVICE_NAME"

echo "[remote] Local health check"
curl -sS -I http://127.0.0.1:8080 | head -n 1
REMOTE_SCRIPT

echo "[3/5] Remote deploy finished"
echo "[4/5] Checking HTTPS endpoint"
curl -sS -I "https://${VPS_HOST}" | head -n 1 || true
echo "[5/5] Done"
