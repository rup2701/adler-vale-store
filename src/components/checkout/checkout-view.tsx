"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cartActions, useCartState } from "@/components/cart/cart-store";
import { subtotalOf, usePricedCart } from "@/components/cart/use-priced-cart";
import { LineSummary, money } from "@/components/cart/line-item";
import { TotalsBlock } from "@/components/cart/totals";
import { computeTotals, type Fulfilment } from "@/lib/pricing";
import { validateCustomer, type CustomerInput, type FieldErrors } from "@/lib/checkout-schema";
import type { PricedLine } from "@/lib/cart-types";
import { settings } from "@/config/settings";

export type CheckoutStore = { id: number; name: string; address: string; pickupReady: string; note: string };

const FIELD_ORDER: (keyof CustomerInput | "storeId")[] = ["name", "email", "address1", "city", "state", "postalCode", "country", "storeId"];

export function CheckoutView({ stores }: { stores: CheckoutStore[] }) {
  const router = useRouter();
  const cart = useCartState();
  const { priced, status, refresh } = usePricedCart(cart.lines);
  const [fulfilment, setFulfilment] = useState<Fulfilment>("ship");
  const [storeId, setStoreId] = useState<number | null>(stores[0]?.id ?? null);
  const [values, setValues] = useState<CustomerInput>({
    name: "",
    email: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postalCode: "",
    country: settings.orders.countries[0],
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [banner, setBanner] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [serverIssues, setServerIssues] = useState<Record<string, string>>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const subtotal = subtotalOf(cart.lines, priced);
  const totals = computeTotals(subtotal, fulfilment);
  const selectedStore = stores.find((s) => s.id === storeId);
  const hasIssues = cart.lines.some((l) => priced[l.key]?.issue);

  useEffect(() => {
    if (Object.keys(errors).length) summaryRef.current?.focus();
  }, [errors]);
  useEffect(() => {
    if (banner) bannerRef.current?.focus();
  }, [banner]);

  const set = (k: keyof CustomerInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const issueMessages = useMemo(() => {
    const out: Record<string, string> = { ...serverIssues };
    for (const l of cart.lines) {
      const p = priced[l.key];
      if (p?.issue) out[l.key] = p.issue.message;
    }
    return out;
  }, [serverIssues, cart.lines, priced]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || done) return;
    setBanner(null);
    const fieldErrors = validateCustomer(values, fulfilment, storeId);
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    if (hasIssues) {
      setBanner({ kind: "error", text: "Some items in your cart can't be ordered. Remove them below to continue. Nothing was ordered." });
      return;
    }
    setSubmitting(true);
    try {
      const token = cartActions.ensureToken();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          fulfilment,
          storeId: fulfilment === "pickup" ? storeId : null,
          customer: values,
          lines: cart.lines.map((l) => ({
            productId: l.productId,
            slug: l.slug,
            optionValueIds: l.optionValueIds,
            personalization: l.personalization,
            quantity: l.quantity,
            seenUnitPriceCents: l.seenUnitPriceCents,
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setDone(true);
        cartActions.clearAfterOrder();
        router.push(`/order/${data.reference}`);
        return;
      }
      if (data?.kind === "validation") {
        setErrors(data.errors as FieldErrors);
      } else if (data?.kind === "issues") {
        const map: Record<string, string> = {};
        for (const l of data.lines as PricedLine[]) if (l.issue) map[l.key] = l.issue.message;
        setServerIssues(map);
        setBanner({ kind: "error", text: data.message });
        refresh();
      } else if (data?.kind === "price_changed") {
        const newPrices: Record<string, number> = {};
        for (const l of data.lines as PricedLine[]) if (!l.issue) newPrices[l.key] = l.unitPriceCents;
        cartActions.acknowledgePrices(newPrices);
        setBanner({ kind: "info", text: data.message });
      } else if (data?.kind === "empty") {
        setBanner({ kind: "error", text: data.message });
      } else {
        setBanner({
          kind: "error",
          text: data?.message ?? "Something went wrong placing your demo order. Nothing was charged. Please try again.",
        });
      }
    } catch {
      setBanner({ kind: "error", text: "Something went wrong placing your demo order. Nothing was charged. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="narrow-column px-4 py-20 text-center" role="status">
        <h1 className="text-3xl">Placing your demo order…</h1>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="narrow-column px-4 py-20 text-center sm:px-6" data-testid="checkout-empty">
        <h1 className="text-3xl">There&apos;s nothing to check out yet</h1>
        <p className="mt-3 text-muted-foreground">Add something to your cart and it will be waiting here.</p>
        <Link href="/shop" className={buttonVariants({ className: "mt-8" })}>
          Go to the shop
        </Link>
      </div>
    );
  }

  const errorEntries = FIELD_ORDER.filter((k) => errors[k]);
  const err = (k: keyof CustomerInput | "storeId") => errors[k];
  const fieldProps = (k: keyof CustomerInput | "storeId") => ({
    "aria-invalid": err(k) ? true : undefined,
    "aria-describedby": err(k) ? `err-${k}` : undefined,
  });
  const ErrorText = ({ k }: { k: keyof CustomerInput | "storeId" }) =>
    err(k) ? (
      <p id={`err-${k}`} className="mt-1 text-sm font-medium text-destructive" data-testid={`error-${k}`}>
        {err(k)}
      </p>
    ) : null;

  return (
    <div className="narrow-column px-4 pt-8 sm:px-6 md:pt-12">
      <h1 className="text-3xl md:text-4xl">Checkout</h1>
      <div className="mt-4 flex gap-3 border border-primary bg-[#f6ecee] p-4 text-sm" data-testid="demo-notice">
        <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          <strong>This checkout is a simulation.</strong> No payment is collected and no card details are requested. Placing the order creates
          a demo order only; nothing will be charged, shipped or emailed.
        </p>
      </div>

      {banner && (
        <div
          ref={bannerRef}
          tabIndex={-1}
          role="alert"
          data-testid="checkout-banner"
          className={`mt-4 flex gap-3 border p-4 text-sm ${banner.kind === "error" ? "border-destructive bg-[#fbeceb]" : "border-primary bg-[#f6ecee]"}`}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{banner.text}</p>
        </div>
      )}

      {errorEntries.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" data-testid="error-summary" className="mt-4 border border-destructive bg-[#fbeceb] p-4 text-sm">
          <h2 className="font-semibold">Please fix {errorEntries.length === 1 ? "this" : "these"} before placing your order</h2>
          <ul className="mt-2 list-disc pl-5">
            {errorEntries.map((k) => (
              <li key={k}>
                <a
                  href={`#field-${k}`}
                  className="underline underline-offset-4"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`field-${k}`)?.focus();
                  }}
                >
                  {err(k)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          <fieldset>
            <legend className="mb-3 text-xl font-serif">How would you like to receive it?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["ship", "Ship to me", "Flat-rate shipping (estimate)"],
                  ["pickup", "Pick up in store", "No shipping charge"],
                ] as const
              ).map(([value, title, sub]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer gap-3 border p-4 ${fulfilment === value ? "border-foreground bg-white" : "border-[#8a847c]"} focus-within:outline-2 focus-within:outline-primary`}
                >
                  <input
                    type="radio"
                    name="fulfilment"
                    value={value}
                    checked={fulfilment === value}
                    onChange={() => {
                      setFulfilment(value);
                      setErrors({});
                    }}
                    className="mt-1 accent-[#6e2a3a]"
                    disabled={value === "pickup" && stores.length === 0}
                  />
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="block text-sm text-muted-foreground">{sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 text-xl font-serif">Contact</legend>
            <div>
              <Label htmlFor="field-name">Full name</Label>
              <Input id="field-name" name="name" autoComplete="name" value={values.name} onChange={set("name")} {...fieldProps("name")} />
              <ErrorText k="name" />
            </div>
            <div>
              <Label htmlFor="field-email">Email</Label>
              <Input id="field-email" name="email" type="email" autoComplete="email" value={values.email} onChange={set("email")} {...fieldProps("email")} />
              <ErrorText k="email" />
            </div>
          </fieldset>

          {fulfilment === "ship" ? (
            <fieldset className="space-y-4" data-testid="ship-fields">
              <legend className="mb-1 text-xl font-serif">Shipping address</legend>
              <div>
                <Label htmlFor="field-address1">Street address</Label>
                <Input id="field-address1" name="address1" autoComplete="address-line1" value={values.address1} onChange={set("address1")} {...fieldProps("address1")} />
                <ErrorText k="address1" />
              </div>
              <div>
                <Label htmlFor="field-address2">Apartment, suite, etc. (optional)</Label>
                <Input id="field-address2" name="address2" autoComplete="address-line2" value={values.address2} onChange={set("address2")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="field-city">City</Label>
                  <Input id="field-city" name="city" autoComplete="address-level2" value={values.city} onChange={set("city")} {...fieldProps("city")} />
                  <ErrorText k="city" />
                </div>
                <div>
                  <Label htmlFor="field-state">State / region</Label>
                  <Input id="field-state" name="state" autoComplete="address-level1" value={values.state} onChange={set("state")} {...fieldProps("state")} />
                  <ErrorText k="state" />
                </div>
                <div>
                  <Label htmlFor="field-postalCode">ZIP / postal code</Label>
                  <Input id="field-postalCode" name="postalCode" autoComplete="postal-code" inputMode="numeric" value={values.postalCode} onChange={set("postalCode")} {...fieldProps("postalCode")} />
                  <ErrorText k="postalCode" />
                </div>
                <div>
                  <Label htmlFor="field-country">Country</Label>
                  <Select id="field-country" name="country" autoComplete="country-name" value={values.country} onChange={set("country")} {...fieldProps("country")}>
                    {settings.orders.countries.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                  <ErrorText k="country" />
                </div>
              </div>
            </fieldset>
          ) : (
            <fieldset className="space-y-3" data-testid="pickup-fields">
              <legend className="mb-1 text-xl font-serif">Pickup store</legend>
              <div>
                <Label htmlFor="field-storeId">Choose a store</Label>
                <Select
                  id="field-storeId"
                  name="storeId"
                  value={storeId ?? ""}
                  onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
                  {...fieldProps("storeId")}
                >
                  <option value="">Select a store</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <ErrorText k="storeId" />
              </div>
              {selectedStore && (
                <p className="text-sm text-muted-foreground" data-testid="pickup-ready">
                  {selectedStore.address}. {selectedStore.pickupReady || "We'll let you know when it's ready."}
                </p>
              )}
            </fieldset>
          )}
        </div>

        <aside aria-labelledby="co-summary" className="h-fit bg-muted p-5">
          <h2 id="co-summary" className="mb-4 text-xl">
            Order summary
          </h2>
          {status === "error" && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              We couldn&apos;t load your items&apos; details.{" "}
              <button type="button" className="underline" onClick={refresh}>
                Try again
              </button>
            </p>
          )}
          <ul className="divide-y" data-testid="summary-lines">
            {cart.lines.map((l) => {
              const p = priced[l.key];
              const msg = issueMessages[l.key];
              return (
                <li key={l.key} className="py-3" data-testid="summary-line">
                  {p ? (
                    <>
                      <div className="flex justify-between gap-3">
                        <LineSummary line={p} quantity={l.quantity} />
                        <p className="shrink-0 text-sm">{p.issue ? "" : money(p.unitPriceCents * l.quantity)}</p>
                      </div>
                      {msg && (
                        <div role="alert" data-testid="checkout-line-issue" className="mt-2 border-l-4 border-destructive bg-[#fbeceb] p-2 text-sm">
                          <p>{msg}</p>
                          <div className="mt-1 flex gap-3">
                            <button
                              type="button"
                              className="underline underline-offset-4"
                              data-testid="issue-remove"
                              onClick={() => {
                                cartActions.remove(l.key);
                                setServerIssues((s) => {
                                  const { [l.key]: _gone, ...rest } = s;
                                  return rest;
                                });
                                setBanner(null);
                              }}
                            >
                              Remove {p.name} and continue
                            </button>
                            {p.issue && p.issue.maxQuantity > 0 && (
                              <button
                                type="button"
                                className="underline underline-offset-4"
                                onClick={() => cartActions.setQuantity(l.key, p.issue!.maxQuantity)}
                              >
                                Reduce to {p.issue.maxQuantity}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading item…</p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-4">
            <TotalsBlock totals={totals} fulfilment={fulfilment} />
          </div>
          <Button type="submit" size="lg" className="mt-5 w-full" disabled={submitting || status !== "ready"} data-testid="place-order">
            {submitting ? "Placing demo order…" : "Place demo order"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            No payment is collected. See our{" "}
            <Link href="/returns" className="underline underline-offset-4">
              returns &amp; refunds policy
            </Link>
            .
          </p>
        </aside>
      </form>
    </div>
  );
}
