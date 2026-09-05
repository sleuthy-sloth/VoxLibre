# Foundation listening authoring and QA

Pack version 1.1.0 adds 16 local Kokoro recordings per language (32 total), plus the previously reused café recording in each pack. Every lesson now offers model playback and optional listening practice. Each pack has 112 exercises. Listening evidence and review are separate from recognition/production. Adding optional exercises does not revoke existing text-lesson completion; old event IDs remain valid.

Generation uses `services/voice/scripts/generate_lesson_audio.py`, loopback-only `/tts`, the cached `hexgrad/Kokoro-82M` model through Kokoro 0.9.4, `if_sara` for Italian and `ff_siwis` for French. Authoring manifests and provenance are committed under the existing directories. Runtime study fetches WAV files and never calls TTS. The authoring service was run on loopback port 8013 with Hugging Face offline mode enabled.

Reproduce a language export with:

```sh
services/voice/.venv/bin/python services/voice/scripts/generate_lesson_audio.py --manifest services/voice/scripts/italian-foundations.json --service-url http://127.0.0.1:8013 --output-dir public/audio/italian-foundations --provenance docs/audio-provenance/italian-foundations.json
```

Then regenerate pack media hashes from the exported provenance, run `npm run content:audio-check`, and reconcile provenance. Do not replace shipped bytes without changing their recorded hashes and reviewing the result.

`HF_HUB_OFFLINE=1 services/voice/.venv/bin/python scripts/qa-foundation-audio.py` checks every new clip for 24 kHz encoding, non-silent waveform, plausible duration and clipping; it also runs a cached local faster-whisper transcription pre-screen. All 32 waveforms passed. Final transcription matches: 26/32 exactly after punctuation/case normalization. Six remaining differences were reviewed as orthographic ambiguity or number notation:

- Italian `ho` was transcribed as homophonous `o` in three clips; the age clip also used `20` for `venti`.
- Italian `sette` was transcribed as `7`.
- French name `Marc` was transcribed as homophonous `marque`.
- French `trente` was transcribed as `30`.

Numeric answer variants are explicitly accepted in the relevant dictation exercises. These transcription differences are recorded in [the raw QA report](reports/foundation-audio-qa.json), not silently normalized away. Earlier unclear phrase transcriptions were addressed by selecting alternative taught examples and regenerating the recordings.

This is an automated pre-screen and author review of transcripts, not native-speaker listening/prosody approval. Human review of articulation, liaison, rhythm and beginner suitability remains open. No transcription output is treated as a pronunciation score. Listening remains optional if playback or hearing access is unavailable.
