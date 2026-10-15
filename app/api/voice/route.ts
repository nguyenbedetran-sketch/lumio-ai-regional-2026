import {
  authorizeAI,
  boundedBytes,
  failure,
  type AILease,
} from "../../../lib/ai/guard";
import { AIError, record } from "../../../lib/ai/contracts";
import { recordAIUsageSafe as recordAIUsage } from "../../../lib/ai/telemetry";
import {
  reserveUsage,
  settleUsage,
  failUsage,
  type UsageReservation,
} from "../../../lib/server/billing";
import { PlatformError } from "../../../lib/server/types";
import { speechInput, transcriptionForm } from "../../../lib/voice/server";
import {
  VOICE_IDS,
  VOICE_LANGUAGES,
  VOICE_LIMITS,
} from "../../../lib/voice/options";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(
    {
      voices: VOICE_IDS,
      languages: VOICE_LANGUAGES,
      limits: VOICE_LIMITS,
      conversation: "turn-based",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  let release: AILease | undefined;
  let reservation: UsageReservation | undefined;
  const requestId = crypto.randomUUID(),
    startedAt = Date.now();
  const task = req.headers.get("content-type")?.includes("multipart/form-data")
    ? "transcription"
    : "speech";
  let usedModel: string | undefined;
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(60000)]);
  try {
    release = await authorizeAI(req, true);
    signal.throwIfAborted();
    const key = process.env.XAI_API_KEY;
    if (!key) throw new AIError("PROVIDER_NOT_CONFIGURED", 503);
    const bytes = await boundedBytes(req, 10 * 1024 * 1024);
    const headers = { Authorization: `Bearer ${key}` };
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const parsed = new Request(req.url, {
        method: "POST",
        headers: { "content-type": req.headers.get("content-type")! },
        body: Buffer.from(bytes),
      });
      const data = await parsed.formData();
      const model = process.env.XAI_STT_MODEL;
      if (!model) throw new AIError("PROVIDER_NOT_CONFIGURED", 503);
      usedModel = model;
      const form = transcriptionForm(data, model);
      signal.throwIfAborted();
      reservation = reserveUsage({
        userId: release.userId,
        sessionVersion: release.sessionVersion,
        requestId,
        task: "transcription",
        kind: "audio",
        mode: "quick",
      });
      const response = await fetch("https://api.x.ai/v1/stt", {
        method: "POST",
        headers,
        body: form,
        signal,
      });
      if (!response.ok)
        throw new AIError(
          response.status === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_ERROR",
          502,
        );
      const result = record(
        JSON.parse(
          new TextDecoder().decode(await boundedBytes(response, 512 * 1024)),
        ),
      );
      if (
        typeof result.text !== "string" ||
        !result.text.trim() ||
        result.text.length > 200000
      )
        throw new AIError("EMPTY_AI_OUTPUT", 502);
      signal.throwIfAborted();
      settleUsage({
        userId: release.userId,
        reservationId: reservation.reservationId,
      });
      recordAIUsage({
        requestId,
        userId: release.userId,
        task,
        provider: "xai",
        model,
        status: "success",
        latencyMs: Date.now() - startedAt,
      });
      return Response.json(
        { text: result.text, requestId },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw new AIError("INVALID_CONTENT_TYPE", 415);
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new AIError("INVALID_JSON");
    }
    const input = speechInput(raw);
    signal.throwIfAborted();
    reservation = reserveUsage({
      userId: release.userId,
      sessionVersion: release.sessionVersion,
      requestId,
      task: "speech",
      kind: "text",
      mode: "quick",
    });
    const response = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    if (!response.ok)
      throw new AIError(
        response.status === 429 ? "PROVIDER_RATE_LIMIT" : "PROVIDER_ERROR",
        502,
      );
    const audio = await boundedBytes(response, 12 * 1024 * 1024);
    if (
      !audio.byteLength ||
      !(response.headers.get("content-type") || "").startsWith("audio/")
    )
      throw new AIError("EMPTY_AI_OUTPUT", 502);
    signal.throwIfAborted();
    settleUsage({
      userId: release.userId,
      reservationId: reservation.reservationId,
    });
    recordAIUsage({
      requestId,
      userId: release.userId,
      task,
      provider: "xai",
      status: "success",
      latencyMs: Date.now() - startedAt,
    });
    return new Response(Buffer.from(audio), {
      headers: {
        "Content-Type": response.headers.get("content-type") || "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Lumio-Request-Id": requestId,
      },
    });
  } catch (e) {
    if (release && reservation) {
      try {
        failUsage({
          userId: release.userId,
          reservationId: reservation.reservationId,
        });
      } catch {
        console.warn(
          "Lumio credit reservation requires reconciliation",
          requestId,
        );
      }
    }
    if (release)
      recordAIUsage({
        requestId,
        userId: release.userId,
        task,
        provider: "xai",
        model: usedModel,
        status: "error",
        errorCode:
          e instanceof AIError || e instanceof PlatformError
            ? e.code
            : "PROVIDER_UNAVAILABLE",
        latencyMs: Date.now() - startedAt,
      });
    return failure(
      req.signal.aborted
        ? new AIError("REQUEST_CANCELLED", 499)
        : signal.aborted
          ? new AIError("PROVIDER_TIMEOUT", 504)
          : e,
    );
  } finally {
    release?.();
  }
}
