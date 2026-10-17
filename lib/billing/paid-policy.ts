import { CREDIT_RATES, type BillingMode, type BillingTask, type UsageKind } from "../server/billing-types";
export const PAID_PLANS = ["premium", "pro"] as const;
export type PaidPlanId = (typeof PAID_PLANS)[number];
export const PAID_TASKS = ["chat", "summary", "cards", "quiz", "speech", "transcription", "index", "lesson", "assessment", "feedback", "assistant"] as const;
export type PaidTask = (typeof PAID_TASKS)[number];
export const PAID_MODES = ["quick", "tutor", "think", "deep"] as const;
export const PAID_KINDS = ["text", "image", "pdf", "audio", "video"] as const;
export type PaidPricingFeature = "teacher.lesson" | "teacher.questions" | "teacher.feedback" | "teacher.assistant";
export interface PaidPolicyConfig {
  monthlyPriceMinor: number; yearlyPriceMinor: number; credits: number;
  allowedModes: BillingMode[]; allowedKinds: UsageKind[]; voice: boolean;
  maxVideoSeconds: number; maxSourceCharacters: number; sourceChunkCharacters: number;
  taskBase: Record<PaidTask, number>;
  modeFactorsPermille: Record<BillingMode, number>;
  kindFactorsPermille: Record<UsageKind, number>;
}
export type PaidPolicy = { planId: PaidPlanId; revision: number; config: PaidPolicyConfig };
export interface PaidModelContext { version: string; mode: BillingMode; models: { provider: "openai" | "gemini"; model: string }[] }
export interface PaidUsageDimensions { task: BillingTask; mode?: BillingMode; kind: UsageKind; duration?: number; sourceCharacters?: number; pricingFeature?: PaidPricingFeature }
export interface PaidCreditQuote {
  planId: PaidPlanId; policyRevision: number; policyVersion: string;
  task: PaidTask; mode: BillingMode; kind: UsageKind;
  sourceCharacters: number; durationSeconds: number | null; usageChunks: number;
  taskBase: number; modeFactorPermille: number; kindFactorPermille: number;
  units: number; rounding: "ceil"; providerCostMinor: null;
  basis: "configured-preview-units-not-provider-invoice";
}
export type PaidPricingSnapshot = PaidCreditQuote & { modelPolicy?: PaidModelContext };

export function defaultPaidPolicy(planId: PaidPlanId): PaidPolicyConfig {
  return { monthlyPriceMinor: planId === "premium" ? 129000 : 249000, yearlyPriceMinor: planId === "premium" ? 1290000 : 2490000, credits: planId === "premium" ? 1600 : 3500,
    allowedModes: planId === "premium" ? ["quick", "tutor", "think"] : ["quick", "tutor", "think", "deep"], allowedKinds: [...PAID_KINDS], voice: true,
    maxVideoSeconds: 1800, maxSourceCharacters: planId === "premium" ? 30000 : 100000, sourceChunkCharacters: 12000,
    taskBase: { ...CREDIT_RATES.tasks, lesson: 20, assessment: 16, feedback: 6, assistant: 4 },
    modeFactorsPermille: { quick: 1000, tutor: 2000, think: 4000, deep: 10000 }, kindFactorsPermille: { text: 1000, image: 2000, pdf: 2000, audio: 2000, video: 1000 } };
}
const fail = (code = "INVALID_PAID_POLICY"): never => { throw new Error(code); };
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) return fail(); return value as Record<string, unknown>; }
function exact(value: Record<string, unknown>, keys: readonly string[]) { if (Object.keys(value).sort().join() !== [...keys].sort().join()) fail(); }
function integer(value: unknown, min: number, max: number) { if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) return fail(); return value as number; }
function list<T extends string>(value: unknown, allowed: readonly T[]): T[] { if (!Array.isArray(value) || !value.length || value.length > allowed.length || new Set(value).size !== value.length || value.some(v => !allowed.includes(v))) return fail(); return allowed.filter(v => value.includes(v)); }
function rates<T extends string>(value: unknown, keys: readonly T[], min: number, max: number): Record<T, number> { const row = object(value); exact(row, keys); return Object.fromEntries(keys.map(key => [key, integer(row[key], min, max)])) as Record<T, number>; }
export function parsePaidPolicyConfig(raw: unknown): PaidPolicyConfig {
  const r = object(raw); exact(r, ["monthlyPriceMinor", "yearlyPriceMinor", "credits", "allowedModes", "allowedKinds", "voice", "maxVideoSeconds", "maxSourceCharacters", "sourceChunkCharacters", "taskBase", "modeFactorsPermille", "kindFactorsPermille"]);
  const allowedModes = list(r.allowedModes, PAID_MODES), allowedKinds = list(r.allowedKinds, PAID_KINDS);
  if (!allowedModes.includes("quick") || !allowedKinds.includes("text") || typeof r.voice !== "boolean") fail();
  return { monthlyPriceMinor: integer(r.monthlyPriceMinor, 0, 1_000_000_000), yearlyPriceMinor: integer(r.yearlyPriceMinor, 0, 1_000_000_000), credits: integer(r.credits, 1, 100000), allowedModes, allowedKinds, voice: r.voice as boolean,
    maxVideoSeconds: integer(r.maxVideoSeconds, 1, 1800), maxSourceCharacters: integer(r.maxSourceCharacters, 1000, 100000), sourceChunkCharacters: integer(r.sourceChunkCharacters, 1000, 100000),
    taskBase: rates(r.taskBase, PAID_TASKS, 1, 10000), modeFactorsPermille: rates(r.modeFactorsPermille, PAID_MODES, 100, 10000), kindFactorsPermille: rates(r.kindFactorsPermille, PAID_KINDS, 100, 10000) };
}
/** Pro includes Premium's configured access, but neither confers teacher/class permissions. */
export function paidPolicyIncludes(pro: PaidPolicyConfig, premium: PaidPolicyConfig): boolean {
  return premium.allowedModes.every(m => pro.allowedModes.includes(m)) && premium.allowedKinds.every(k => pro.allowedKinds.includes(k)) && (!premium.voice || pro.voice) && pro.maxVideoSeconds >= premium.maxVideoSeconds && pro.maxSourceCharacters >= premium.maxSourceCharacters && pro.credits >= premium.credits;
}
export function quotePaidUsage(policy: PaidPolicy, input: PaidUsageDimensions): PaidCreditQuote {
  const mode = input.mode || "tutor", config = policy.config;
  if (!config.allowedModes.includes(mode) || !config.allowedKinds.includes(input.kind) || (["speech", "transcription"].includes(input.task) && !config.voice)) fail("PLAN_ACCESS_REQUIRED");
  const sourceCharacters = input.sourceCharacters ?? 0;
  if (!Number.isSafeInteger(sourceCharacters) || sourceCharacters < 0 || sourceCharacters > config.maxSourceCharacters) fail("PAID_SOURCE_LIMIT");
  if (input.kind === "video" && (!Number.isSafeInteger(input.duration) || input.duration! <= 0 || input.duration! > config.maxVideoSeconds)) fail("PLAN_ACCESS_REQUIRED");
  const features: Record<PaidPricingFeature, PaidTask> = { "teacher.lesson": "lesson", "teacher.questions": "assessment", "teacher.feedback": "feedback", "teacher.assistant": "assistant" };
  if (input.pricingFeature !== undefined && !Object.hasOwn(features, input.pricingFeature)) fail("INVALID_BILLING_USAGE");
  const task = input.pricingFeature ? features[input.pricingFeature] : input.task;
  if (!Object.hasOwn(config.taskBase, task)) fail("INVALID_BILLING_USAGE");
  const usageChunks = Math.max(1, Math.ceil(sourceCharacters / config.sourceChunkCharacters), input.kind === "video" ? Math.ceil(input.duration! / 600) : 1);
  const units = Math.ceil(config.taskBase[task] * config.modeFactorsPermille[mode] * config.kindFactorsPermille[input.kind] * usageChunks / 1_000_000);
  if (!Number.isSafeInteger(units) || units < 1) fail("INVALID_BILLING_USAGE");
  return { planId: policy.planId, policyRevision: policy.revision, policyVersion: `paid-v1:${policy.planId}:${policy.revision}`, task, mode, kind: input.kind, sourceCharacters, durationSeconds: input.kind === "video" ? input.duration! : null, usageChunks, taskBase: config.taskBase[task], modeFactorPermille: config.modeFactorsPermille[mode], kindFactorPermille: config.kindFactorsPermille[input.kind], units, rounding: "ceil", providerCostMinor: null, basis: "configured-preview-units-not-provider-invoice" };
}
