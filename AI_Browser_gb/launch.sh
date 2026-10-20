#!/usr/bin/env bash
#
# GBLOXK OS HACKER-FOX AI
# Copyright (C) 2026  GBLOXK
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="$APP_DIR/profile"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5-coder:0.5b}"
OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"
OLLAMA_BASE="http://$OLLAMA_HOST"

echo "[*] GBLOXK OS HACKER-FOX AI launcher"
echo "[*] App directory: $APP_DIR"
echo "[*] Profile: $PROFILE"

# Verify profile exists
if [ ! -d "$PROFILE" ]; then
  echo "[!] ERROR: Profile directory not found: $PROFILE"
  exit 1
fi

# Do not launch if another instance already holds this profile locked.
if [ -e "$PROFILE/.parentlock" ] || [ -e "$PROFILE/lock" ]; then
  echo "[!] ERROR: Profile is locked (another Firefox instance may be using it): $PROFILE"
  echo "[!] Close other Firefox instances, then re-run."
  exit 1
fi

# Start Ollama if available and not running
if command -v ollama >/dev/null 2>&1; then
  if ! pgrep -x ollama >/dev/null 2>&1; then
    echo "[*] Starting Ollama..."
    nohup ollama serve >/tmp/ollama-webai.log 2>&1 &
    sleep 2
  fi

  # Wait for Ollama API to be ready
  if command -v curl >/dev/null 2>&1; then
    echo "[*] Waiting for Ollama API at $OLLAMA_BASE ..."
    for i in $(seq 1 30); do
      if curl -sf "$OLLAMA_BASE/api/tags" >/dev/null 2>&1; then
        break
      fi
      if [ "$i" -eq 30 ]; then
        echo "[!] WARNING: Ollama API not ready. AI features may fail until Ollama responds."
        break
      fi
      sleep 1
    done
  fi

  # Ensure at least one model is available (skip header line)
  if ! ollama list 2>/dev/null | tail -n +2 | grep -q .; then
    echo "[*] Pulling default model $OLLAMA_MODEL..."
    ollama pull "$OLLAMA_MODEL" >/dev/null 2>&1 || true
  fi
else
  echo "[!] WARNING: ollama binary not found. AI features will be unavailable."
  echo "[!] Install Ollama from https://ollama.com for full functionality."
fi

# Verify Firefox is available
if ! command -v firefox >/dev/null 2>&1 && ! command -v firefox-esr >/dev/null 2>&1; then
  echo "[!] ERROR: Firefox not found in PATH."
  exit 1
fi

FIREFOX_BIN="$(command -v firefox 2>/dev/null || command -v firefox-esr 2>/dev/null)"

# -no-remote guarantees the bundled profile is used even when another Firefox instance
# is already running (without it the -profile flag is silently ignored).
echo "[*] Launching GBLOXK OS HACKER-FOX AI with profile: $PROFILE"
exec "$FIREFOX_BIN" --no-remote -profile "$PROFILE" "$@"
