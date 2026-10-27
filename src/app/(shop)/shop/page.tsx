import type { Metadata } from "next";
import { CatalogView } from "@/components/shop/catalog-view";

export const metadata: Metadata = { title: "Shop all" };

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; brand?: string; sort?: string }> }) {
  const params = await searchParams;
  return (
    <CatalogView
      title="Shop all"
      description="Every piece we carry, from the designers we know and love."
      basePath="/shop"
      params={params}
      fixed={{}}
    />
  );
}
