"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cartActions } from "@/components/cart/cart-store";
import { formatCents } from "@/lib/money";
import { checkPersonalization, normalizePersonalization } from "@/lib/personalization";
import { settings } from "@/config/settings";
import { cn } from "@/lib/utils";
import type { ProductOptionData } from "@/lib/catalog";

type BuyProduct = {
  id: number;
  slug: string;
  name: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  personalizable: boolean;
  personalizationLabel: string;
  personalizationMaxLength: number;
};
type BuyStore = { id: number; name: string; pickupReady: string; note: string };

const valueSoldOut = (o: ProductOptionData, v: ProductOptionData["values"][number]) => o.tracksStock && v.stock <= 0;

export function BuyBox({ product, options, stores }: { product: BuyProduct; options: ProductOptionData[]; stores: BuyStore[] }) {
  const maxPerLine = settings.orders.maxQuantityPerLine;
  const soldOutEntirely = product.stock <= 0 || options.some((o) => o.tracksStock && o.values.every((v) => v.stock <= 0));

  const [selected, setSelected] = useState<Record<number, number | null>>(() => {
    const init: Record<number, number | null> = {};
    for (const o of options) {
      const def = o.defaultValue ? o.values.find((v) => v.value === o.defaultValue) : undefined;
      init[o.id] = def && !valueSoldOut(o, def) ? def.id : null;
    }
    return init;
  });
  const [quantity, setQuantity] = useState(1);
  const [personalization, setPersonalization] = useState("");
  const [optionErrors, setOptionErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ summary: string; quantity: number } | null>(null);
  const personalizationRef = useRef<HTMLInputElement>(null);

  const chosen = options
    .map((o) => ({ option: o, value: o.values.find((v) => v.id === selected[o.id]) }))
    .filter((c): c is { option: ProductOptionData; value: ProductOptionData["values"][number] } => !!c.value);

  const unitPrice = product.priceCents + chosen.reduce((sum, c) => sum + c.value.priceAdjustCents, 0);
  const trackedChoice = chosen.find((c) => c.option.tracksStock);
  const available = trackedChoice ? trackedChoice.value.stock : product.stock;
  const maxQty = Math.max(1, Math.min(maxPerLine, available));
  const qty = Math.min(quantity, maxQty);

  const personalizationCheck = useMemo(
    () =>
      product.personalizable
        ? checkPersonalization(personalization, product.personalizationMaxLength, product.personalizationLabel)
        : ({ ok: true, value: "" } as const),
    [personalization, product],
  );

  const missingTracked = options.some((o) => o.tracksStock && selected[o.id] == null);

  function choose(o: ProductOptionData, v: ProductOptionData["values"][number]) {
    setAdded(null);
    setFormError(null);
    if (valueSoldOut(o, v)) {
      setOptionErrors((e) => ({
        ...e,
        [o.id]: `${o.name} ${v.value} is sold out. Your other choices are kept. Please choose another ${o.name.toLowerCase()}.`,
      }));
      return;
    }
    setOptionErrors((e) => {
      const { [o.id]: _removed, ...rest } = e;
      return rest;
    });
    setSelected((s) => ({ ...s, [o.id]: s[o.id] === v.id && !o.required ? null : v.id }));
  }

  function addToCart() {
    setAdded(null);
    setFormError(null);
    const errors: Record<number, string> = {};
    for (const o of options) {
      if (o.required && selected[o.id] == null) errors[o.id] = `Please choose a ${o.name.toLowerCase()} before adding to your cart.`;
    }
    if (Object.keys(errors).length) {
      setOptionErrors(errors);
      const first = options.find((o) => errors[o.id]);
      if (first) requestAnimationFrame(() => document.getElementById(`opt-${first.id}-first`)?.focus());
      return;
    }
    if (!personalizationCheck.ok) {
      personalizationRef.current?.focus();
      return;
    }
    if (soldOutEntirely) {
      setFormError("This piece is sold out.");
      return;
    }
    const res = cartActions.add({
      productId: product.id,
      slug: product.slug,
      optionValueIds: chosen.map((c) => c.value.id),
      personalization: personalizationCheck.value,
      quantity: qty,
      unitPriceCents: unitPrice,
    });
    if (!res.ok) {
      setFormError(
        `You already have ${res.existing} of this in your cart, and ${maxPerLine} is the most you can buy of one item. Change the quantity in your cart or choose a different size or color.`,
      );
      return;
    }
    const summary = [product.name, ...chosen.map((c) => `${c.option.name} ${c.value.value}`), personalizationCheck.value && `“${personalizationCheck.value}”`]
      .filter(Boolean)
      .join(", ");
    setAdded({ summary, quantity: res.lineQuantity });
  }

  const availabilityText = soldOutEntirely
    ? "Sold out"
    : available <= 3
      ? `Only ${available} left${trackedChoice ? ` in ${trackedChoice.option.name.toLowerCase()} ${trackedChoice.value.value}` : ""}`
      : "In stock";

  const pickupStores = stores;

  return (
    <div>
      <div className="mt-2 flex items-baseline gap-3" data-testid="price">
        <p className="text-2xl">
          {product.compareAtCents ? <span className="sr-only">Now </span> : null}
          <span className={product.compareAtCents ? "text-primary" : ""} data-testid="price-value">
            {formatCents(unitPrice)}
          </span>
        </p>
        {product.compareAtCents ? (
          <p className="text-muted-foreground">
            <span className="sr-only">Was </span>
            <s>{formatCents(product.compareAtCents)}</s>
          </p>
        ) : null}
      </div>
      <p className={cn("mt-1 text-sm", soldOutEntirely ? "font-semibold text-destructive" : "text-muted-foreground")} data-testid="availability">
        {availabilityText}
      </p>

      <form
        className="mt-6 space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          addToCart();
        }}
      >
        {options.map((o) => {
          const sel = o.values.find((v) => v.id === selected[o.id]);
          const err = optionErrors[o.id];
          return (
            <fieldset key={o.id} data-testid={`option-${o.name.toLowerCase()}`} aria-describedby={err ? `opt-${o.id}-err` : undefined}>
              <legend className="mb-2 text-sm font-medium">
                {o.name}
                {sel ? <span className="ml-2 font-normal text-muted-foreground">{sel.value}</span> : null}
                {!o.required ? <span className="ml-2 font-normal text-muted-foreground">(optional)</span> : null}
              </legend>
              <div className="flex flex-wrap gap-2">
                {o.values.map((v, i) => {
                  const out = valueSoldOut(o, v);
                  const on = selected[o.id] === v.id;
                  return (
                    <button
                      key={v.id}
                      id={i === 0 ? `opt-${o.id}-first` : undefined}
                      type="button"
                      aria-pressed={on}
                      aria-disabled={out || undefined}
                      data-testid={`value-${o.name.toLowerCase()}-${v.value}`}
                      onClick={() => choose(o, v)}
                      className={cn(
                        "relative min-h-11 min-w-12 cursor-pointer border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        on ? "border-foreground bg-foreground text-background" : "border-[#8a847c] bg-white hover:border-foreground",
                        out && "cursor-not-allowed border-dashed bg-muted text-[#6f6a64] hover:border-[#8a847c]",
                      )}
                    >
                      <span className={out ? "line-through" : undefined}>{v.value}</span>
                      {v.priceAdjustCents !== 0 && !out && (
                        <span className="ml-1 text-xs opacity-80">
                          ({v.priceAdjustCents > 0 ? "+" : "−"}
                          {formatCents(Math.abs(v.priceAdjustCents))})
                        </span>
                      )}
                      {out && <span className="block text-[10px] uppercase leading-tight tracking-wide">Sold out</span>}
                    </button>
                  );
                })}
              </div>
              {o.values.some((v) => valueSoldOut(o, v)) && (
                <p className="mt-1 text-xs text-muted-foreground">Struck-through {o.name.toLowerCase()}s are sold out.</p>
              )}
              {err && (
                <p id={`opt-${o.id}-err`} role="alert" data-testid="option-error" className="mt-2 text-sm font-medium text-destructive">
                  {err}
                </p>
              )}
            </fieldset>
          );
        })}

        {product.personalizable && (
          <div>
            <label htmlFor="personalization" className="mb-1 block text-sm font-medium">
              {product.personalizationLabel} <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="personalization"
              ref={personalizationRef}
              type="text"
              value={personalization}
              maxLength={product.personalizationMaxLength}
              onChange={(e) => {
                setPersonalization(e.target.value);
                setAdded(null);
              }}
              aria-invalid={!personalizationCheck.ok}
              aria-describedby="personalization-help personalization-count"
              autoComplete="off"
              className="h-11 w-full border border-[#8a847c] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-primary aria-[invalid=true]:border-2 aria-[invalid=true]:border-destructive"
            />
            <div className="mt-1 flex justify-between gap-4 text-xs text-muted-foreground">
              <p id="personalization-help">
                Up to {product.personalizationMaxLength} characters: {settings.personalization.charsetHint}.
              </p>
              <p id="personalization-count" data-testid="personalization-count" aria-live="polite">
                {personalization.length}/{product.personalizationMaxLength}
              </p>
            </div>
            {!personalizationCheck.ok && (
              <p role="alert" data-testid="personalization-error" className="mt-1 text-sm font-medium text-destructive">
                {personalizationCheck.message}
              </p>
            )}
            <p data-testid="final-sale-note" className="mt-2 text-sm">
              Personalized pieces are final sale unless they arrive damaged or incorrect.{" "}
              <Link href="/returns" className="underline underline-offset-4">
                Returns policy
              </Link>
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="qty" className="mb-1 block text-sm font-medium">
              Quantity
            </label>
            <Select
              id="qty"
              value={qty}
              disabled={soldOutEntirely}
              onChange={(e) => {
                setQuantity(Number(e.target.value));
                setAdded(null);
              }}
              className="w-24"
            >
              {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="lg" className="min-w-48 flex-1 sm:flex-none" disabled={soldOutEntirely} data-testid="add-to-cart">
            {soldOutEntirely ? "Sold out" : "Add to cart"}
          </Button>
        </div>

        {formError && (
          <p role="alert" data-testid="form-error" className="text-sm font-medium text-destructive">
            {formError}{" "}
            <Link href="/cart" className="underline underline-offset-4">
              View cart
            </Link>
          </p>
        )}
        <div aria-live="polite">
          {added && (
            <div data-testid="added-confirmation" role="status" className="border border-success bg-[#eef6f0] p-4 text-sm">
              <p className="flex items-start gap-2 font-medium text-success">
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Added to your cart: {added.summary}. You now have {added.quantity} of this.</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/cart" className={buttonVariants({ size: "sm" })}>
                  View cart
                </Link>
                <button type="button" className={buttonVariants({ size: "sm", variant: "outline" })} onClick={() => setAdded(null)}>
                  Continue shopping
                </button>
              </div>
            </div>
          )}
        </div>
      </form>

      {pickupStores.length > 0 && (
        <section aria-labelledby="pickup-heading" className="mt-8 border-t pt-5" data-testid="pickup">
          <h2 id="pickup-heading" className="mb-2 text-lg">
            Pickup availability
          </h2>
          <ul className="space-y-2 text-sm">
            {pickupStores.map((st) => (
              <li key={st.id} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-medium">
                  {st.name}
                  {st.note ? <span className="ml-2 text-xs font-normal text-muted-foreground">({st.note})</span> : null}
                </span>
                <span className={soldOutEntirely ? "text-muted-foreground" : "text-foreground"}>
                  {soldOutEntirely
                    ? "Not available for pickup"
                    : missingTracked
                      ? "Choose a size to confirm"
                      : `Available for pickup${st.pickupReady ? `. ${st.pickupReady}` : ""}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export { normalizePersonalization };
