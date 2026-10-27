import { randomInt } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { settings } from "@/config/settings";
import { priceLines } from "@/lib/cart-pricing";
import { computeTotals, type Totals } from "@/lib/pricing";
import { checkoutSchema, validateCustomer, type FieldErrors } from "@/lib/checkout-schema";
import type { PricedLine } from "@/lib/cart-types";

export const CHECKOUT_FAILURE_MESSAGE =
  "Something went wrong placing your demo order. Nothing was charged. Please try again.";

export type CheckoutResult =
  | { ok: true; reference: string }
  | { ok: false; kind: "invalid_request"; message: string }
  | { ok: false; kind: "empty"; message: string }
  | { ok: false; kind: "validation"; errors: FieldErrors }
  | { ok: false; kind: "issues"; lines: PricedLine[]; totals: Totals; message: string }
  | { ok: false; kind: "price_changed"; lines: PricedLine[]; totals: Totals; message: string }
  | { ok: false; kind: "error"; message: string };

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newReference() {
  let out = "";
  for (let i = 0; i < 6; i++) out += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `${settings.orders.referencePrefix}-${out}`;
}

class StockConflict extends Error {}

export async function placeOrder(raw: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, kind: "invalid_request", message: "That request could not be read. Please reload the page and try again." };
  }
  const input = parsed.data;
  try {
    // The same one-time token always returns the same order (double clicks, retries, back and resubmit).
    const [existing] = await db.select({ reference: s.orders.reference }).from(s.orders).where(eq(s.orders.token, input.token));
    if (existing) return { ok: true, reference: existing.reference };

    if (input.lines.length === 0) {
      return { ok: false, kind: "empty", message: "There's nothing to check out yet." };
    }

    const errors = validateCustomer(input.customer, input.fulfilment, input.storeId);
    if (Object.keys(errors).length) return { ok: false, kind: "validation", errors };

    let store: typeof s.stores.$inferSelect | undefined;
    if (input.fulfilment === "pickup") {
      [store] = await db.select().from(s.stores).where(eq(s.stores.id, input.storeId!));
      if (!store || !store.pickup) {
        return { ok: false, kind: "validation", errors: { storeId: "That store isn't offering pickup right now. Please choose another." } };
      }
    }

    const priced = await priceLines(input.lines.map((l) => ({ ...l, slug: l.slug })));
    const totals = computeTotals(
      priced.reduce((sum, l) => sum + (l.issue ? 0 : l.lineTotalCents), 0),
      input.fulfilment,
    );
    const bad = priced.filter((l) => l.issue);
    if (bad.length) {
      return {
        ok: false,
        kind: "issues",
        lines: priced,
        totals,
        message: `${bad[0].issue!.message} Nothing was ordered. Remove or change it to continue.`,
      };
    }
    const changed = priced.filter((l) => l.priceChanged);
    if (changed.length) {
      return {
        ok: false,
        kind: "price_changed",
        lines: priced,
        totals,
        message: "A price changed since you added it. Please review your order and place it again. Nothing was ordered.",
      };
    }

    const reference = await db
      .transaction(async (tx) => {
        let ref = newReference();
        for (let i = 0; i < 5; i++) {
          const [clash] = await tx.select({ id: s.orders.id }).from(s.orders).where(eq(s.orders.reference, ref));
          if (!clash) break;
          ref = newReference();
        }
        const c = input.customer;
        const ship = input.fulfilment === "ship";
        const [order] = await tx
          .insert(s.orders)
          .values({
            reference: ref,
            token: input.token,
            fulfilment: input.fulfilment,
            customerName: c.name,
            customerEmail: c.email,
            address1: ship ? c.address1 : "",
            address2: ship ? c.address2 : "",
            city: ship ? c.city : "",
            state: ship ? c.state : "",
            postalCode: ship ? c.postalCode : "",
            country: ship ? c.country : "",
            pickupStoreId: store?.id ?? null,
            pickupStoreName: store?.name ?? "",
            pickupReady: store?.pickupReady ?? "",
            subtotalCents: totals.subtotalCents,
            shippingCents: totals.shippingCents,
            taxCents: totals.taxCents,
            totalCents: totals.totalCents,
          })
          .onConflictDoNothing({ target: s.orders.token })
          .returning({ id: s.orders.id, reference: s.orders.reference });

        if (!order) {
          // A concurrent submit with the same token won; return its order.
          const [won] = await tx.select({ reference: s.orders.reference }).from(s.orders).where(eq(s.orders.token, input.token));
          return won.reference;
        }

        for (const line of priced) {
          for (const valueId of line.trackedValueIds) {
            const res = await tx
              .update(s.productOptionValues)
              .set({ stock: sql`${s.productOptionValues.stock} - ${line.quantity}` })
              .where(and(eq(s.productOptionValues.id, valueId), gte(s.productOptionValues.stock, line.quantity)))
              .returning({ id: s.productOptionValues.id });
            if (res.length === 0) throw new StockConflict(line.key);
          }
          if (line.trackedValueIds.length) {
            await tx.execute(sql`
              UPDATE products SET stock = (
                SELECT COALESCE(SUM(v.stock), 0) FROM product_option_values v
                JOIN product_options o ON o.id = v.option_id
                WHERE o.product_id = products.id AND o.tracks_stock
              ), updated_at = now() WHERE id = ${line.productId}`);
          } else {
            const res = await tx
              .update(s.products)
              .set({ stock: sql`${s.products.stock} - ${line.quantity}`, updatedAt: new Date() })
              .where(and(eq(s.products.id, line.productId), gte(s.products.stock, line.quantity)))
              .returning({ id: s.products.id });
            if (res.length === 0) throw new StockConflict(line.key);
          }
          await tx.insert(s.orderItems).values({
            orderId: order.id,
            productId: line.productId,
            productName: line.name,
            brandName: line.brandName,
            options: line.options,
            personalization: line.personalization,
            unitPriceCents: line.unitPriceCents,
            quantity: line.quantity,
            lineTotalCents: line.lineTotalCents,
          });
        }
        return order.reference;
      })
      .catch(async (e) => {
        if (e instanceof StockConflict) return e;
        throw e;
      });

    if (reference instanceof StockConflict) {
      const again = await priceLines(input.lines.map((l) => ({ ...l, slug: l.slug })));
      const bad2 = again.filter((l) => l.issue);
      return {
        ok: false,
        kind: "issues",
        lines: again,
        totals: computeTotals(again.reduce((sum, l) => sum + (l.issue ? 0 : l.lineTotalCents), 0), input.fulfilment),
        message: bad2.length
          ? `${bad2[0].issue!.message} Nothing was ordered.`
          : "An item sold out while you were checking out. Nothing was ordered. Please try again.",
      };
    }
    return { ok: true, reference };
  } catch (e) {
    console.error("[checkout] failed", e);
    try {
      await db.insert(s.systemEvents).values({
        kind: "checkout_failed",
        message: `A shopper's checkout failed: ${e instanceof Error ? e.message : String(e)}. Nothing was charged and no order was created. Check the database status below and ask the shopper to try again.`.slice(0, 500),
      });
    } catch {
      /* the database itself may be down */
    }
    return { ok: false, kind: "error", message: CHECKOUT_FAILURE_MESSAGE };
  }
}

export async function getOrderByReference(reference: string) {
  const ref = reference.trim().toUpperCase();
  const [order] = await db.select().from(s.orders).where(eq(s.orders.reference, ref));
  if (!order) return null;
  const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, order.id)).orderBy(s.orderItems.id);
  return { order, items };
}
