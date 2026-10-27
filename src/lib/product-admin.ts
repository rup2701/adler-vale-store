import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { slugify } from "@/lib/slug";
import type { FieldErrors, ParsedProduct } from "@/lib/product-input";

export async function suggestFreeSlug(base: string, excludeId?: number): Promise<string> {
  const root = base || "product";
  for (let i = 2; i < 500; i++) {
    const candidate = `${root.slice(0, 74)}-${i}`;
    const [hit] = await db
      .select({ id: s.products.id })
      .from(s.products)
      .where(excludeId ? and(eq(s.products.slug, candidate), ne(s.products.id, excludeId)) : eq(s.products.slug, candidate));
    if (!hit) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export type SaveResult =
  | { ok: true; id: number; slug: string; created: boolean }
  | { ok: false; errors: FieldErrors };

export async function saveProductRecord(p: ParsedProduct): Promise<SaveResult> {
  const slug = p.slug || slugify(p.name) || "product";

  const [clash] = await db
    .select({ id: s.products.id, name: s.products.name })
    .from(s.products)
    .where(p.id ? and(eq(s.products.slug, slug), ne(s.products.id, p.id)) : eq(s.products.slug, slug));
  if (clash) {
    const alt = await suggestFreeSlug(slug, p.id);
    return {
      ok: false,
      errors: { slug: `The web address “${slug}” is already used by “${clash.name}”. Try “${alt}” instead.` },
    };
  }
  const [cat] = await db.select({ id: s.categories.id }).from(s.categories).where(eq(s.categories.id, p.categoryId));
  if (!cat) return { ok: false, errors: { categoryId: "Choose a category from the list." } };
  if (p.brandId) {
    const [b] = await db.select({ id: s.brands.id }).from(s.brands).where(eq(s.brands.id, p.brandId));
    if (!b) return { ok: false, errors: { brandId: "Choose a brand from the list." } };
  }
  if (p.id) {
    const [exists] = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.id, p.id));
    if (!exists) return { ok: false, errors: { form: "This product no longer exists. It may have been deleted in another window." } };
  }

  const id = await db.transaction(async (tx) => {
    const fields = {
      slug,
      name: p.name,
      tagline: p.tagline,
      brandId: p.brandId,
      categoryId: p.categoryId,
      department: p.department,
      description: p.description,
      materialsCare: p.materialsCare,
      specifications: p.specifications,
      priceCents: p.priceCents,
      compareAtCents: p.compareAtCents,
      stock: p.stock,
      personalizable: p.personalizable,
      personalizationLabel: p.personalizationLabel,
      personalizationMaxLength: p.personalizationMaxLength,
      updatedAt: new Date(),
    };
    let productId: number;
    if (p.id) {
      productId = p.id;
      await tx.update(s.products).set(fields).where(eq(s.products.id, productId));
    } else {
      const [row] = await tx.insert(s.products).values({ ...fields, status: "draft" }).returning({ id: s.products.id });
      productId = row.id;
    }

    // Options: update in place so cart lines that point at option values keep working.
    const existing = await tx.select().from(s.productOptions).where(eq(s.productOptions.productId, productId));
    const keepOptionIds = p.options.map((o) => o.id).filter((x): x is number => !!x && existing.some((e) => e.id === x));
    const drop = existing.filter((e) => !keepOptionIds.includes(e.id)).map((e) => e.id);
    if (drop.length) await tx.delete(s.productOptions).where(inArray(s.productOptions.id, drop));

    for (let oi = 0; oi < p.options.length; oi++) {
      const o = p.options[oi];
      let optionId: number;
      const optFields = {
        name: o.name,
        required: o.required,
        defaultValue: o.defaultValue,
        tracksStock: o.tracksStock,
        position: oi,
      };
      if (o.id && keepOptionIds.includes(o.id)) {
        optionId = o.id;
        await tx.update(s.productOptions).set(optFields).where(eq(s.productOptions.id, optionId));
      } else {
        const [row] = await tx
          .insert(s.productOptions)
          .values({ ...optFields, productId })
          .returning({ id: s.productOptions.id });
        optionId = row.id;
      }
      const existingVals = await tx.select().from(s.productOptionValues).where(eq(s.productOptionValues.optionId, optionId));
      const keepVals = o.values.map((v) => v.id).filter((x): x is number => !!x && existingVals.some((e) => e.id === x));
      const dropVals = existingVals.filter((e) => !keepVals.includes(e.id)).map((e) => e.id);
      if (dropVals.length) await tx.delete(s.productOptionValues).where(inArray(s.productOptionValues.id, dropVals));
      for (let vi = 0; vi < o.values.length; vi++) {
        const v = o.values[vi];
        const vf = { value: v.value, priceAdjustCents: v.priceAdjustCents, stock: v.stock, position: vi };
        if (v.id && keepVals.includes(v.id)) {
          await tx.update(s.productOptionValues).set(vf).where(eq(s.productOptionValues.id, v.id));
        } else {
          await tx.insert(s.productOptionValues).values({ ...vf, optionId });
        }
      }
    }

    await tx.delete(s.productCollections).where(eq(s.productCollections.productId, productId));
    if (p.collectionIds.length) {
      const valid = await tx.select({ id: s.collections.id }).from(s.collections).where(inArray(s.collections.id, p.collectionIds));
      if (valid.length)
        await tx.insert(s.productCollections).values(valid.map((c) => ({ productId, collectionId: c.id })));
    }
    return productId;
  });

  return { ok: true, id, slug, created: !p.id };
}

export type PublishResult = { ok: true } | { ok: false; reason: string };

export async function setPublished(productId: number, publish: boolean): Promise<PublishResult> {
  const [p] = await db.select().from(s.products).where(eq(s.products.id, productId));
  if (!p) return { ok: false, reason: "This product no longer exists." };
  if (publish) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.productImages)
      .where(eq(s.productImages.productId, productId));
    if (n < 1) return { ok: false, reason: "Add at least one photo before publishing. The first photo becomes the cover shoppers see." };
    if (!(p.priceCents > 0)) return { ok: false, reason: "Set a price greater than $0 before publishing." };
  }
  await db
    .update(s.products)
    .set({ status: publish ? "published" : "draft", updatedAt: new Date() })
    .where(eq(s.products.id, productId));
  return { ok: true };
}
