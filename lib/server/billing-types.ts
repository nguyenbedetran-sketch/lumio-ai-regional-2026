export type PlanId = "free" | "plus" | "premium" | "pro";
export type BillingMode = "quick" | "think" | "deep" | "tutor";
export type UsageKind = "text" | "image" | "pdf" | "audio" | "video";
export type BillingTask =
  "chat" | "summary" | "cards" | "quiz" | "speech" | "transcription" | "index";
export interface ReserveUsageInput {
  userId: string;
  sessionVersion: number;
  requestId: string;
  task: BillingTask;
  mode?: BillingMode;
  kind: UsageKind;
  /** Validated video segment length, supplied by the server route. */
  duration?: number;
}
export interface UsageReservation {
  reservationId: string;
  units: number;
  balance: number;
  planId: PlanId;
}
export interface BillingEntitlements {
  modes: readonly BillingMode[];
  kinds: readonly UsageKind[];
  voice: boolean;
  maxVideoSeconds: number;
}
export const PLAN_DEFINITIONS: Record<
  PlanId,
  { name: string; entitlements: BillingEntitlements }
> = {
  free: {
    name: "Free",
    entitlements: {
      modes: ["quick", "tutor"],
      kinds: ["text", "image", "pdf", "video"],
      voice: false,
      maxVideoSeconds: 600,
    },
  },
  plus: {
    name: "Plus",
    entitlements: {
      modes: ["quick", "tutor", "think"],
      kinds: ["text", "image", "pdf", "audio", "video"],
      voice: true,
      maxVideoSeconds: 1200,
    },
  },
  premium: {
    name: "Premium",
    entitlements: {
      modes: ["quick", "tutor", "think", "deep"],
      kinds: ["text", "image", "pdf", "audio", "video"],
      voice: true,
      maxVideoSeconds: 1800,
    },
  },
  pro: {
    name: "Pro",
    entitlements: {
      modes: ["quick", "tutor", "think", "deep"],
      kinds: ["text", "image", "pdf", "audio", "video"],
      voice: true,
      maxVideoSeconds: 1800,
    },
  },
};
export const CREDIT_PACK_IDS = [
  "pack_small",
  "pack_medium",
  "pack_large",
] as const;
export const TRIAL_CREDITS = 200;
/** Preview usage units; these are NOT prices or currency conversions. */
export const CREDIT_RATES = {
  tasks: {
    chat: 2,
    summary: 8,
    cards: 6,
    quiz: 8,
    speech: 8,
    transcription: 12,
    index: 2,
  },
  modes: { quick: 0, tutor: 2, think: 6, deep: 18 },
  kinds: { text: 0, image: 4, pdf: 8, audio: 12, video: 0 },
  videoPerMinute: 10,
} as const;
