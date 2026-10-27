export type CartLine = {
  key: string;
  productId: number;
  slug: string;
  /** Chosen option value ids (at most one per option). */
  optionValueIds: number[];
  /** Normalised personalization text, "" when none. */
  personalization: string;
  quantity: number;
  /** The unit price the shopper last saw, to detect price changes. */
  seenUnitPriceCents: number;
};

export type CartLineIssue = {
  code: "unavailable" | "sold_out" | "insufficient" | "invalid";
  message: string;
  /** The most that can be bought right now (0 = remove the line). */
  maxQuantity: number;
};

export type PricedLine = {
  key: string;
  productId: number;
  slug: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  imageAlt: string;
  options: { option: string; value: string }[];
  personalization: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  seenUnitPriceCents: number;
  priceChanged: boolean;
  chosenValueIds: number[];
  trackedValueIds: number[];
  issue: CartLineIssue | null;
};

export function cartLineKey(productId: number, optionValueIds: number[], personalization: string): string {
  return `${productId}|${[...optionValueIds].sort((a, b) => a - b).join(".")}|${personalization}`;
}
