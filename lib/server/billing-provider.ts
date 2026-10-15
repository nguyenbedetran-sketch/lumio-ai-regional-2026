import { PlatformError } from "./types";

/** Only a verified payment webhook may activate paid subscriptions in a future adapter.
 * Keeping this adapter explicit prevents a checkout button from granting access locally. */
export const paymentAdapter = {
  id: "unconfigured" as const,
  configured: false,
  async createCheckout(_input: {
    userId: string;
    itemId: string;
    interval: "month" | "year";
  }) {
    throw new PlatformError("PAYMENT_PROVIDER_NOT_CONFIGURED", 503);
  },
};
