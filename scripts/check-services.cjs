// Explicit live connection checks with tiny fixed prompts; never prints credential values.
const fs = require("node:fs");
const path = require("node:path");
process.loadEnvFile(path.join(__dirname, "..", ".env.local"));
async function probe(name, url, options, parse) {
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      let code = "HTTP_" + response.status;
      try {
        const b = await response.json();
        const raw = b.error?.code || b.error?.status;
        if (typeof raw === "string" && /^[A-Za-z0-9_ -]{1,60}$/.test(raw))
          code = raw;
      } catch {}
      return { name, status: "failed", httpStatus: response.status, code };
    }
    return { name, status: "connected", ...(await parse(response)) };
  } catch {
    return { name, status: "failed", code: "NETWORK_OR_TIMEOUT" };
  }
}
async function main() {
  const results = [];
  if (process.env.OPENAI_API_KEY)
    results.push(
      await probe(
        "tutor",
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + process.env.OPENAI_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL,
            input: "Reply with only the number: 1 + 1 = ?",
            reasoning: { effort: "minimal" },
            max_output_tokens: 1024,
            store: false,
          }),
        },
        async (r) => {
          const b = await r.json();
          return {
            answerValid:
              b.output?.some((o) =>
                o.content?.some(
                  (c) => c.type === "output_text" && c.text.trim() === "2",
                ),
              ) === true,
          };
        },
      ),
    );
  if (process.env.GEMINI_API_KEY)
    results.push(
      await probe(
        "documents",
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          encodeURIComponent(process.env.GEMINI_MODEL) +
          ":generateContent",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": process.env.GEMINI_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: "Reply with only the number: 1 + 1 = ?" }] },
            ],
            generationConfig: { maxOutputTokens: 256 },
          }),
        },
        async (r) => {
          const b = await r.json();
          return {
            answerValid:
              b.candidates?.[0]?.content?.parts?.some(
                (p) => p.text?.trim() === "2",
              ) === true,
          };
        },
      ),
    );
  if (process.env.XAI_API_KEY)
    results.push(
      await probe(
        "voice",
        "https://api.x.ai/v1/tts",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + process.env.XAI_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "Hello.",
            voice_id: process.env.XAI_VOICE || "eve",
            language: "en",
          }),
        },
        async (r) => ({ audioValid: (await r.arrayBuffer()).byteLength > 100 }),
      ),
    );
  const report = { checkedAt: new Date().toISOString(), results };
  const directory = path.join(__dirname, "..", ".data");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "provider-health.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
main().catch(() => {
  console.error("Connection check failed without logging credentials.");
  process.exitCode = 1;
});
