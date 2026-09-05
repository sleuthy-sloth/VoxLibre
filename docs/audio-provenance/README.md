# Audio provenance

Every WAV under `public/audio/` is paired with a manifest under
`services/voice/scripts/` and a sidecar JSON under this directory. The
sidecars are produced by `services/voice/scripts/generate_lesson_audio.py`
and verified by `services/voice/scripts/reconcile_provenance.py`.

| manifest | provenance | language | voice | clip count |
| -------- | ---------- | -------- | ----- | ---------- |
| `services/voice/scripts/italian-foundations.json` | `italian-foundations.json` | it | `if_sara` | 16 |
| `services/voice/scripts/french-foundations.json` | `french-foundations.json` | fr | `ff_siwis` | 16 |
| `services/voice/scripts/french-ordering-pilot.json` | `french-ordering-pilot.json` | fr | `ff_siwis` | 2 |
| `services/voice/scripts/italian-patterns.json` | `italian-patterns.json` | it | `if_sara` | 10 |
| `services/voice/scripts/french-polish.json` | `french-polish.json` | fr | `ff_siwis` | 8 |
| `services/voice/scripts/spanish-patterns.json` | `spanish-patterns.json` | es | `ef_dora` | 16 |
| `services/voice/scripts/french-expansion.json` | `french-expansion.json` | fr | `ff_siwis` | 6 |
| `services/voice/scripts/italian-expansion.json` | `italian-expansion.json` | it | `if_sara` | 6 |
| `services/voice/scripts/portuguese-patterns.json` | `portuguese-patterns.json` | pt | `pf_dora` | 16 |

`reconcile_provenance.py` is the source of truth: it hashes every WAV on
disk and refuses to allow the JSON to drift. Run it after every change:

```bash
services/voice/.venv/bin/python services/voice/scripts/reconcile_provenance.py
```

Add a new entry to `PROVENANCE_SOURCES` in that script whenever you add
a new manifest + provenance pair. See `docs/content-authoring.md` for
the full authoring workflow.
