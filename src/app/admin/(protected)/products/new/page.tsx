import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { storageStatus } from "@/lib/storage";
import { ProductEditor, type ProductForm } from "@/components/admin/product-editor";
import { settings } from "@/config/settings";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireOwner();
  const [categories, brands, collections] = await Promise.all([
    db.select({ id: s.categories.id, name: s.categories.name }).from(s.categories).orderBy(asc(s.categories.position)),
    db.select({ id: s.brands.id, name: s.brands.name }).from(s.brands).orderBy(asc(s.brands.position)),
    db.select({ id: s.collections.id, name: s.collections.name }).from(s.collections).orderBy(asc(s.collections.name)),
  ]);
  const initial: ProductForm = {
    name: "",
    slug: "",
    tagline: "",
    brandId: "",
    categoryId: "",
    department: "women",
    description: "",
    price: "",
    compareAt: "",
    stock: "0",
    personalizable: false,
    personalizationLabel: "Monogram",
    personalizationMaxLength: String(settings.personalization.defaultMaxLength),
    materialsCare: "",
    specifications: "",
    collectionIds: [],
    options: [],
  };
  return (
    <ProductEditor
      productId={null}
      status="draft"
      isSample={false}
      initial={initial}
      categories={categories}
      brands={brands}
      collections={collections}
      photos={[]}
      storage={storageStatus()}
      flash={null}
    />
  );
}
