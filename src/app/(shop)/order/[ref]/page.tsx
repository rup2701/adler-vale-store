import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByReference } from "@/lib/checkout";
import { TotalsBlock } from "@/components/cart/totals";
import { LineSummary, money } from "@/components/cart/line-item";
import { buttonVariants } from "@/components/ui/button";
import { Info } from "lucide-react";

export const metadata: Metadata = { title: "Order confirmation (demo)", robots: { index: false } };

/** Read-only: viewing or refreshing this page never creates an order. */
export default async function OrderPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const found = await getOrderByReference(decodeURIComponent(ref));
  if (!found) notFound();
  const { order, items } = found;
  const pickup = order.fulfilment === "pickup";

  return (
    <div className="narrow-column px-4 pt-8 sm:px-6 md:pt-12">
      <p className="eyebrow text-success">Order placed</p>
      <h1 className="mt-1 text-3xl md:text-4xl">Thank you, {order.customerName.split(" ")[0]}. Your demo order is confirmed.</h1>
      <p className="mt-4 text-lg">
        Order reference: <strong data-testid="order-reference" className="font-mono tracking-wider">{order.reference}</strong>
      </p>
      <div className="mt-4 flex gap-3 border border-primary bg-[#f6ecee] p-4 text-sm" data-testid="demo-order-notice">
        <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          <strong>This is a demo order.</strong> No payment was collected, nothing will be shipped or made ready for pickup, and no
          confirmation email is sent. Keep your reference if you want to mention it to the studio.
        </p>
      </div>

      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="items-heading">
          <h2 id="items-heading" className="mb-3 text-xl">Items</h2>
          <ul className="divide-y border-y" data-testid="order-items">
            {items.map((it) => (
              <li key={it.id} className="flex justify-between gap-4 py-4" data-testid="order-item">
                <LineSummary
                  line={{
                    name: it.productName,
                    brandName: it.brandName,
                    imageUrl: null,
                    imageAlt: "",
                    options: it.options,
                    personalization: it.personalization,
                    slug: "",
                  }}
                  quantity={it.quantity}
                />
                <div className="shrink-0 text-right text-sm">
                  <p>{money(it.unitPriceCents)} each</p>
                  <p className="font-medium">{money(it.lineTotalCents)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <aside className="space-y-6">
          <section aria-labelledby="totals-heading" className="bg-muted p-5">
            <h2 id="totals-heading" className="mb-3 text-xl">Totals</h2>
            <TotalsBlock
              totals={{
                subtotalCents: order.subtotalCents,
                shippingCents: order.shippingCents,
                taxCents: order.taxCents,
                totalCents: order.totalCents,
                freeShipping: order.shippingCents === 0,
                awayFromFreeShippingCents: 0,
              }}
              fulfilment={pickup ? "pickup" : "ship"}
              showFreeHint={false}
            />
          </section>
          <section aria-labelledby="delivery-heading" className="text-sm">
            <h2 id="delivery-heading" className="mb-2 text-xl">{pickup ? "Pickup" : "Shipping to"}</h2>
            {pickup ? (
              <p data-testid="order-pickup">
                {order.pickupStoreName}
                {order.pickupReady ? `. ${order.pickupReady}` : ""}
              </p>
            ) : (
              <address className="not-italic" data-testid="order-address">
                {order.customerName}
                <br />
                {order.address1}
                {order.address2 ? <><br />{order.address2}</> : null}
                <br />
                {order.city}, {order.state} {order.postalCode}
                <br />
                {order.country}
              </address>
            )}
            <p className="mt-2 text-muted-foreground">{order.customerEmail}</p>
          </section>
        </aside>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/shop" className={buttonVariants()}>
          Continue shopping
        </Link>
        <Link href="/returns" className={buttonVariants({ variant: "outline" })}>
          Returns &amp; refunds
        </Link>
      </div>
    </div>
  );
}
