import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { settings } from "@/config/settings";
import { checkPersonalization } from "@/lib/personalization";
import type { CartLine, PricedLine } from "@/lib/cart-types";

/**
 * Prices every cart line from the database. The browser cart is never trusted: names, prices,
 * options, availability and personalization rules all come from here.
 */
export async function priceLines(lines: Pick<CartLine, "productId" | "optionValueIds" | "personalization" | "quantity" | "seenUnitPriceCents" | "slug">[]): Promise<PricedLine[]> {
  if (lines.length === 0) return [];
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = await db.select().from(s.products).where(inArray(s.products.id, ids));
  const brandIds = products.map((p) => p.brandId).filter((x): x is number => x != null);
  const brands = brandIds.length ? await db.select().from(s.brands).where(inArray(s.brands.id, brandIds)) : [];
  const options = await db
    .select()
    .from(s.productOptions)
    .where(inArray(s.productOptions.productId, ids))
    .orderBy(asc(s.productOptions.position), asc(s.productOptions.id));
  const values = options.length
    ? await db
        .select()
        .from(s.productOptionValues)
        .where(inArray(s.productOptionValues.optionId, options.map((o) => o.id)))
        .orderBy(asc(s.productOptionValues.position), asc(s.productOptionValues.id))
    : [];
  const images = await db
    .select()
    .from(s.productImages)
    .where(inArray(s.productImages.productId, ids))
    .orderBy(asc(s.productImages.position), asc(s.productImages.id));

  return lines.map((line): PricedLine => {
    const p = products.find((x) => x.id === line.productId);
    const base = {
      key: `${line.productId}|${[...line.optionValueIds].sort((a, b) => a - b).join(".")}|${line.personalization}`,
      productId: line.productId,
      slug: p?.slug ?? line.slug,
      name: p?.name ?? "Item no longer available",
      brandName: brands.find((b) => b.id === p?.brandId)?.name ?? "",
      imageUrl: null as string | null,
      imageAlt: p?.name ?? "",
      options: [] as { option: string; value: string }[],
      personalization: line.personalization,
      quantity: line.quantity,
      unitPriceCents: 0,
      lineTotalCents: 0,
      seenUnitPriceCents: line.seenUnitPriceCents,
      priceChanged: false,
      chosenValueIds: [] as number[],
      trackedValueIds: [] as number[],
    };
    const fail = (code: "unavailable" | "sold_out" | "insufficient" | "invalid", message: string, maxQuantity = 0): PricedLine => ({
      ...base,
      issue: { code, message, maxQuantity },
    });

    if (!p || p.status !== "published") {
      return fail("unavailable", `${base.name} isn't available right now.`);
    }
    const cover = images.find((i) => i.productId === p.id);
    base.imageUrl = cover?.thumbUrl ?? null;
    base.imageAlt = cover?.alt ?? p.name;

    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > settings.orders.maxQuantityPerLine) {
      return fail("invalid", `${p.name}: quantity must be between 1 and ${settings.orders.maxQuantityPerLine}.`, 0);
    }

    // Resolve one value per option.
    const pOptions = options.filter((o) => o.productId === p.id);
    const chosen: { option: typeof pOptions[number]; value: typeof values[number] }[] = [];
    for (const o of pOptions) {
      const ov = values.filter((v) => v.optionId === o.id);
      const picked = ov.filter((v) => line.optionValueIds.includes(v.id));
      if (picked.length > 1) return fail("invalid", `${p.name}: please choose one ${o.name.toLowerCase()}.`);
      let v = picked[0];
      if (!v && o.required) {
        v = ov.find((x) => x.value === o.defaultValue) as (typeof values)[number];
        if (!v) return fail("invalid", `${p.name}: please choose a ${o.name.toLowerCase()}.`);
      }
      if (v) chosen.push({ option: o, value: v });
    }
    const knownIds = new Set(values.filter((v) => pOptions.some((o) => o.id === v.optionId)).map((v) => v.id));
    if (line.optionValueIds.some((id) => !knownIds.has(id))) {
      return fail("invalid", `${p.name}: one of the chosen options is no longer offered. Please choose again.`);
    }

    let maxQty = Infinity;
    if (p.stock <= 0) return fail("sold_out", `${p.name} is sold out.`);
    for (const c of chosen) {
      if (c.option.tracksStock) {
        if (c.value.stock <= 0) {
          return fail("sold_out", `${p.name} in ${c.option.name.toLowerCase()} ${c.value.value} is sold out.`);
        }
        maxQty = Math.min(maxQty, c.value.stock);
      }
    }
    if (!chosen.some((c) => c.option.tracksStock)) maxQty = Math.min(maxQty, p.stock);
    if (line.quantity > maxQty) {
      return fail("insufficient", `Only ${maxQty} of ${p.name} ${maxQty === 1 ? "is" : "are"} left.`, maxQty);
    }

    // Personalization
    let personalization = "";
    if (line.personalization) {
      if (!p.personalizable) return fail("invalid", `${p.name} can't be personalized.`);
      const check = checkPersonalization(line.personalization, p.personalizationMaxLength, p.personalizationLabel);
      if (!check.ok) return fail("invalid", `${p.name}: ${check.message}`);
      personalization = check.value;
    }

    const unit = p.priceCents + chosen.reduce((sum, c) => sum + c.value.priceAdjustCents, 0);
    return {
      ...base,
      personalization,
      options: chosen.map((c) => ({ option: c.option.name, value: c.value.value })),
      unitPriceCents: unit,
      lineTotalCents: unit * line.quantity,
      priceChanged: line.seenUnitPriceCents > 0 && line.seenUnitPriceCents !== unit,
      chosenValueIds: chosen.map((c) => c.value.id),
      trackedValueIds: chosen.filter((c) => c.option.tracksStock).map((c) => c.value.id),
      issue: null,
    };
  });
}
