"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Crown,
  Sparkles,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  LockKeyhole,
  FlaskConical,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import type {
  BillingEntitlements,
  PlanId,
} from "../../lib/server/billing-types";
import { billingCopy } from "../../lib/lumio/billing-copy";
import { Dialog } from "./dialog";
import {
  PRICING_PREVIEW,
  PACK_PRICING_PREVIEW,
  PRICING_PREVIEW_CHECKOUT,
  pricingPreviewCopy,
} from "../../lib/lumio/pricing-preview";
type Plan = {
  id: PlanId;
  name: string;
  monthlyPriceMinor: number | null;
  yearlyPriceMinor: number | null;
  credits: number | null;
  creditsPeriod: string;
  entitlements: BillingEntitlements;
  checkoutAvailable: boolean;
};
type Pack = {
  id: string;
  name: string;
  priceMinor: number | null;
  credits: number | null;
  checkoutAvailable: boolean;
};
type Catalog = {
  plans: Plan[];
  packs: Pack[];
  trialCredits: number;
  rates: {
    tasks: Record<string, number>;
    modes: Record<string, number>;
    kinds: Record<string, number>;
    videoPerMinute: number;
  };
};
type Snapshot = {
  catalog: Catalog;
  account: {
    userId: string;
    planId: PlanId;
    planName: string;
    planSource: string;
    balance: number;
    reserved: number;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    nextPlanId: string | null;
  };
  history: {
    id: string;
    kind: string;
    units: number;
    reservedDelta: number;
    balanceAfter: number;
    note: string;
    createdAt: string;
  }[];
  sandbox: boolean;
};
export function BillingPanel({
  locale,
  signedIn,
  login,
  isAdmin,
}: {
  locale: Locale;
  signedIn: boolean;
  login: () => void;
  isAdmin: boolean;
}) {
  const c = billingCopy[locale];
  const pc = pricingPreviewCopy[locale];
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [interval, setInterval] = useState<"month" | "year">("month"),
    [selected, setSelected] = useState<Plan | Pack | null>(null),
    [action, setAction] = useState<"cancel" | "resume" | "downgrade" | null>(
      null,
    );
  const [adminEnabled, setAdminEnabled] = useState(false),
    [previewPlan, setPreviewPlan] = useState<PlanId>("premium"),
    [previewCredits, setPreviewCredits] = useState("1000"),
    [previewDays, setPreviewDays] = useState("7");
  const [task, setTask] = useState("chat"),
    [mode, setMode] = useState("quick"),
    [kind, setKind] = useState("text"),
    [minutes, setMinutes] = useState(1),
    [page, setPage] = useState(0);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(
          signedIn
            ? `/api/billing?offset=${page * 50}`
            : "/api/billing/catalog",
          { cache: "no-store", signal },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "BILLING_ERROR");
        if (signedIn) {
          setSnapshot(data);
          setCatalog(data.catalog);
        } else {
          setSnapshot(null);
          setCatalog(data.catalog || data);
        }
      } catch (e) {
        if (!(e instanceof Error && e.name === "AbortError")) setError(c.error);
      } finally {
        setBusy(false);
      }
    },
    [signedIn, page, c.error],
  );
  useEffect(() => {
    const abort = new AbortController();
    void refresh(abort.signal);
    return () => abort.abort();
  }, [refresh]);
  useEffect(() => {
    let active = true;
    setAdminEnabled(false);
    if (isAdmin)
      fetch("/api/billing/admin", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (active) setAdminEnabled(data?.sandboxEnabled === true);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAdmin]);
  async function mutate(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "BILLING_ERROR");
      setNotice(c.done);
      setAction(null);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error && e.message === "ADMIN_REAUTH_REQUIRED"
          ? c.expired
          : c.failed,
      );
    } finally {
      setBusy(false);
    }
  }
  const price = (value: number | null | undefined) =>
    value == null
      ? c.waiting
      : new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "VND",
          maximumFractionDigits: 0,
        }).format(value);
  const features = (p: Plan) => [
    c.quick,
    c.documents,
    `${p.entitlements.maxVideoSeconds / 60} ${c.video}`,
    p.entitlements.voice ? c.voice : c.noVoice,
    ...(p.entitlements.modes.includes("think") ? [c.think] : []),
    ...(p.entitlements.modes.includes("deep") ? [c.deep] : []),
  ];
  const rates = catalog?.rates;
  const effectiveMode = task === "chat" ? mode : "quick";
  const voiceTask = task === "speech" || task === "transcription";
  const effectiveKind =
    task === "speech" ? "text" : task === "transcription" ? "audio" : kind;
  const taskLabels: Record<string, string> = c.taskLabels;
  const modeLabels: Record<string, string> = c.modeLabels;
  const kindLabels: Record<string, string> = c.kindLabels;
  const estimate = rates
    ? (rates.tasks[task] || 0) +
      (rates.modes[effectiveMode] || 0) +
      (rates.kinds[effectiveKind] || 0) +
      (effectiveKind === "video"
        ? Math.ceil(minutes) * rates.videoPerMinute
        : 0)
    : 0;
  const labels = {
    trial: c.trialEntry,
    reserve: c.reserve,
    usage: c.usage,
    refund: c.refund,
    sandbox_grant: c.grant,
  } as Record<string, string>;
  // Display-only proposals. These objects never enter billing mutations or the real wallet.
  const previewPlans = (catalog?.plans || []).map((plan) => ({
    ...plan,
    monthlyPriceMinor: PRICING_PREVIEW[plan.id].monthlyVnd,
    yearlyPriceMinor: PRICING_PREVIEW[plan.id].yearlyVnd,
    credits: PRICING_PREVIEW[plan.id].credits,
    checkoutAvailable: PRICING_PREVIEW_CHECKOUT,
  }));
  const previewPacks = (catalog?.packs || []).map((pack) => {
    const draft =
      PACK_PRICING_PREVIEW[pack.id as keyof typeof PACK_PRICING_PREVIEW];
    return {
      ...pack,
      priceMinor: draft?.vnd ?? null,
      credits: draft?.credits ?? null,
      checkoutAvailable: PRICING_PREVIEW_CHECKOUT,
    };
  });
  return (
    <section className="lm-billing">
      <div className="lm-billing-hero">
        <span className="lm-overline">LUMIO / {c.nav}</span>
        <h1>{c.title}</h1>
        <p>{c.intro}</p>
        <span className="lm-billing-badge">
          <LockKeyhole size={14} />
          {pc.badge}
        </span>
      </div>
      {error && (
        <p className="lm-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="lm-feedback" role="status">
          {notice}
        </p>
      )}
      <div className="lm-billing-wallet">
        <div>
          <Wallet size={22} />
          <span>
            {c.credits}
            <strong>
              {snapshot ? snapshot.account.balance.toLocaleString(locale) : "—"}
            </strong>
          </span>
        </div>
        <div>
          <span>
            {c.held}
            <strong>
              {snapshot
                ? snapshot.account.reserved.toLocaleString(locale)
                : "—"}
            </strong>
          </span>
        </div>
        <div>
          <span>
            {c.current}
            <strong>{snapshot?.account.planName || "Free"}</strong>
          </span>
        </div>
        {signedIn ? (
          <button
            className="lm-button"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} className={busy ? "lm-spin" : ""} />
            {c.refresh}
          </button>
        ) : (
          <button className="lm-button primary" onClick={login}>
            {c.signIn}
          </button>
        )}
      </div>
      <p className="lm-billing-ledger">{c.ledger}</p>
      <div
        className="lm-pricing-preview-notice"
        data-pricing-preview
        role="note"
      >
        <strong>
          <FlaskConical size={16} /> {pc.badge}
        </strong>
        <p>{pc.notice}</p>
      </div>
      <div className="lm-billing-interval" role="group" aria-label={c.nav}>
        <button
          aria-pressed={interval === "month"}
          onClick={() => setInterval("month")}
        >
          {c.monthly}
        </button>
        <button
          aria-pressed={interval === "year"}
          onClick={() => setInterval("year")}
        >
          {c.yearly}
        </button>
      </div>
      {interval === "year" && <p className="lm-help">{pc.annual}</p>}
      <div className="lm-pricing-grid">
        {previewPlans.map((p, index) => (
          <article
            key={p.id}
            className={`lm-plan ${p.id === "premium" ? "featured" : ""}`}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <span className="lm-plan-symbol">
              {p.id === "premium" ? <Crown /> : <Sparkles />}
            </span>
            <h2>{p.name}</h2>
            <strong className="lm-plan-price">
              {price(
                interval === "month" ? p.monthlyPriceMinor : p.yearlyPriceMinor,
              )}
            </strong>
            <small className="lm-plan-price-period">
              {interval === "month" ? pc.monthly : pc.yearly}
            </small>
            <p>
              {p.credits?.toLocaleString(locale)}{" "}
              {p.id === "free" ? pc.creditsOnce : pc.creditsMonthly}
            </p>
            <ul>
              {features(p).map((f) => (
                <li key={f}>
                  <Check size={14} />
                  {f}
                </li>
              ))}
            </ul>
            <button className="lm-button" onClick={() => setSelected(p)}>
              {snapshot?.account.planId === p.id ? c.current : c.compare}
              <ArrowUpRight size={16} />
            </button>
          </article>
        ))}
      </div>
      {snapshot?.sandbox && (
        <section className="lm-panel lm-billing-manage">
          <div>
            <span className="lm-overline">{c.sandbox}</span>
            <h2>
              {c.manage} · {snapshot.account.planName}
            </h2>
            <p>{c.noRenew}</p>
            {snapshot.account.periodEnd && (
              <p>
                {c.period}:{" "}
                {new Date(snapshot.account.periodEnd).toLocaleString(locale)}
              </p>
            )}
            {snapshot.account.cancelAtPeriodEnd && <p>{c.renewStopped}</p>}
          </div>
          <div className="lm-row">
            <button
              className="lm-button"
              disabled={busy}
              onClick={() =>
                setAction(
                  snapshot.account.cancelAtPeriodEnd ? "resume" : "cancel",
                )
              }
            >
              {snapshot.account.cancelAtPeriodEnd ? c.resume : c.cancel}
            </button>
            <button
              className="lm-button"
              disabled={busy}
              onClick={() => setAction("downgrade")}
            >
              {c.downgrade}
            </button>
          </div>
        </section>
      )}
      <div className="lm-billing-section">
        <h2>{c.packs}</h2>
        <p>{c.packIntro}</p>
        <div className="lm-credit-packs">
          {previewPacks.map((p, i) => (
            <button key={p.id} onClick={() => setSelected(p)}>
              <span className="lm-credit-orb">
                <Sparkles size={23} />
              </span>
              <strong>{[c.small, c.medium, c.large][i]}</strong>
              <span>
                {p.credits == null ? c.allocation : `${p.credits} credits`}
              </span>
              <b>{price(p.priceMinor)}</b>
              <small>{pc.pack}</small>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
        <p className="lm-help">{pc.tax}</p>
      </div>
      {rates && (
        <details className="lm-personal-details">
          <summary>{c.rates}</summary>
          <div className="lm-credit-calculator">
            <label>
              {c.activity}
              <select value={task} onChange={(e) => setTask(e.target.value)}>
                {Object.keys(rates.tasks).map((k) => (
                  <option key={k} value={k}>
                    {taskLabels[k] || c.unknown}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {c.modeLabel}
              <select
                value={effectiveMode}
                disabled={task !== "chat"}
                onChange={(e) => setMode(e.target.value)}
              >
                {Object.keys(rates.modes).map((k) => (
                  <option key={k} value={k}>
                    {modeLabels[k] || c.unknown}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {c.sourceLabel}
              <select
                value={effectiveKind}
                disabled={voiceTask}
                onChange={(e) => setKind(e.target.value)}
              >
                {(voiceTask ? [effectiveKind] : Object.keys(rates.kinds)).map(
                  (k) => (
                    <option key={k} value={k}>
                      {kindLabels[k] || c.unknown}
                    </option>
                  ),
                )}
              </select>
            </label>
            {effectiveKind === "video" && (
              <label>
                {c.video}
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(
                      Math.min(30, Math.max(1, Number(e.target.value) || 1)),
                    )
                  }
                />
              </label>
            )}
            <output>
              {estimate} <span>credits</span>
            </output>
          </div>
        </details>
      )}
      <section className="lm-billing-section">
        <h2>{c.history}</h2>
        <div className="lm-billing-table">
          <table>
            <thead>
              <tr>
                <th>{c.date}</th>
                <th>{c.activity}</th>
                <th>{c.units}</th>
                <th>{c.balance}</th>
              </tr>
            </thead>
            <tbody>
              {snapshot?.history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.createdAt).toLocaleString(locale)}</td>
                  <td>
                    {labels[h.kind] || c.unknown}
                    {h.kind === "reserve" && (
                      <small>
                        {c.held}: {h.reservedDelta}
                      </small>
                    )}
                  </td>
                  <td className={h.units > 0 ? "is-positive" : ""}>
                    {h.units > 0 ? "+" : ""}
                    {h.units}
                  </td>
                  <td>{h.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!snapshot?.history.length && <p>{c.none}</p>}
        </div>
        {signedIn && (
          <div className="lm-row">
            <button
              className="lm-button"
              disabled={page === 0 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              ←
            </button>
            <span>{page + 1}</span>
            <button
              className="lm-button"
              disabled={(snapshot?.history.length || 0) < 50 || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              →
            </button>
          </div>
        )}
      </section>
      <section className="lm-panel lm-billing-section">
        <h2>{c.invoices}</h2>
        <p>{c.noInvoices}</p>
      </section>
      {adminEnabled && snapshot && (
        <details className="lm-personal-details lm-billing-admin">
          <summary>
            <FlaskConical size={17} />
            {c.admin}
          </summary>
          <p>{c.adminHint}</p>
          <div className="lm-credit-calculator">
            <label>
              {c.current}
              <select
                value={previewPlan}
                onChange={(e) => setPreviewPlan(e.target.value as PlanId)}
              >
                {catalog?.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {c.amount}
              <input
                type="number"
                min={1}
                max={100000}
                value={previewCredits}
                onChange={(e) => setPreviewCredits(e.target.value)}
              />
            </label>
            <label>
              {c.days}
              <input
                type="number"
                min={1}
                max={30}
                value={previewDays}
                onChange={(e) => setPreviewDays(e.target.value)}
              />
            </label>
            <button
              className="lm-button"
              disabled={busy}
              onClick={() =>
                void mutate("/api/billing/admin", {
                  action: "sandbox_grant",
                  confirmSandbox: true,
                  userId: snapshot.account.userId,
                  requestId: crypto.randomUUID(),
                  planId: previewPlan,
                  credits: Number(previewCredits),
                  days: Number(previewDays),
                  reason:
                    "Chủ dự án chủ động thử quyền lợi Lumio trong môi trường local; không thu tiền.",
                })
              }
            >
              {c.grantButton}
            </button>
          </div>
        </details>
      )}
      {selected && (
        <Dialog
          title={c.checkout}
          close={() => setSelected(null)}
          label={c.close}
        >
          <div className="lm-checkout-review">
            <span className="lm-plan-symbol">
              <Crown />
            </span>
            <h2>{selected.name}</h2>
            <strong>
              {price(
                "entitlements" in selected
                  ? interval === "month"
                    ? selected.monthlyPriceMinor
                    : selected.yearlyPriceMinor
                  : selected.priceMinor,
              )}
            </strong>
            {"entitlements" in selected && (
              <ul>
                {features(selected).map((f) => (
                  <li key={f}>
                    <Check size={14} />
                    {f}
                  </li>
                ))}
              </ul>
            )}
            <p>{pc.notice}</p>
            <button
              className="lm-button primary"
              disabled={!PRICING_PREVIEW_CHECKOUT}
            >
              <LockKeyhole size={16} />
              {c.disabled}
            </button>
            <p className="lm-muted">{c.noRenew}</p>
          </div>
        </Dialog>
      )}
      {action && (
        <Dialog title={c.manage} close={() => setAction(null)} label={c.close}>
          <p>{c.cancelConfirm}</p>
          <p>
            <strong>
              {action === "cancel"
                ? c.cancel
                : action === "resume"
                  ? c.resume
                  : c.downgrade}
            </strong>
          </p>
          <button
            className="lm-button primary"
            disabled={busy}
            onClick={() =>
              void mutate("/api/billing/subscription", {
                requestId: crypto.randomUUID(),
                action,
                ...(action === "downgrade" ? { planId: "free" } : {}),
              })
            }
          >
            {c.confirmed}
          </button>
        </Dialog>
      )}
    </section>
  );
}
