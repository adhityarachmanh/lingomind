param(
    [string]$ConfigPath = ".\scripts\deploy.local.env"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ConfigPath)) {
    Write-Error "Config file not found: $ConfigPath`nCopy template first: .\scripts\deploy.local.env.example -> .\scripts\deploy.local.env"
}

$envMap = @{}
Get-Content $ConfigPath | ForEach-Object {
    $line = $_.Trim()
    if (-not [string]::IsNullOrWhiteSpace($line) -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Count -eq 2) {
            $name = $parts[0].Trim()
            $value = $parts[1].Trim().Trim('"')
            $envMap[$name] = $value
        }
    }
}

$required = @(
    "VPS_HOST",
    "VPS_USER",
    "SSH_KEY",
    "REMOTE_APP_DIR",
    "REMOTE_RELEASE_DIR",
    "SERVICE_NAME",
    "BRANCH",
    "BUILD_MODE"
)

foreach ($name in $required) {
    if (-not $envMap.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($envMap[$name])) {
        throw "Missing value in config: $name"
    }
}

$vpsHost = $envMap["VPS_HOST"]
$vpsUser = $envMap["VPS_USER"]
$sshKey = $envMap["SSH_KEY"]
$appDir = $envMap["REMOTE_APP_DIR"]
$releaseDir = $envMap["REMOTE_RELEASE_DIR"]
$serviceName = $envMap["SERVICE_NAME"]
$branch = $envMap["BRANCH"]
$buildMode = $envMap["BUILD_MODE"]
$cargoBuildJobs = if ($envMap.ContainsKey("CARGO_BUILD_JOBS")) { $envMap["CARGO_BUILD_JOBS"] } else { "1" }

if ($buildMode -ne "debug" -and $buildMode -ne "release") {
    throw "BUILD_MODE must be debug or release. Current: $buildMode"
}

if ($sshKey.StartsWith("~")) {
    $sshKey = $sshKey -replace "^~", $HOME
}
$sshKey = $sshKey -replace '^\$HOME', $HOME
$sshKey = $sshKey -replace '^\$\{HOME\}', $HOME
$sshKey = $sshKey -replace '/', '\'

function Resolve-ExistingSshKeyPath {
    param([string]$ConfiguredPath)

    $candidates = @(
        $ConfiguredPath,
        "$ConfiguredPath.pem",
        (Join-Path $HOME ".ssh\lingomind_deploy"),
        (Join-Path $HOME ".ssh\id_ed25519"),
        (Join-Path $HOME ".ssh\id_rsa")
    ) | Select-Object -Unique

    foreach ($candidate in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path $candidate)) {
            return (Resolve-Path $candidate).Path
        }
    }

    return $null
}

$resolvedSshKey = Resolve-ExistingSshKeyPath -ConfiguredPath $sshKey
if (-not $resolvedSshKey) {
    $sshDir = Join-Path $HOME ".ssh"
    $available = @()
    if (Test-Path $sshDir) {
        $available = Get-ChildItem $sshDir -File | Where-Object { $_.Name -notlike "*.pub" } | Select-Object -ExpandProperty FullName
    }
    $availableText = if ($available.Count -gt 0) { $available -join ", " } else { "(tidak ada private key terdeteksi di ~/.ssh)" }
    throw "SSH key not found from config path: $sshKey. Available private keys: $availableText"
}
$sshKey = $resolvedSshKey

$sshTarget = "$vpsUser@$vpsHost"
Write-Host "[1/5] Testing SSH connection to $sshTarget"
ssh -i $sshKey -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new $sshTarget "echo SSH OK: \$(hostname)"

$remoteScript = @"
set -euo pipefail

APP_DIR='$appDir'
BRANCH='$branch'
BUILD_MODE='$buildMode'
RELEASE_DIR='$releaseDir'
SERVICE_NAME='$serviceName'
CARGO_BUILD_JOBS='$cargoBuildJobs'

if [[ ! -d "\$APP_DIR" ]]; then
  echo "[ERROR] Remote app dir not found: \$APP_DIR"
  exit 1
fi

cd "\$APP_DIR"

if [[ -f "\$HOME/.cargo/env" ]]; then
  source "\$HOME/.cargo/env"
fi

if ! command -v dx >/dev/null 2>&1; then
  echo "[ERROR] dioxus-cli (dx) is not installed on remote host."
  exit 1
fi

echo "[remote] Fetch + checkout branch: \$BRANCH"
git fetch origin "\$BRANCH"
git checkout "\$BRANCH"
git pull --ff-only origin "\$BRANCH"

export CARGO_BUILD_JOBS

if [[ "\$BUILD_MODE" == "release" ]]; then
  echo "[remote] Building release bundle"
  CARGO_PROFILE_RELEASE_DEBUG=0 RUSTFLAGS="-C debuginfo=0" dx bundle --web --release
  ARTIFACT_DIR="target/dx/lingomind/release/web"
else
  echo "[remote] Building debug bundle"
  dx bundle --web
  ARTIFACT_DIR="target/dx/lingomind/debug/web"
fi

if [[ ! -f "\$ARTIFACT_DIR/server" ]]; then
  echo "[ERROR] server binary not found at \$ARTIFACT_DIR/server"
  exit 1
fi

echo "[remote] Sync bundle to \$RELEASE_DIR"
sudo mkdir -p "\$RELEASE_DIR"
sudo rsync -a --delete "\$ARTIFACT_DIR/" "\$RELEASE_DIR/"
sudo chown -R "\$(id -un):\$(id -gn)" "\$RELEASE_DIR"

echo "[remote] Restarting service: \$SERVICE_NAME"
sudo systemctl restart "\$SERVICE_NAME"
sudo systemctl --no-pager --full status "\$SERVICE_NAME"

echo "[remote] Local health check"
curl -sS -I http://127.0.0.1:8080 | head -n 1
"@

Write-Host "[2/5] Running remote deploy flow (branch=$branch, mode=$buildMode)"
$remoteScript | ssh -tt -i $sshKey -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new $sshTarget "bash -s"

Write-Host "[3/5] Remote deploy finished"
Write-Host "[4/5] Checking HTTPS endpoint"
try {
    curl.exe -sS -I "https://$vpsHost" | Select-Object -First 1
} catch {
    Write-Host "HTTPS check skipped."
}

Write-Host "[5/5] Done"
