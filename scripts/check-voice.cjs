// Optional paid smoke test: a very short synthetic sentence, no personal content.
const fs = require("node:fs");
process.loadEnvFile(".env.local");
async function main() {
  const key = process.env.XAI_API_KEY;
  if (!key) throw Error("VOICE_NOT_CONFIGURED");
  const headers = { Authorization: `Bearer ${key}` };
  const audio = await fetch("https://api.x.ai/v1/tts", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Hello Lumio. Learning is fun.",
      voice_id: process.env.XAI_VOICE || "eve",
      language: "en",
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!audio.ok) throw Error(`VOICE_HTTP_${audio.status}`);
  const bytes = await audio.arrayBuffer();
  const form = new FormData();
  form.set("model", process.env.XAI_STT_MODEL || "grok-voice-transcribe-2.0");
  // xAI requires file last in multipart requests.
  form.set(
    "file",
    new File([bytes], "lumio-smoke.mp3", { type: "audio/mpeg" }),
  );
  const result = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers,
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  if (!result.ok) throw Error(`TRANSCRIPTION_HTTP_${result.status}`);
  const body = await result.json();
  if (typeof body.text !== "string" || !/learning/i.test(body.text))
    throw Error("TRANSCRIPTION_RESULT_MISMATCH");
  fs.mkdirSync(".data", { recursive: true });
  fs.writeFileSync(
    ".data/voice-smoke.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        speech: true,
        transcription: true,
        syntheticInput: true,
      },
      null,
      2,
    ),
  );
  console.log("PASS real speech → transcription (synthetic input).");
}
main().catch((e) => {
  console.error(
    /^[A-Z0-9_]+$/.test(e.message) ? e.message : "VOICE_CHECK_FAILED",
  );
  process.exitCode = 1;
});
