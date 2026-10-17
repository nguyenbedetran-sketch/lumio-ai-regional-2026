import type { BillingMode } from "./billing-types";
import type { PaidModelContext } from "../billing/paid-policy";
/** Server configuration only. Never copies model/provider identifiers from request JSON. */
export function configuredPaidModelPolicy(mode: BillingMode, version: string): PaidModelContext {
  const models: PaidModelContext["models"] = [];
  for (const provider of ["openai", "gemini"] as const) {
    const prefix = provider.toUpperCase(), key = process.env[`${prefix}_API_KEY`], model = process.env[`${prefix}_MODEL_${mode.toUpperCase()}`] || process.env[`${prefix}_MODEL`];
    if (key && model && model !== key && model.length <= 200 && /^[\w.:-]+$/.test(model) && !/^(?:sk-|AIza|xai-)/i.test(model)) models.push({ provider, model });
  }
  return { version, mode, models };
}
export function configuredPaidAliases() {
  return (["quick", "tutor", "think", "deep"] as const).map(mode => ({ mode, configuredProviders: configuredPaidModelPolicy(mode, "registry").models.length }));
}
