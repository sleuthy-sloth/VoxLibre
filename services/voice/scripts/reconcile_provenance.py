"""Reconcile docs/audio-provenance/*.json with on-disk WAVs.

Each provenance file is keyed by its filename suffix. For every WAV under
public/audio/{lang}/, this script verifies or rebuilds the corresponding
provenance entry from the manifest used to generate it.

Run from repo root:  python3 services/voice/scripts/reconcile_provenance.py
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PROV_DIR = ROOT / "docs" / "audio-provenance"
AUDIO_DIR = ROOT / "public" / "audio"

SCHEMA_VERSION = 1
MODEL = "kokoro@0.9.4"
EXPORTED_AT = "2026-09-03"

# Each provenance file is tied to a manifest and a destination language dir.
PROVENANCE_SOURCES = [
    {"path": PROV_DIR / "italian-foundations.json", "manifest": ROOT / "services/voice/scripts/italian-foundations.json", "audio_subdir": "italian-foundations", "exported_at": "2026-09-05"},
    {"path": PROV_DIR / "french-foundations.json", "manifest": ROOT / "services/voice/scripts/french-foundations.json", "audio_subdir": "french-foundations", "exported_at": "2026-09-05"},
    {
        "path": PROV_DIR / "french-ordering-pilot.json",
        "manifest": ROOT / "services/voice/scripts/french-ordering-pilot.json",
        "audio_subdir": "french-ordering",
    },
    {
        "path": PROV_DIR / "italian-patterns.json",
        "manifest": ROOT / "services/voice/scripts/italian-patterns.json",
        "audio_subdir": "italian",
    },
    {
        "path": PROV_DIR / "french-polish.json",
        "manifest": ROOT / "services/voice/scripts/french-polish.json",
        "audio_subdir": "french",
    },
    {
        "path": PROV_DIR / "spanish-patterns.json",
        "manifest": ROOT / "services/voice/scripts/spanish-patterns.json",
        "audio_subdir": "spanish",
    },
    {
        "path": PROV_DIR / "french-expansion.json",
        "manifest": ROOT / "services/voice/scripts/french-expansion.json",
        "audio_subdir": "french",
    },
    {
        "path": PROV_DIR / "italian-expansion.json",
        "manifest": ROOT / "services/voice/scripts/italian-expansion.json",
        "audio_subdir": "italian",
    },
    {
        "path": PROV_DIR / "portuguese-patterns.json",
        "manifest": ROOT / "services/voice/scripts/portuguese-patterns.json",
        "audio_subdir": "portuguese",
    },
]


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def load_manifest(path: Path) -> list[dict[str, str]]:
    return json.loads(path.read_text(encoding="utf-8"))["clips"]


def build_provenance(source: dict[str, object]) -> dict[str, object]:
    manifest_clips: list[dict[str, str]] = load_manifest(source["manifest"])  # type: ignore[arg-type]
    by_id: dict[str, dict[str, str]] = {c["id"]: c for c in manifest_clips}
    fixed_dir: str | None = source["audio_subdir"]  # type: ignore[assignment]
    manifest_path: Path = source["manifest"]  # type: ignore[assignment]

    entries: list[dict[str, object]] = []
    for clip in manifest_clips:
        clip_id: str = clip["id"]
        filename: str = clip["filename"]
        clip_lang: str = clip["language"]
        subdir = fixed_dir or clip_lang
        wav_path = AUDIO_DIR / subdir / filename
        if not wav_path.exists():
            raise SystemExit(f"missing WAV on disk: {wav_path}")
        data = wav_path.read_bytes()
        text = by_id[clip_id]["text"]
        entries.append(
            {
                "id": clip_id,
                "filename": filename,
                "language": clip_lang,
                "voice": clip["voice"],
                "text_sha256": sha256_text(text),
                "audio_sha256": sha256_bytes(data),
                "content_type": "audio/wav",
                "bytes": len(data),
            }
        )

    if not entries:
        raise SystemExit(f"no clips reconciled for {source['path']}")

    try:
        manifest_rel = str(manifest_path.relative_to(ROOT))
    except ValueError:
        manifest_rel = str(manifest_path)

    return {
        "schema_version": SCHEMA_VERSION,
        "exported_at": source.get("exported_at", EXPORTED_AT),
        "model": MODEL,
        "manifest": manifest_rel,
        "languages": sorted({e["language"] for e in entries}),
        "voices": sorted({f"{e['language']}:{e['voice']}" for e in entries}),
        "clips": entries,
    }


def main() -> int:
    failures = 0
    for source in PROVENANCE_SOURCES:
        path: Path = source["path"]  # type: ignore[assignment]
        if not path.exists():
            print(f"skip (no file): {path.name}")
            continue
        try:
            prov = build_provenance(source)
        except SystemExit as exc:
            print(f"FAIL {path.name}: {exc}", file=sys.stderr)
            failures += 1
            continue
        existing = json.loads(path.read_text(encoding="utf-8"))
        if existing.get("clips") == prov["clips"]:
            print(f"ok   {path.name} ({len(prov['clips'])} clips verified)")
        else:
            path.write_text(json.dumps(prov, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(f"fix  {path.name} ({len(prov['clips'])} clips reconciled from disk)")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
