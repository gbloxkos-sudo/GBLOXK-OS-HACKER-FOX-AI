#!/usr/bin/env bash
#
# GBLOXK OS HACKER-FOX AI — third-party extension auto-download & installer
#
# Downloads third-party pentesting extensions from the Mozilla Add-ons store
# (AMO) and installs them into both extensions/ and profile/extensions/ so the
# bundled profile loads them on launch.
#
# Extensions with no AMO URL (marked MANUAL in thirdparty-manifest.json) are
# skipped with a warning; obtain their XPIs manually and place them in
# extensions/ and profile/extensions/.
#
# License: GNU AGPL-3.0 (see LICENSE)
#
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$APP_DIR/thirdparty-manifest.json"
EXT_DIR="$APP_DIR/extensions"
PROF_EXT_DIR="$APP_DIR/profile/extensions"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

command -v curl >/dev/null 2>&1 || { echo "[!] curl required"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "[!] python3 required"; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "[!] unzip required"; exit 1; }

mkdir -p "$EXT_DIR" "$PROF_EXT_DIR"

if [ ! -f "$MANIFEST" ]; then
  echo "[!] thirdparty-manifest.json not found at $MANIFEST"; exit 1
fi

python3 - "$MANIFEST" "$TMP_DIR" <<'PY'
import json, sys, os, subprocess, zipfile, tempfile, shutil

manifest_path, tmp_dir = sys.argv[1], sys.argv[2]
app_dir = os.path.dirname(manifest_path)
ext_dir = os.path.join(app_dir, "extensions")
prof_ext_dir = os.path.join(app_dir, "profile", "extensions")

data = json.load(open(manifest_path))
exts = data.get("extensions", [])

ok = fail = skip = 0

def install_xpi(src_path, dest_name):
    """Install a verified XPI to extensions/ and profile/extensions/."""
    shutil.copy2(src_path, os.path.join(ext_dir, dest_name))
    shutil.copy2(src_path, os.path.join(prof_ext_dir, dest_name))

for e in exts:
    eid = e.get("id")
    url = e.get("url")
    fname = e.get("file") or (eid + ".xpi" if eid else "unknown.xpi")
    # Destination filename keyed by extension id (Firefox requires id.xpi)
    dest = (eid + ".xpi") if eid else fname

    if not url:
        print(f"MANUAL  {fname}  (id={eid})  no AMO URL — download manually")
        skip += 1
        continue

    tmp_xpi = os.path.join(tmp_dir, dest + ".part")
    print(f"DOWNLOAD  {fname}  (id={eid}, v={e.get('version')})")
    print(f"    {url}")
    r = subprocess.run(["curl","-fsSL","--max-time","120","-o",tmp_xpi,url],
                       capture_output=True, text=True)
    if r.returncode != 0 or not os.path.getsize(tmp_xpi):
        print(f"    FAILED download (curl rc={r.returncode})")
        fail += 1
        continue

    # Verify it is a valid zip with a manifest.json
    try:
        with zipfile.ZipFile(tmp_xpi) as z:
            bad = z.testzip()
            if bad is not None:
                raise zipfile.BadZipFile(f"bad member {bad}")
            man = json.loads(z.read("manifest.json").decode())
    except Exception as ex:
        print(f"    FAILED invalid zip: {ex}")
        fail += 1
        continue

    # Verify the downloaded manifest id matches the recorded id
    dl_id = man.get("browser_specific_settings",{}).get("gecko",{}).get("id") \
        or man.get("applications",{}).get("gecko",{}).get("id")
    if eid and dl_id and dl_id != eid:
        print(f"    FAILED id mismatch: manifest={dl_id} expected={eid}")
        fail += 1
        continue

    install_xpi(tmp_xpi, dest)
    print(f"    OK installed as {dest} (manifest id={dl_id})")
    ok += 1

print(f"\n=== third-party install summary: {ok} installed, {fail} failed, {skip} manual ===")
sys.exit(1 if fail else 0)
PY
