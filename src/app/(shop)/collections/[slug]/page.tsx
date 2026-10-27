import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { collections } from "@/db/schema";
import { CatalogView } from "@/components/shop/catalog-view";

async function load(slug: string) {
  const [c] = await db.select().from(collections).where(eq(collections.slug, slug));
  return c;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await load(slug).catch(() => undefined);
  return { title: c?.name ?? "Collection" };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; brand?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const c = await load(slug);
  if (!c) notFound();
  return (
    <CatalogView
      title={c.name}
      description={c.description}
      basePath={`/collections/${c.slug}`}
      params={await searchParams}
      fixed={{ collectionId: c.id }}
    />
  );
}
