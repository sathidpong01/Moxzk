#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Moxzk Codex cloud setup"
echo "node: $(node --version)"
echo "npm:  $(npm --version)"

# Persist only non-secret defaults into the agent phase. Values configured in
# the Codex environment settings still win over these fallbacks.
moxzk_codex_env="$HOME/.moxzk-codex-cloud-env"
cat > "$moxzk_codex_env" <<'BASHRC'
export CI="${CI:-1}"
export VITE_CLOUDFLARE_API_URL="${VITE_CLOUDFLARE_API_URL:-https://moxzk-api.sathidpong01.workers.dev}"
export VITE_PANELCLEANER_BRIDGE_URL="${VITE_PANELCLEANER_BRIDGE_URL:-http://localhost:5055}"
export VITE_TRANSLATOR_API_URL="${VITE_TRANSLATOR_API_URL:-http://localhost:5003}"
export VITE_OLLAMA_URL="${VITE_OLLAMA_URL:-http://localhost:11434}"
export VITE_OLLAMA_MODEL="${VITE_OLLAMA_MODEL:-gemma4}"
BASHRC
if ! grep -q 'moxzk-codex-cloud-env' "$HOME/.bashrc" 2>/dev/null; then
  echo 'source "$HOME/.moxzk-codex-cloud-env"' >> "$HOME/.bashrc"
fi

if [[ "${CODEX_CLOUD_SKIP_INSTALL:-0}" == "1" ]]; then
  echo "Skipping npm install because CODEX_CLOUD_SKIP_INSTALL=1"
else
  npm ci --include=dev --legacy-peer-deps
fi

if [[ "${CODEX_CLOUD_VERIFY_SETUP:-0}" == "1" ]]; then
  npm run build
  npm test
fi

echo "Codex cloud setup complete"
