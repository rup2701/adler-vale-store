"use client";
import { useCallback, useEffect, useState } from "react";
import type { CartLine, PricedLine } from "@/lib/cart-types";

export type PricedStatus = "loading" | "ready" | "error";

/** Asks the server to price the browser cart. The browser's own idea of prices is never trusted. */
export function usePricedCart(lines: CartLine[]) {
  const [priced, setPriced] = useState<Record<string, PricedLine>>({});
  const [status, setStatus] = useState<PricedStatus>(lines.length ? "loading" : "ready");
  const [nonce, setNonce] = useState(0);
  const sig = JSON.stringify(lines.map((l) => [l.productId, l.optionValueIds, l.personalization, l.quantity, l.seenUnitPriceCents]));

  useEffect(() => {
    if (lines.length === 0) {
      setPriced({});
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    fetch("/api/cart/price", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lines: lines.map((l) => ({
          productId: l.productId,
          slug: l.slug,
          optionValueIds: l.optionValueIds,
          personalization: l.personalization,
          quantity: l.quantity,
          seenUnitPriceCents: l.seenUnitPriceCents,
        })),
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("price request failed");
        const data = (await res.json()) as { lines: PricedLine[] };
        if (cancelled) return;
        const map: Record<string, PricedLine> = {};
        for (const p of data.lines) map[p.key] = p;
        setPriced(map);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { priced, status, refresh };
}

/** Sum of the lines that can be bought, using the quantity currently in the cart and the server's price. */
export function subtotalOf(lines: CartLine[], priced: Record<string, PricedLine>): number {
  return lines.reduce((sum, l) => {
    const p = priced[l.key];
    return p && !p.issue ? sum + p.unitPriceCents * l.quantity : sum;
  }, 0);
}
