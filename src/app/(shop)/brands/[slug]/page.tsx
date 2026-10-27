import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { CatalogView } from "@/components/shop/catalog-view";

async function load(slug: string) {
  const [b] = await db.select().from(brands).where(eq(brands.slug, slug));
  return b;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await load(slug).catch(() => undefined);
  return { title: b?.name ?? "Designer" };
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; brand?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const b = await load(slug);
  if (!b) notFound();
  return (
    <CatalogView
      title={b.name}
      description={b.description}
      basePath={`/brands/${b.slug}`}
      params={await searchParams}
      fixed={{ brandId: b.id }}
      hideBrandFilter
    />
  );
}
