import { settings } from "@/config/settings";

export type Fulfilment = "ship" | "pickup";

export type Totals = {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  freeShipping: boolean;
  /** How much more the shopper must spend for free shipping (0 when already free or pickup). */
  awayFromFreeShippingCents: number;
};

/**
 * The one function that computes shipping, tax and totals. The cart, the checkout and the saved
 * order all use it, so they cannot disagree. Shipping and tax are demo estimates.
 */
export function computeTotals(subtotalCents: number, fulfilment: Fulfilment): Totals {
  const o = settings.orders;
  const freeShipping = subtotalCents > o.freeShippingOverCents;
  const shippingCents = subtotalCents === 0 || fulfilment === "pickup" || freeShipping ? 0 : o.shippingFlatCents;
  const taxCents = Math.round(subtotalCents * o.taxRate);
  return {
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents: subtotalCents + shippingCents + taxCents,
    freeShipping,
    awayFromFreeShippingCents:
      fulfilment === "ship" && !freeShipping && subtotalCents > 0 ? o.freeShippingOverCents + 1 - subtotalCents : 0,
  };
}
