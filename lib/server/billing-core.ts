import type { DatabaseConnection as DatabaseSync } from "./database-connection";
import { createHash, randomUUID } from "node:crypto";
import { PlatformError, type Actor, type AuditInput, type User } from "./types";
import { requirePermission } from "./policy";
import {
  CREDIT_PACK_IDS,
  CREDIT_RATES,
  PLAN_DEFINITIONS,
  TRIAL_CREDITS,
  type PlanId,
  type ReserveUsageInput,
  type UsageReservation,
} from "./billing-types";
import { paymentAdapter } from "./billing-provider";
import { isCompetitionPreview } from "./competition-preview";
import type { BillingEntitlements } from "./billing-types";

function effectiveEntitlements(plan: PlanId): BillingEntitlements {
  return isCompetitionPreview() && plan === "free"
    ? {
        modes: ["quick", "tutor", "think", "deep"],
        kinds: ["text", "image", "pdf", "audio", "video"],
        voice: true,
        maxVideoSeconds: 600,
      }
    : PLAN_DEFINITIONS[plan].entitlements;
}

type Context = {
  db: DatabaseSync;
  now: () => number;
  stamp: () => string;
  transaction: <T>(fn: () => T) => T;
  getUser: (id: string) => User | null;
  actorFor: (id: string) => Actor;
  recordAudit: (input: AuditInput) => void;
};
const planId = (value: unknown): value is PlanId =>
  typeof value === "string" && Object.hasOwn(PLAN_DEFINITIONS, value);
const requestKey = (value: unknown) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{8,100}$/.test(value))
    throw new PlatformError("INVALID_IDEMPOTENCY_KEY");
  return value;
};
export function createBillingStore(ctx: Context) {
  const { db, now, stamp, transaction, getUser, actorFor, recordAudit } = ctx;
  const rawAccount = (userId: string) =>
    db.prepare("SELECT * FROM billing_accounts WHERE user_id=?").get(userId)!;
  function actor(userId: string, version: number) {
    const user = getUser(userId);
    if (
      !user ||
      user.disabled ||
      !Number.isSafeInteger(version) ||
      user.sessionVersion !== version
    )
      throw new PlatformError("SESSION_REVOKED", 401);
    return user;
  }
  function ledger(
    userId: string,
    key: string,
    kind: string,
    availableDelta: number,
    reservedDelta: number,
    note: string,
    reservationId: string | null = null,
    actorId: string | null = null,
  ) {
    const result = db
      .prepare(
        "UPDATE billing_accounts SET balance=balance+?,reserved=reserved+?,updated_at=? WHERE user_id=? AND balance+?>=0 AND reserved+?>=0",
      )
      .run(
        availableDelta,
        reservedDelta,
        stamp(),
        userId,
        availableDelta,
        reservedDelta,
      );
    if (!result.changes) throw new PlatformError("CREDITS_INSUFFICIENT", 402);
    const account = rawAccount(userId);
    db.prepare(
      "INSERT INTO billing_ledger(id,user_id,event_key,kind,available_delta,reserved_delta,balance_after,reserved_after,reservation_id,actor_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      userId,
      key,
      kind,
      availableDelta,
      reservedDelta,
      account.balance,
      account.reserved,
      reservationId,
      actorId,
      note,
      stamp(),
    );
  }
  function ensureAccount(userId: string) {
    const result = db
      .prepare(
        "INSERT OR IGNORE INTO billing_accounts(user_id,created_at,updated_at) VALUES (?,?,?)",
      )
      .run(userId, stamp(), stamp());
    if (result.changes)
      ledger(
        userId,
        `trial:${userId}`,
        "trial",
        TRIAL_CREDITS,
        0,
        "Credits dùng thử một lần; không phải tiền.",
      );
    const account = rawAccount(userId);
    if (account.period_end !== null && Number(account.period_end) <= now()) {
      // Sandbox access always expires. Paid renewal requires a verified provider event.
      db.prepare(
        "UPDATE billing_accounts SET plan_id='free',plan_source='free',period_end=NULL,cancel_at_period_end=0,next_plan_id=NULL,updated_at=? WHERE user_id=?",
      ).run(stamp(), userId);
      recordAudit({
        actorId: userId,
        action: "BILLING_PLAN_EXPIRED",
        target: userId,
        before: {
          plan: String(account.plan_id),
          source: String(account.plan_source),
        },
        after: { plan: "free" },
      });
    }
    for (const stale of db
      .prepare(
        "SELECT id,units FROM billing_reservations WHERE user_id=? AND status='reserved' AND expires_at<=?",
      )
      .all(userId, now())) {
      finalize(
        userId,
        String(stale.id),
        "refunded",
        "Hoàn credits do yêu cầu hết thời gian xử lý.",
      );
    }
  }
  function getBillingCatalog() {
    const settings = db.prepare("SELECT * FROM billing_catalog_settings").all();
    const rowFor = (id: string) => settings.find((row) => row.item_id === id);
    const numeric = (value: unknown) =>
      value === null || value === undefined ? null : Number(value);
    const plans = Object.entries(PLAN_DEFINITIONS).map(([id, definition]) => {
      const row = rowFor(id);
      return {
        id: id as PlanId,
        ...definition,
        entitlements: effectiveEntitlements(id as PlanId),
        currency: "VND",
        monthlyPriceMinor:
          id === "free" ? 0 : numeric(row?.monthly_price_minor),
        yearlyPriceMinor: id === "free" ? 0 : numeric(row?.yearly_price_minor),
        credits: id === "free" ? TRIAL_CREDITS : numeric(row?.credits),
        creditsPeriod: id === "free" ? "one_time_trial" : "month",
        checkoutAvailable: false,
      };
    });
    const packs = CREDIT_PACK_IDS.map((id, index) => ({
      id,
      name: ["Small", "Medium", "Large"][index],
      credits: numeric(rowFor(id)?.credits),
      priceMinor: numeric(rowFor(id)?.monthly_price_minor),
      currency: "VND",
      checkoutAvailable: false,
    }));
    return {
      competitionPreview: isCompetitionPreview(),
      plans,
      packs,
      rates: CREDIT_RATES,
      pricingStatus: "pending_configuration",
      paymentProviderConfigured: paymentAdapter.configured,
      currency: "VND",
      trialCredits: TRIAL_CREDITS,
    };
  }
  function accountView(userId: string) {
    const account = rawAccount(userId),
      currentPlan = planId(account.plan_id) ? account.plan_id : "free";
    return {
      userId,
      planId: currentPlan,
      planName: PLAN_DEFINITIONS[currentPlan].name,
      planSource: String(account.plan_source),
      balance: Number(account.balance),
      reserved: Number(account.reserved),
      periodEnd:
        account.period_end === null
          ? null
          : new Date(Number(account.period_end)).toISOString(),
      cancelAtPeriodEnd: !!account.cancel_at_period_end,
      nextPlanId:
        account.next_plan_id === null ? null : String(account.next_plan_id),
      entitlements: effectiveEntitlements(currentPlan),
      autoRenewEnabled: false,
    };
  }
  function history(userId: string, offset = 0) {
    return db
      .prepare(
        "SELECT * FROM billing_ledger WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 50 OFFSET ?",
      )
      .all(userId, Math.max(0, Math.min(100000, Math.floor(offset))))
      .map((row) => ({
        id: String(row.id),
        kind: String(row.kind),
        units: Number(row.available_delta),
        reservedDelta: Number(row.reserved_delta),
        balanceAfter: Number(row.balance_after),
        reservedAfter: Number(row.reserved_after),
        reservationId:
          row.reservation_id === null ? null : String(row.reservation_id),
        note: String(row.note),
        createdAt: String(row.created_at),
      }));
  }
  function getBillingSnapshot(userId: string, version: number, offset = 0) {
    return transaction(() => {
      actor(userId, version);
      ensureAccount(userId);
      return {
        catalog: getBillingCatalog(),
        account: accountView(userId),
        history: history(userId, offset),
        invoices: [],
        historyOffset: offset,
        sandbox: rawAccount(userId).plan_source === "sandbox",
      };
    });
  }
  function reserveUsage(input: ReserveUsageInput): UsageReservation {
    requestKey(input.requestId);
    if (
      !Object.hasOwn(CREDIT_RATES.tasks, input.task) ||
      !Object.hasOwn(CREDIT_RATES.kinds, input.kind) ||
      !Object.hasOwn(CREDIT_RATES.modes, input.mode ?? "tutor")
    )
      throw new PlatformError("INVALID_BILLING_USAGE");
    const mode = input.mode ?? "tutor";
    if (
      input.kind === "video" &&
      (!Number.isSafeInteger(input.duration) ||
        input.duration! <= 0 ||
        input.duration! > 1800)
    )
      throw new PlatformError("INVALID_VIDEO_DURATION");
    return transaction(() => {
      actor(input.userId, input.sessionVersion);
      ensureAccount(input.userId);
      const previous = db
        .prepare("SELECT status FROM billing_reservations WHERE request_id=?")
        .get(input.requestId);
      if (previous)
        throw new PlatformError(
          previous.status === "reserved"
            ? "BILLING_REQUEST_IN_PROGRESS"
            : "BILLING_REQUEST_FINALIZED",
          409,
        );
      const account = accountView(input.userId),
        entitlements = account.entitlements;
      if (
        !entitlements.modes.includes(mode) ||
        !entitlements.kinds.includes(input.kind) ||
        (["speech", "transcription"].includes(input.task) &&
          !entitlements.voice) ||
        (input.kind === "video" &&
          input.duration! > entitlements.maxVideoSeconds)
      )
        throw new PlatformError("PLAN_ACCESS_REQUIRED", 403);
      const units =
        CREDIT_RATES.tasks[input.task] +
        CREDIT_RATES.modes[mode] +
        CREDIT_RATES.kinds[input.kind] +
        (input.kind === "video"
          ? Math.ceil(input.duration! / 60) * CREDIT_RATES.videoPerMinute
          : 0);
      if (account.balance < units)
        throw new PlatformError("CREDITS_INSUFFICIENT", 402);
      const reservationId = randomUUID();
      db.prepare(
        "INSERT INTO billing_reservations(id,request_id,user_id,units,task,mode,kind,status,created_at,expires_at) VALUES (?,?,?,?,?,?,?,'reserved',?,?)",
      ).run(
        reservationId,
        input.requestId,
        input.userId,
        units,
        input.task,
        mode,
        input.kind,
        stamp(),
        now() + 10 * 60 * 1000,
      );
      ledger(
        input.userId,
        `reserve:${reservationId}`,
        "reserve",
        -units,
        units,
        `Dự giữ credits: ${input.task} · ${mode} · ${input.kind}.`,
        reservationId,
      );
      return {
        reservationId,
        units,
        balance: account.balance - units,
        planId: account.planId,
      };
    });
  }
  function finalize(
    userId: string,
    reservationId: string,
    status: "settled" | "refunded",
    note: string,
  ) {
    const reservation = db
      .prepare("SELECT * FROM billing_reservations WHERE id=? AND user_id=?")
      .get(reservationId, userId);
    if (!reservation)
      throw new PlatformError("BILLING_RESERVATION_NOT_FOUND", 404);
    if (reservation.status !== "reserved")
      return { status: String(reservation.status), changed: false };
    const units = Number(reservation.units);
    db.prepare(
      "UPDATE billing_reservations SET status=?,finalized_at=? WHERE id=? AND status='reserved'",
    ).run(status, stamp(), reservationId);
    ledger(
      userId,
      `${status}:${reservationId}`,
      status === "settled" ? "usage" : "refund",
      status === "settled" ? 0 : units,
      -units,
      note,
      reservationId,
    );
    return { status, changed: true };
  }
  const settleUsage = (input: {
    userId: string;
    reservationId: string;
    additionalReservationIds?: string[];
    onSettled?: () => void;
  }) => {
    const additional =
      input.additionalReservationIds === undefined
        ? []
        : input.additionalReservationIds;
    if (
      !Array.isArray(additional) ||
      additional.length > 4 ||
      additional.some(
        (id) => typeof id !== "string" || !/^[\w-]{1,100}$/.test(id),
      ) ||
      new Set(additional).size !== additional.length ||
      additional.includes(input.reservationId)
    )
      throw new PlatformError("INVALID_RESERVATION_GROUP");
    return transaction(() => {
      if (additional.length) {
        const find = db.prepare(
          "SELECT status FROM billing_reservations WHERE id=? AND user_id=?",
        );
        const primary = find.get(input.reservationId, input.userId),
          others = additional.map((id) => find.get(id, input.userId));
        if (!primary || others.some((row) => !row))
          throw new PlatformError("BILLING_RESERVATION_NOT_FOUND", 404);
        if (primary.status === "settled") {
          if (others.some((row) => row!.status !== "settled"))
            throw new PlatformError("BILLING_GROUP_FINALIZED", 409);
          return { status: "settled", changed: false };
        }
        if (
          primary.status !== "reserved" ||
          others.some((row) => row!.status !== "reserved")
        )
          throw new PlatformError("BILLING_GROUP_FINALIZED", 409);
      }
      const result = finalize(
        input.userId,
        input.reservationId,
        "settled",
        "Đã sử dụng credits cho kết quả AI.",
      );
      if (result.changed && result.status === "settled") {
        for (const id of additional)
          finalize(
            input.userId,
            id,
            "settled",
            "Đã sử dụng credits cho xử lý ngữ nghĩa cùng yêu cầu.",
          );
        input.onSettled?.();
      }
      return result;
    });
  };
  const failUsage = (input: { userId: string; reservationId: string }) =>
    transaction(() =>
      finalize(
        input.userId,
        input.reservationId,
        "refunded",
        "Hoàn credits vì yêu cầu AI không hoàn thành.",
      ),
    );
  function actionOnce(
    userId: string,
    actorId: string,
    requestId: string,
    action: string,
    payload: unknown,
  ) {
    requestKey(requestId);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    const existing = db
      .prepare('SELECT request_id,user_id,actor_id,action AS "action",fingerprint,created_at FROM billing_actions WHERE request_id=?')
      .get(requestId);
    if (existing) {
      if (
        existing.user_id !== userId ||
        existing.actor_id !== actorId ||
        existing.action !== action ||
        existing.fingerprint !== fingerprint
      )
        throw new PlatformError("IDEMPOTENCY_CONFLICT", 409);
      return false;
    }
    db.prepare(
      "INSERT INTO billing_actions(request_id,user_id,actor_id,action,fingerprint,created_at) VALUES (?,?,?,?,?,?)",
    ).run(requestId, userId, actorId, action, fingerprint, stamp());
    return true;
  }
  function updateSubscription(input: {
    userId: string;
    sessionVersion: number;
    requestId: string;
    action: "cancel" | "resume" | "downgrade";
    planId?: PlanId;
  }) {
    if (
      !["cancel", "resume", "downgrade"].includes(input.action) ||
      (input.action === "downgrade" && input.planId !== "free")
    )
      throw new PlatformError("CHECKOUT_REQUIRED", 409);
    return transaction(() => {
      actor(input.userId, input.sessionVersion);
      ensureAccount(input.userId);
      const account = accountView(input.userId);
      if (account.planSource !== "sandbox")
        throw new PlatformError(
          account.planId === "free"
            ? "NO_ACTIVE_SUBSCRIPTION"
            : "PAYMENT_PROVIDER_NOT_CONFIGURED",
          account.planId === "free" ? 409 : 503,
        );
      if (
        actionOnce(input.userId, input.userId, input.requestId, input.action, {
          planId: input.planId || null,
        })
      ) {
        const cancel = input.action !== "resume";
        db.prepare(
          "UPDATE billing_accounts SET cancel_at_period_end=?,next_plan_id=?,updated_at=? WHERE user_id=?",
        ).run(Number(cancel), cancel ? "free" : null, stamp(), input.userId);
        recordAudit({
          actorId: input.userId,
          action: "BILLING_SANDBOX_SUBSCRIPTION_UPDATED",
          target: input.userId,
          after: { action: input.action, money: false },
        });
      }
      return {
        account: accountView(input.userId),
        sandbox: true,
        message:
          "Gói thử nghiệm luôn kết thúc vào ngày hết hạn, không tự thu tiền hoặc tự cộng credits.",
      };
    });
  }
  function adminGrant(input: {
    actorId: string;
    sessionVersion: number;
    userId: string;
    requestId: string;
    planId: PlanId;
    credits: number;
    days: number;
    reason: string;
  }) {
    if (process.env.NODE_ENV !== "development")
      throw new PlatformError("SANDBOX_DISABLED", 403);
    if (
      !planId(input.planId) ||
      !Number.isSafeInteger(input.credits) ||
      input.credits < 0 ||
      input.credits > 100000 ||
      !Number.isInteger(input.days) ||
      input.days < 1 ||
      input.days > 30 ||
      typeof input.reason !== "string" ||
      input.reason.trim().length < 8 ||
      input.reason.length > 300
    )
      throw new PlatformError("INVALID_SANDBOX_GRANT");
    return transaction(() => {
      actor(input.actorId, input.sessionVersion);
      requirePermission(actorFor(input.actorId), "features.update");
      const target = getUser(input.userId);
      if (!target || target.disabled)
        throw new PlatformError("USER_NOT_FOUND", 404);
      ensureAccount(input.userId);
      if (
        actionOnce(
          input.userId,
          input.actorId,
          input.requestId,
          "sandbox_grant",
          {
            planId: input.planId,
            credits: input.credits,
            days: input.days,
            reason: input.reason,
          },
        )
      ) {
        db.prepare(
          "UPDATE billing_accounts SET plan_id=?,plan_source=?,period_end=?,cancel_at_period_end=0,next_plan_id=NULL,updated_at=? WHERE user_id=?",
        ).run(
          input.planId,
          input.planId === "free" ? "free" : "sandbox",
          input.planId === "free" ? null : now() + input.days * 86400000,
          stamp(),
          input.userId,
        );
        ledger(
          input.userId,
          `sandbox:${input.requestId}`,
          "sandbox_grant",
          input.credits,
          0,
          "Admin cấp credits thử nghiệm; không phải giao dịch thanh toán.",
          null,
          input.actorId,
        );
        recordAudit({
          actorId: input.actorId,
          action: "BILLING_SANDBOX_GRANTED",
          target: input.userId,
          after: {
            plan: input.planId,
            credits: input.credits,
            days: input.days,
            reason: input.reason,
            money: false,
          },
        });
      }
      return { account: accountView(input.userId), sandbox: true };
    });
  }
  function updateBillingCatalog(input: {
    actorId: string;
    sessionVersion: number;
    itemId: string;
    monthlyPriceMinor: number | null;
    yearlyPriceMinor: number | null;
    credits: number | null;
  }) {
    if (
      (!planId(input.itemId) &&
        !CREDIT_PACK_IDS.includes(
          input.itemId as (typeof CREDIT_PACK_IDS)[number],
        )) ||
      input.itemId === "free"
    )
      throw new PlatformError("INVALID_BILLING_ITEM");
    for (const value of [
      input.monthlyPriceMinor,
      input.yearlyPriceMinor,
      input.credits,
    ])
      if (
        value !== null &&
        (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000)
      )
        throw new PlatformError("INVALID_BILLING_AMOUNT");
    return transaction(() => {
      actor(input.actorId, input.sessionVersion);
      requirePermission(actorFor(input.actorId), "features.update");
      db.prepare(
        "INSERT INTO billing_catalog_settings(item_id,monthly_price_minor,yearly_price_minor,credits,updated_by,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(item_id) DO UPDATE SET monthly_price_minor=excluded.monthly_price_minor,yearly_price_minor=excluded.yearly_price_minor,credits=excluded.credits,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
      ).run(
        input.itemId,
        input.monthlyPriceMinor,
        input.yearlyPriceMinor,
        input.credits,
        input.actorId,
        stamp(),
      );
      recordAudit({
        actorId: input.actorId,
        action: "BILLING_CATALOG_UPDATED",
        target: input.itemId,
        after: {
          monthlyPrice: input.monthlyPriceMinor,
          yearlyPrice: input.yearlyPriceMinor,
          credits: input.credits,
        },
      });
      return getBillingCatalog();
    });
  }
  function prepareCheckout(input: {
    userId: string;
    sessionVersion: number;
    itemId: string;
    interval: "month" | "year";
  }) {
    return transaction(() => {
      actor(input.userId, input.sessionVersion);
      if (
        !["month", "year"].includes(input.interval) ||
        input.itemId === "free"
      )
        throw new PlatformError("INVALID_BILLING_ITEM");
      const catalog = getBillingCatalog(),
        selected =
          catalog.plans.find((p) => p.id === input.itemId) ||
          catalog.packs.find((p) => p.id === input.itemId);
      if (!selected) throw new PlatformError("INVALID_BILLING_ITEM");
      const amount =
        "priceMinor" in selected
          ? selected.priceMinor
          : input.interval === "month"
            ? selected.monthlyPriceMinor
            : selected.yearlyPriceMinor;
      if (amount === null || selected.credits === null)
        throw new PlatformError("PRICE_NOT_CONFIGURED", 503);
      throw new PlatformError("PAYMENT_PROVIDER_NOT_CONFIGURED", 503);
    });
  }
  return {
    getBillingCatalog,
    getBillingSnapshot,
    reserveUsage,
    settleUsage,
    failUsage,
    updateSubscription,
    adminGrant,
    updateBillingCatalog,
    prepareCheckout,
  };
}
