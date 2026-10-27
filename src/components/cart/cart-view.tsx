"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cartActions, useCartState } from "@/components/cart/cart-store";
import { subtotalOf, usePricedCart } from "@/components/cart/use-priced-cart";
import { LineSummary, money } from "@/components/cart/line-item";
import { TotalsBlock } from "@/components/cart/totals";
import { computeTotals } from "@/lib/pricing";
import { settings } from "@/config/settings";

export function CartView() {
  const cart = useCartState();
  const { priced, status, refresh } = usePricedCart(cart.lines);
  const [announcement, setAnnouncement] = useState("");
  const [notices, setNotices] = useState<Record<string, { from: number; to: number }>>({});
  const noticed = useRef<Set<string>>(new Set());
  const max = settings.orders.maxQuantityPerLine;

  // E-012 / E-034: when the server price differs from the price the shopper last saw, say so and show the new price.
  useEffect(() => {
    const changed: Record<string, number> = {};
    const fresh: Record<string, { from: number; to: number }> = {};
    for (const l of cart.lines) {
      const p = priced[l.key];
      if (p && p.priceChanged && !p.issue && !noticed.current.has(l.key)) {
        noticed.current.add(l.key);
        fresh[l.key] = { from: l.seenUnitPriceCents, to: p.unitPriceCents };
        changed[l.key] = p.unitPriceCents;
      }
    }
    if (Object.keys(fresh).length) {
      setNotices((n) => ({ ...n, ...fresh }));
      cartActions.acknowledgePrices(changed);
    }
  }, [priced, cart.lines]);

  const subtotal = subtotalOf(cart.lines, priced);
  const totals = computeTotals(subtotal, "ship");
  const count = cart.lines.reduce((n, l) => n + l.quantity, 0);

  if (cart.lines.length === 0) {
    return (
      <div className="narrow-column px-4 py-20 text-center sm:px-6" data-testid="empty-cart">
        <h1 className="text-3xl">Your cart is empty</h1>
        <p className="mt-3 text-muted-foreground">When you find something you love, it will wait for you here.</p>
        <Link href="/shop" className={buttonVariants({ className: "mt-8" })}>
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="narrow-column px-4 pt-8 sm:px-6 md:pt-12">
      <h1 className="text-3xl md:text-4xl">Your cart</h1>
      <p className="mt-1 text-sm text-muted-foreground" data-testid="cart-item-count">
        {count} {count === 1 ? "item" : "items"}
      </p>
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      {status === "error" && (
        <p role="alert" className="mt-4 border border-destructive bg-[#fbeceb] p-3 text-sm">
          We couldn&apos;t refresh prices just now. Your items are saved.{" "}
          <button type="button" className="underline underline-offset-4" onClick={refresh}>
            Try again
          </button>
        </p>
      )}

      <div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,1fr)_20rem]">
        <ul className="divide-y border-y" data-testid="cart-lines">
          {cart.lines.map((l) => {
            const p = priced[l.key];
            const notice = notices[l.key];
            return (
              <li key={l.key} className="py-5" data-testid="cart-line">
                {p ? (
                  <>
                    <div className="flex justify-between gap-4">
                      <LineSummary line={p} />
                      <p className="shrink-0 text-sm" data-testid="unit-price">
                        {p.issue ? "" : money(p.unitPriceCents)}
                      </p>
                    </div>
                    {notice && (
                      <p role="status" data-testid="price-changed-notice" className="mt-2 border-l-4 border-primary bg-[#f6ecee] p-2 text-sm">
                        The price of this item changed from {money(notice.from)} to {money(notice.to)}. Your cart shows the new price.
                      </p>
                    )}
                    {p.issue && (
                      <p role="alert" data-testid="line-issue" className="mt-2 border-l-4 border-destructive bg-[#fbeceb] p-2 text-sm">
                        {p.issue.message}{" "}
                        {p.issue.maxQuantity > 0 ? (
                          <button
                            type="button"
                            className="underline underline-offset-4"
                            onClick={() => cartActions.setQuantity(l.key, p.issue!.maxQuantity)}
                          >
                            Reduce to {p.issue.maxQuantity}
                          </button>
                        ) : (
                          <span>Remove it to continue.</span>
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading item…</p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center" role="group" aria-label={`Quantity for ${p?.name ?? "item"}`}>
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center border border-[#8a847c] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      aria-label={`Decrease quantity${p ? ` of ${p.name}` : ""}`}
                      disabled={l.quantity <= 1}
                      data-testid="qty-decrease"
                      onClick={() => {
                        cartActions.setQuantity(l.key, l.quantity - 1);
                        setAnnouncement(`Quantity set to ${l.quantity - 1}`);
                      }}
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="flex h-10 w-12 items-center justify-center border-y border-[#8a847c] text-sm" data-testid="qty-value" aria-label="Quantity">
                      {l.quantity}
                    </span>
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center border border-[#8a847c] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      aria-label={`Increase quantity${p ? ` of ${p.name}` : ""}`}
                      disabled={l.quantity >= max}
                      data-testid="qty-increase"
                      onClick={() => {
                        cartActions.setQuantity(l.key, l.quantity + 1);
                        setAnnouncement(`Quantity set to ${l.quantity + 1}`);
                      }}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {l.quantity >= max && (
                      <span className="ml-3 text-xs text-muted-foreground" data-testid="max-note">
                        Maximum of {max} per item
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="text-sm underline underline-offset-4 hover:text-primary cursor-pointer"
                      data-testid="remove-line"
                      onClick={() => {
                        cartActions.remove(l.key);
                        setAnnouncement(`${p?.name ?? "Item"} removed from your cart`);
                      }}
                    >
                      Remove<span className="visually-hidden"> {p?.name}</span>
                    </button>
                    <p className="min-w-20 text-right text-sm font-medium" data-testid="line-total">
                      {p && !p.issue ? money(p.unitPriceCents * l.quantity) : "—"}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside aria-labelledby="summary-heading" className="h-fit bg-muted p-5">
          <h2 id="summary-heading" className="mb-4 text-xl">
            Order summary
          </h2>
          <TotalsBlock totals={totals} fulfilment="ship" />
          <Link
            href="/checkout"
            data-testid="checkout-link"
            className={buttonVariants({ size: "lg", className: "mt-5 w-full" })}
          >
            Proceed to checkout
          </Link>
          <Button asChild variant="link" className="mt-2 w-full">
            <Link href="/shop">Continue shopping</Link>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Checkout is a simulation: no payment is collected. Read our{" "}
            <Link href="/returns" className="underline underline-offset-4">
              returns &amp; refunds policy
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
