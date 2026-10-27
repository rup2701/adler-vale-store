import { and, asc, desc, eq, exists, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { Department } from "@/config/settings";

export type ProductCardData = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  brandName: string;
  categoryName: string;
  priceCents: number;
  compareAtCents: number | null;
  soldOut: boolean;
  coverUrl: string | null;
  coverAlt: string;
};

export type CatalogFilter = {
  department?: Department;
  categoryId?: number;
  brandId?: number;
  collectionId?: number;
  q?: string;
  sort?: "featured" | "newest" | "price-asc" | "price-desc";
  limit?: number;
  excludeId?: number;
};

export function publishedOnly(): SQL {
  return eq(s.products.status, "published");
}

export async function listProducts(f: CatalogFilter = {}): Promise<ProductCardData[]> {
  const conds: SQL[] = [publishedOnly()];
  if (f.department) conds.push(eq(s.products.department, f.department));
  if (f.categoryId) conds.push(eq(s.products.categoryId, f.categoryId));
  if (f.brandId) conds.push(eq(s.products.brandId, f.brandId));
  if (f.excludeId) conds.push(sql`${s.products.id} <> ${f.excludeId}`);
  if (f.collectionId) {
    conds.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(s.productCollections)
          .where(
            and(eq(s.productCollections.productId, s.products.id), eq(s.productCollections.collectionId, f.collectionId)),
          ),
      ),
    );
  }
  if (f.q && f.q.trim()) {
    const term = `%${f.q.trim().replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(
      or(
        ilike(s.products.name, term),
        ilike(s.products.tagline, term),
        ilike(s.products.description, term),
        exists(
          db
            .select({ one: sql`1` })
            .from(s.brands)
            .where(and(eq(s.brands.id, s.products.brandId), ilike(s.brands.name, term))),
        ),
      )!,
    );
  }
  const order =
    f.sort === "price-asc"
      ? [asc(s.products.priceCents)]
      : f.sort === "price-desc"
        ? [desc(s.products.priceCents)]
        : [desc(s.products.createdAt), asc(s.products.id)];

  // sold-out items sink to the bottom unless sorting by price
  const sink = f.sort === "price-asc" || f.sort === "price-desc" ? [] : [sql`(${s.products.stock} <= 0)`];

  const rows = await db
    .select({
      id: s.products.id,
      slug: s.products.slug,
      name: s.products.name,
      tagline: s.products.tagline,
      priceCents: s.products.priceCents,
      compareAtCents: s.products.compareAtCents,
      stock: s.products.stock,
      brandName: s.brands.name,
      categoryName: s.categories.name,
    })
    .from(s.products)
    .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
    .leftJoin(s.brands, eq(s.brands.id, s.products.brandId))
    .where(and(...conds))
    .orderBy(...sink, ...order)
    .limit(f.limit ?? 500);

  return attachCovers(rows);
}

async function attachCovers(
  rows: {
    id: number;
    slug: string;
    name: string;
    tagline: string;
    priceCents: number;
    compareAtCents: number | null;
    stock: number;
    brandName: string | null;
    categoryName: string;
  }[],
): Promise<ProductCardData[]> {
  if (rows.length === 0) return [];
  const imgs = await db
    .select({ productId: s.productImages.productId, thumbUrl: s.productImages.thumbUrl, alt: s.productImages.alt })
    .from(s.productImages)
    .where(inArray(s.productImages.productId, rows.map((r) => r.id)))
    .orderBy(asc(s.productImages.position), asc(s.productImages.id));
  const cover = new Map<number, { thumbUrl: string; alt: string }>();
  for (const i of imgs) if (!cover.has(i.productId)) cover.set(i.productId, i);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    brandName: r.brandName ?? "",
    categoryName: r.categoryName,
    priceCents: r.priceCents,
    compareAtCents: r.compareAtCents,
    soldOut: r.stock <= 0,
    coverUrl: cover.get(r.id)?.thumbUrl ?? null,
    coverAlt: cover.get(r.id)?.alt ?? r.name,
  }));
}

/** Categories that have at least one published product (empty ones are hidden from shoppers). */
export async function getVisibleCategories() {
  return db
    .select({ id: s.categories.id, name: s.categories.name, slug: s.categories.slug, position: s.categories.position })
    .from(s.categories)
    .where(
      exists(
        db
          .select({ one: sql`1` })
          .from(s.products)
          .where(and(eq(s.products.categoryId, s.categories.id), publishedOnly())),
      ),
    )
    .orderBy(asc(s.categories.position), asc(s.categories.id));
}

export async function getBrands() {
  return db.select().from(s.brands).orderBy(asc(s.brands.position), asc(s.brands.id));
}

export async function getVisibleBrands() {
  return db
    .select()
    .from(s.brands)
    .where(
      exists(
        db
          .select({ one: sql`1` })
          .from(s.products)
          .where(and(eq(s.products.brandId, s.brands.id), publishedOnly())),
      ),
    )
    .orderBy(asc(s.brands.position), asc(s.brands.id));
}

export async function getStores() {
  return db.select().from(s.stores).orderBy(asc(s.stores.position), asc(s.stores.id));
}

export type ProductOptionData = {
  id: number;
  name: string;
  required: boolean;
  defaultValue: string | null;
  tracksStock: boolean;
  values: { id: number; value: string; priceAdjustCents: number; stock: number }[];
};

export type ProductDetail = {
  product: typeof s.products.$inferSelect;
  brand: { id: number; name: string; slug: string } | null;
  category: { id: number; name: string; slug: string };
  options: ProductOptionData[];
  images: (typeof s.productImages.$inferSelect)[];
  collectionIds: number[];
};

export async function getProductDetailBy(where: SQL): Promise<ProductDetail | null> {
  const [row] = await db
    .select({ product: s.products, category: s.categories })
    .from(s.products)
    .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
    .where(where)
    .limit(1);
  if (!row) return null;
  const p = row.product;
  const [brand] = p.brandId
    ? await db.select({ id: s.brands.id, name: s.brands.name, slug: s.brands.slug }).from(s.brands).where(eq(s.brands.id, p.brandId))
    : [];
  const opts = await db
    .select()
    .from(s.productOptions)
    .where(eq(s.productOptions.productId, p.id))
    .orderBy(asc(s.productOptions.position), asc(s.productOptions.id));
  const vals = opts.length
    ? await db
        .select()
        .from(s.productOptionValues)
        .where(inArray(s.productOptionValues.optionId, opts.map((o) => o.id)))
        .orderBy(asc(s.productOptionValues.position), asc(s.productOptionValues.id))
    : [];
  const images = await db
    .select()
    .from(s.productImages)
    .where(eq(s.productImages.productId, p.id))
    .orderBy(asc(s.productImages.position), asc(s.productImages.id));
  const cols = await db
    .select({ id: s.productCollections.collectionId })
    .from(s.productCollections)
    .where(eq(s.productCollections.productId, p.id));
  return {
    product: p,
    brand: brand ?? null,
    category: { id: row.category.id, name: row.category.name, slug: row.category.slug },
    options: opts.map((o) => ({
      id: o.id,
      name: o.name,
      required: o.required,
      defaultValue: o.defaultValue,
      tracksStock: o.tracksStock,
      values: vals
        .filter((v) => v.optionId === o.id)
        .map((v) => ({ id: v.id, value: v.value, priceAdjustCents: v.priceAdjustCents, stock: v.stock })),
    })),
    images,
    collectionIds: cols.map((c) => c.id),
  };
}

export function getProductDetailBySlug(slug: string) {
  return getProductDetailBy(eq(s.products.slug, slug));
}

export function getProductDetailById(id: number) {
  return getProductDetailBy(eq(s.products.id, id));
}

export async function getCategoryBySlug(slug: string) {
  const [c] = await db.select().from(s.categories).where(eq(s.categories.slug, slug));
  if (c) return { category: c, redirectTo: null as string | null };
  const [alias] = await db
    .select({ id: s.categories.id, slug: s.categories.slug })
    .from(s.categoryAliases)
    .innerJoin(s.categories, eq(s.categories.id, s.categoryAliases.categoryId))
    .where(eq(s.categoryAliases.slug, slug));
  if (alias) return { category: null, redirectTo: alias.slug };
  return null;
}

export async function getHomeCollections(department?: Department) {
  const cols = await db
    .select()
    .from(s.collections)
    .where(eq(s.collections.showOnHome, true))
    .orderBy(asc(s.collections.homePosition), asc(s.collections.id));
  const out = [];
  for (const c of cols) {
    const products = await listProducts({ collectionId: c.id, department, limit: 6 });
    if (products.length) out.push({ collection: c, products });
  }
  return out;
}

export type StockLookup = { available: boolean };

/** Whether a product (and optionally a chosen size) can currently be bought. */
export function productAvailable(p: { stock: number }) {
  return p.stock > 0;
}
