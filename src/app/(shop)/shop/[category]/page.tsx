import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CatalogView } from "@/components/shop/catalog-view";
import { getCategoryBySlug, getVisibleCategories } from "@/lib/catalog";

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const hit = await getCategoryBySlug(category).catch(() => null);
  return { title: hit?.category?.name ?? "Shop" };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ q?: string; brand?: string; sort?: string }>;
}) {
  const { category: slug } = await params;
  const sp = await searchParams;
  const hit = await getCategoryBySlug(slug);
  if (!hit) notFound();
  if (hit.redirectTo) {
    const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
    permanentRedirect(`/shop/${hit.redirectTo}${qs ? `?${qs}` : ""}`);
  }
  const category = hit.category!;
  // A category with no published products is hidden from shoppers.
  const visible = await getVisibleCategories();
  if (!visible.some((c) => c.id === category.id)) notFound();

  return (
    <CatalogView
      title={category.name}
      basePath={`/shop/${category.slug}`}
      params={sp}
      fixed={{ categoryId: category.id }}
      activeCategoryId={category.id}
    />
  );
}
