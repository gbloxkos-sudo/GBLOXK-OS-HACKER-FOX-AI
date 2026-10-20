# GBLOXK OS HACKER-FOX AI

Firefox-based AI-powered penetration-testing browser bundle.

## What it is

A portable, Firefox-based browser ("GBLOXK OS HACKER-FOX AI") that ships a hardened profile with:

- **WebBrain AI agent extension** — Ollama-ready LLM assistant (default base URL `http://127.0.0.1:11434/v1`).
- **Ollama client + multimodal sidebar + usage monitor** — local AI features.
- **Web pentesting extensions** — FoxyProxy, HackBar, HackTools, OWASP PTK, CyberInject, Arcane Scout, SecExplorer, Wappalyzer, Web Developer, uBlock Origin, and more.
- **GBLOXK custom extensions** (built from source, audited):
  - **GBLOXK Crawler & Scraper** — site crawling with CSS selectors, regex, keywords, and Ollama-powered analysis.
  - **GBLOXK Secret Scanner** — on-demand leaked-secret/token/key scanning with AI risk assessment.
  - **GBLOXK SQL/XSS Finder** — SQLi/XSS point discovery with sqlmap command generation and AI analysis.

## Brand

**GBLOXK OS HACKER-FOX AI** — offensive-security AI browsing environment.

## License

This software is released under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
See the included `LICENSE` file for the full text.

## Requirements

- Firefox (or Firefox ESR) on PATH.
- Ollama (for AI features): https://ollama.com
- Suggested model: `ollama pull qwen2.5-coder:0.5b`

## Run

```bash
./launch.sh
```

The launcher:
1. Starts Ollama if it is not running and waits for its API (`http://127.0.0.1:11434`).
2. Pulls the default model (`qwen2.5-coder:0.5b`) if none is installed.
3. Launches Firefox with `--no-remote -profile profile` so the bundled, hardened profile is used even if another Firefox instance is already running.

## Ollama

Keep the WebBrain / extension base URL at `http://localhost:11434/v1` (Ollama binds `127.0.0.1:11434` by default).

## Third-party extensions (auto-download)

The ~290 MB of third-party pentesting XPIs (FoxyProxy, Wappalyzer, uBlock Origin, HackBar, Web Developer, etc.) are **not** bundled in the repo/zip to keep it lightweight. Install them automatically from the Mozilla Add-ons store:

```bash
./install-thirdparty.sh
```

This reads `thirdparty-manifest.json` (41 third-party extensions), downloads each from AMO, verifies the ZIP manifest id matches, and installs into both `extensions/` and `profile/extensions/`. Extensions without a public AMO URL are reported as `MANUAL` — obtain those XPIs yourself and place them in `extensions/` and `profile/extensions/`.

## Audited custom extensions

Source lives in `crawler-extension/`, `secret-scanner-extension/`, `sqlxss-extension/`.
Each is Manifest V3, lint-clean (Mozilla `web-ext lint`: 0 errors), and runtime-tested in Firefox with **zero JavaScript errors** from the extension code.

## Legal / ethical use

Use only on systems you own or are explicitly authorized to test. The maintainers accept no liability for misuse.
