import { getStore } from "./store";
import type { ReserveUsageInput } from "./billing-types";
export type {
  ReserveUsageInput,
  UsageReservation,
  PlanId,
  BillingMode,
  UsageKind,
} from "./billing-types";
export const reserveUsage = (input: ReserveUsageInput) =>
  getStore().reserveUsage(input);
/** Finalizers deliberately remain available after session revocation to release held credits.
 * They are server-only, ownership-bound, idempotent, and have no public HTTP endpoint. */
export const settleUsage = (input: {
  userId: string;
  reservationId: string;
  additionalReservationIds?: string[];
  onSettled?: () => void;
}) => getStore().settleUsage(input);
export const failUsage = (input: { userId: string; reservationId: string }) =>
  getStore().failUsage(input);
