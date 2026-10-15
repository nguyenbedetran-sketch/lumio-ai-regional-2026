import {
  CREDIT_PACK_IDS,
  CREDIT_RATES,
  PLAN_DEFINITIONS,
  TRIAL_CREDITS,
} from "./billing-types";

/** Public competition preview: no accounts, paid providers or server-side user data. */
export const isPublicDemo = () => process.env.LUMIO_PUBLIC_DEMO === "true";
export function publicDemoConfig() {
  return {
    publicDemo: true,
    storage: "browser",
    google: false,
    facebook: false,
    ai: false,
    capabilities: {
      tutor: false,
      summary: false,
      media: false,
      transcription: false,
      speech: false,
    },
  };
}
export function publicDemoCatalog() {
  return {
    publicDemo: true,
    plans: Object.entries(PLAN_DEFINITIONS).map(([id, definition]) => ({
      id,
      ...definition,
      currency: "VND",
      monthlyPriceMinor: id === "free" ? 0 : null,
      yearlyPriceMinor: id === "free" ? 0 : null,
      credits: id === "free" ? TRIAL_CREDITS : null,
      creditsPeriod: id === "free" ? "one_time_trial" : "month",
      checkoutAvailable: false,
    })),
    packs: CREDIT_PACK_IDS.map((id, index) => ({
      id,
      name: ["Small", "Medium", "Large"][index],
      credits: null,
      priceMinor: null,
      currency: "VND",
      checkoutAvailable: false,
    })),
    rates: CREDIT_RATES,
    pricingStatus: "pending_configuration",
    paymentProviderConfigured: false,
    currency: "VND",
    trialCredits: TRIAL_CREDITS,
  };
}
/** Shared by middleware and native route handlers so disabling middleware cannot enable APIs. */
export function demoAPIResponse(
  pathname: string,
  method: string,
): Response | null {
  if (!isPublicDemo()) return null;
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (method === "GET") {
    if (pathname === "/api/config")
      return Response.json(publicDemoConfig(), { headers });
    if (pathname === "/api/billing/catalog")
      return Response.json(publicDemoCatalog(), { headers });
    if (["/api/auth/session", "/api/auth/providers"].includes(pathname))
      return Response.json({}, { headers });
  }
  return Response.json({ error: "PUBLIC_DEMO_ONLY" }, { status: 403, headers });
}
