import { settings } from "@/config/settings";
import { formatCentsExact } from "@/lib/money";
import type { Totals, Fulfilment } from "@/lib/pricing";

/** The same totals block on the cart, the checkout and the confirmation, so they always agree. */
export function TotalsBlock({ totals, fulfilment, showFreeHint = true }: { totals: Totals; fulfilment: Fulfilment; showFreeHint?: boolean }) {
  return (
    <dl className="space-y-2 text-sm" data-testid="totals">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd data-testid="subtotal">{formatCentsExact(totals.subtotalCents)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>{fulfilment === "pickup" ? "Shipping (pickup, no charge)" : "Shipping (estimate)"}</dt>
        <dd data-testid="shipping">{totals.shippingCents === 0 ? "Free" : formatCentsExact(totals.shippingCents)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>Estimated tax (demo estimate)</dt>
        <dd data-testid="tax">{formatCentsExact(totals.taxCents)}</dd>
      </div>
      <div className="flex justify-between border-t pt-2 text-base font-semibold">
        <dt>Estimated total</dt>
        <dd data-testid="total">{formatCentsExact(totals.totalCents)}</dd>
      </div>
      {showFreeHint && totals.awayFromFreeShippingCents > 0 && (
        <p className="pt-1 text-xs text-muted-foreground" data-testid="free-shipping-hint">
          Add {formatCentsExact(totals.awayFromFreeShippingCents)} more for free shipping (orders over {formatCentsExact(settings.orders.freeShippingOverCents)}). Pickup in store is always free.
        </p>
      )}
      <p className="pt-1 text-xs text-muted-foreground">Shipping and tax are demo values, not real charges.</p>
    </dl>
  );
}
