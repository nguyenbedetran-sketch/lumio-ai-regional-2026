# Voice Studio

Voice Studio is a **turn-based** conversation: record or upload audio → request transcription → edit the transcript → ask Lumio → optionally generate spoken audio. It does not open a realtime microphone stream to an AI service. No voice-cloning feature is included.

The component is `components/lumio/voice-studio.tsx`. Import `app/voice.css` once in the root layout. Props are `locale`, optional `providers`, optional `sourceText`, `signedIn` (defaults to false), optional `onLogin()`, and optional async `onSaveTranscript(text)`. Guest users can record and edit locally; online buttons require `signedIn` and the relevant configured capability. These UI checks do not replace server authorization. Key the component by the current account key so switching accounts clears the temporary conversation. Without `providers`, it reads `/api/config`. The save callback should resolve only when the note has actually been saved, or reject on failure.

Recording starts only after a button press and a browser microphone permission grant. The microphone tracks stop when recording finishes, is cancelled, or the component unmounts. Cancelling a pending permission request invalidates a late permission result. A stale recorder callback cannot stop a newer recording. The level display samples the actual microphone through an analyser; it is not simulated speech activity. Reduced-motion preferences disable decorative animations.

Recordings stay in the tab until the user selects **Transcribe**. Conversation text stays in the tab unless explicitly saved to notes or downloaded. Transcription shares audio for processing. Asking shares the edited question, up to six prior messages and the selected source. TTS shares the answer text. Completed stages consume credits under the existing server ledger and plan rules. A failed or server-cancelled voice call refunds its held credits; a completed previous stage is not refunded just because the next stage fails. Audio replies above 3,000 characters read the first 3,000 with a visible notice; the full text remains on screen.

## API

All calls below are to the Lumio server. Provider credentials and preset mappings stay server-side. Authentication, feature flags, same-origin browser checks or approved native authentication, rate limits, session revocation and entitlements are enforced by the common AI guard and credit ledger.

`GET /api/voice` returns static, non-sensitive configuration:

```json
{
  "voices": ["clear", "calm", "warm"],
  "languages": ["vi", "en", "zh-CN", "ja", "ko"],
  "limits": {"recordingSeconds": 120, "audioBytes": 8388608, "questionCharacters": 4000, "speechCharacters": 3000},
  "conversation": "turn-based"
}
```

`POST /api/voice` with multipart `file` and optional `language` returns `{ "text": "...", "requestId": "..." }`. Files must be non-empty audio containers supported by the route, at most 8 MB. The 120-second limit applies to the in-app recorder; uploads use the byte limit. For Chinese transcription, the route omits the formatting hint because Chinese is not in the currently documented formatted-STT language list; accuracy must be evaluated separately.

`POST /api/voice` with JSON `{ "text": "...", "language": "vi", "voice": "calm" }` returns MP3 audio with `Cache-Control: no-store` and `X-Lumio-Request-Id`. The `voice` alias is optional for older clients; omission keeps the configured server default. Unknown aliases and languages are rejected. The browser offers play/pause, seek, playback speed and audio download without making another TTS request.

The conversational answer uses the existing `POST /api/ai` route with `task: "chat"`, `mode: "tutor"`, `question`, `source`, `language`, and `history`. The endpoint still controls model selection; there are no model or entitlement overrides in the client.

Voice requests propagate client cancellation and a 60-second timeout to the provider. Errors remain JSON, including `REQUEST_CANCELLED` (499), `PROVIDER_TIMEOUT` (504), `INVALID_VOICE`/`INVALID_LANGUAGE`/`INVALID_MEDIA` (400), insufficient credits (402), plan denial (403), and unavailable configuration (503). Audio output and transcription response bodies are bounded before settlement.

## Validation and remaining limits

`node tests/voice.cjs`: 14 checks using an isolated SQLite ledger, stubbed login and mocked external transport. Covers preset/language validation, multipart file ordering, entitlement denial, bounded responses, cancellation/refund, client context bounds and safe HTML-error handling. Existing `tests/ai-billing.cjs` covers the shared route ledger boundary. These tests do not assert speech quality or call paid services.

Vietnamese and English copy is complete. Chinese/Japanese/Korean currently localize the main controls and use English for longer support text. Microphone permission, real-device recording, actual voice quality and autoplay policies need browser/device review. An unavailable online service leaves local drafting and recording usable, while online controls remain disabled.

Provider contract checked against the official documentation on 2026-09-27: [speech-to-text](https://docs.x.ai/developers/model-capabilities/audio/speech-to-text), [text-to-speech](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech), and [voice presets](https://docs.x.ai/developers/model-capabilities/audio/voice). Preset aliases map to the documented `eve`, `luna`, and `ara` voices. No live-provider validation is claimed by the mocked tests.
