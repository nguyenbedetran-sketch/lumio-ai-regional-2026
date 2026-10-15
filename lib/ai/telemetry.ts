import { recordAIUsage } from "../server/store";
import type { AIUsageInput } from "../server/types";

// Telemetry is not billing. A full/damaged local disk must not turn a useful AI
// answer, or an expected JSON error, into an uncaught HTML server error.
// Callers must use a transactional ledger for any future paid-credit mutation.
export function recordAIUsageSafe(
  input: AIUsageInput,
  write: (event: AIUsageInput) => void = recordAIUsage,
): boolean {
  try {
    write(input);
    return true;
  } catch {
    console.warn("[lumio] AI_USAGE_NOT_RECORDED");
    return false;
  }
}
