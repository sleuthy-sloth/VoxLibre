"""Authoring-only WAV/transcription pre-screen; never a pronunciation score."""
import json
import wave
import unicodedata
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

model = WhisperModel('small', device='cpu', compute_type='int8', local_files_only=True)
def normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFC', text.lower()) if c.isalnum())
report = []
for language in ['italian', 'french']:
    manifest = json.loads(Path(f'services/voice/scripts/{language}-foundations.json').read_text())
    for clip in manifest['clips']:
        path = Path('public/audio') / f'{language}-foundations' / clip['filename']
        with wave.open(str(path)) as wav:
            rate, frames = wav.getframerate(), wav.getnframes()
            samples = np.frombuffer(wav.readframes(frames), dtype=np.int16).astype(float) / 32768
        assert rate == 24000 and frames > rate * .3, f'Invalid duration/rate: {path}'
        assert np.sqrt(np.mean(samples ** 2)) > .005, f'Silent clip: {path}'
        assert np.mean(abs(samples) > .999) < .001, f'Clipping: {path}'
        segments, _ = model.transcribe(str(path), language=clip['language'], beam_size=5)
        heard = ' '.join(s.text.strip() for s in segments)
        item = dict(id=clip['id'], expected=clip['text'], heard=heard, match=normalize(heard) == normalize(clip['text']), seconds=round(frames/rate, 3))
        report.append(item)
        print(json.dumps(item, ensure_ascii=False), flush=True)
Path('docs/astra/reports/foundation-audio-qa.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(f'{sum(r["match"] for r in report)}/{len(report)} exact normalized transcripts. Differences require review; human prosody review remains open.')
