import type { Metadata } from "next";
import Link from "next/link";
import { getVisibleBrands } from "@/lib/catalog";

export const metadata: Metadata = { title: "Designers" };

export default async function BrandsPage() {
  const brands = await getVisibleBrands();
  return (
    <div className="site-container pt-8 md:pt-12">
      <h1 className="text-3xl md:text-4xl">Designers</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">The brands we carry, each chosen by our buyers.</p>
      {brands.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No designers to show yet.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => (
            <li key={b.id}>
              <Link href={`/brands/${b.slug}`} className="block border p-6 hover:border-foreground">
                <span className="font-serif text-2xl">{b.name}</span>
                {b.description && <span className="mt-2 block text-sm text-muted-foreground">{b.description}</span>}
                <span className="eyebrow mt-4 block underline underline-offset-4">Shop {b.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
