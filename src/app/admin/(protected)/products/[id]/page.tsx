import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { getProductDetailById } from "@/lib/catalog";
import { storageStatus } from "@/lib/storage";
import { centsToDollarsInput } from "@/lib/money";
import { ProductEditor, type ProductForm } from "@/components/admin/product-editor";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireOwner();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const detail = await getProductDetailById(id);
  if (!detail) notFound();
  const sp = await searchParams;
  const [categories, brands, collections] = await Promise.all([
    db.select({ id: s.categories.id, name: s.categories.name }).from(s.categories).orderBy(asc(s.categories.position)),
    db.select({ id: s.brands.id, name: s.brands.name }).from(s.brands).orderBy(asc(s.brands.position)),
    db.select({ id: s.collections.id, name: s.collections.name }).from(s.collections).orderBy(asc(s.collections.name)),
  ]);
  const p = detail.product;
  const initial: ProductForm = {
    name: p.name,
    slug: p.slug,
    tagline: p.tagline,
    brandId: p.brandId ? String(p.brandId) : "",
    categoryId: String(p.categoryId),
    department: p.department === "men" ? "men" : "women",
    description: p.description,
    price: centsToDollarsInput(p.priceCents),
    compareAt: p.compareAtCents ? centsToDollarsInput(p.compareAtCents) : "",
    stock: String(p.stock),
    personalizable: p.personalizable,
    personalizationLabel: p.personalizationLabel,
    personalizationMaxLength: String(p.personalizationMaxLength),
    materialsCare: p.materialsCare.join("\n"),
    specifications: p.specifications.map((r) => `${r.label}: ${r.value}`).join("\n"),
    collectionIds: detail.collectionIds,
    options: detail.options.map((o) => ({
      key: `o${o.id}`,
      id: o.id,
      name: o.name,
      required: o.required,
      defaultValue: o.defaultValue ?? "",
      tracksStock: o.tracksStock,
      values: o.values.map((v) => ({
        key: `v${v.id}`,
        id: v.id,
        value: v.value,
        adjust: centsToDollarsInput(v.priceAdjustCents),
        stock: String(v.stock),
      })),
    })),
  };
  return (
    <ProductEditor
      key={`${p.id}-${p.updatedAt.getTime()}`}
      productId={p.id}
      status={p.status === "published" ? "published" : "draft"}
      isSample={p.isSample}
      initial={initial}
      categories={categories}
      brands={brands}
      collections={collections}
      photos={detail.images.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumbUrl, alt: i.alt, width: i.width, height: i.height, resized: i.resized }))}
      storage={storageStatus()}
      flash={(["created", "updated", "published", "unpublished"] as const).find((x) => x === sp.saved) ?? null}
    />
  );
}
