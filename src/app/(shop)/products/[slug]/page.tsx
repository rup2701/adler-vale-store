import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductDetailBySlug, getStores, listProducts } from "@/lib/catalog";
import { isOwner } from "@/lib/auth";
import { ProductGallery } from "@/components/shop/product-gallery";
import { BuyBox } from "@/components/shop/buy-box";
import { ProductGrid } from "@/components/shop/product-card";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getProductDetailBySlug(slug).catch(() => null);
  if (!d || d.product.status !== "published") return { title: "Product not found" };
  return { title: d.product.name, description: d.product.tagline || d.product.description.slice(0, 150) };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getProductDetailBySlug(slug);
  if (!detail) notFound();
  const { product, brand, category, options, images } = detail;
  const isDraft = product.status !== "published";
  // Drafts are private: anyone but the owner gets the standard not-found page.
  if (isDraft && !(await isOwner())) notFound();

  const stores = (await getStores()).filter((s) => s.pickup);
  const sameCategory = await listProducts({ categoryId: category.id, excludeId: product.id, limit: 5 });
  const related =
    sameCategory.length >= 5
      ? sameCategory
      : [
          ...sameCategory,
          ...(
            await listProducts({ brandId: brand?.id, excludeId: product.id, limit: 8 })
          ).filter((p) => !sameCategory.some((c) => c.id === p.id)),
        ].slice(0, 5);

  return (
    <div className="site-container pt-6 md:pt-10">
      {isDraft && (
        <p role="status" className="mb-4 border border-primary bg-[#f6ecee] p-3 text-sm" data-testid="draft-banner">
          <strong>Draft preview.</strong> Only you can see this page. Shoppers get “not found” until you publish it.
        </p>
      )}
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap gap-x-2">
          <li>
            <Link href="/" className="hover:underline">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/shop/${category.slug}`} className="hover:underline">{category.name}</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <ProductGallery
          name={product.name}
          images={images.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumbUrl, alt: i.alt, width: i.width, height: i.height }))}
        />
        <div className="max-w-xl">
          {brand && (
            <p className="eyebrow">
              <Link href={`/brands/${brand.slug}`} className="underline-offset-4 hover:underline" data-testid="product-brand">
                {brand.name}
              </Link>
            </p>
          )}
          <h1 className="mt-1 text-3xl md:text-4xl" data-testid="product-name">
            {product.name}
          </h1>
          <BuyBox
            product={{
              id: product.id,
              slug: product.slug,
              name: product.name,
              priceCents: product.priceCents,
              compareAtCents: product.compareAtCents,
              stock: product.stock,
              personalizable: product.personalizable,
              personalizationLabel: product.personalizationLabel,
              personalizationMaxLength: product.personalizationMaxLength,
            }}
            options={options}
            stores={stores.map((s) => ({ id: s.id, name: s.name, pickupReady: s.pickupReady, note: s.note }))}
          />

          <section aria-labelledby="desc-heading" className="mt-8 border-t pt-5">
            <h2 id="desc-heading" className="mb-2 text-lg">Description</h2>
            <p className="whitespace-pre-line text-muted-foreground">{product.description || "No description yet."}</p>
          </section>
          {product.materialsCare.length > 0 && (
            <section aria-labelledby="care-heading" className="mt-6 border-t pt-5">
              <h2 id="care-heading" className="mb-2 text-lg">Materials &amp; care</h2>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {product.materialsCare.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </section>
          )}
          {product.specifications.length > 0 && (
            <section aria-labelledby="spec-heading" className="mt-6 border-t pt-5">
              <h2 id="spec-heading" className="mb-2 text-lg">Specifications</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
                {product.specifications.map((r, i) => (
                  <div key={i} className="contents">
                    <dt className="font-medium">{r.label}</dt>
                    <dd className="text-muted-foreground">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-16">
          <h2 id="related-heading" className="mb-5 text-2xl">You may also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
