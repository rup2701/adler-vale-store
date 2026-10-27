import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { Placeholder } from "@/components/shop/placeholder";

/** Image-first card: the picture fills the card, the text block is four short lines. One link, one tab stop. */
export function ProductCard({ product }: { product: ProductCardData }) {
  const p = product;
  return (
    <Link
      href={`/products/${p.slug}`}
      data-testid="product-card"
      className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted" data-testid="card-image">
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.coverUrl}
            alt={p.coverAlt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <Placeholder />
        )}
        {p.soldOut && (
          <span className="eyebrow absolute left-2 top-2 bg-foreground px-2 py-1 text-[10px] text-background">Sold out</span>
        )}
      </div>
      <div className="pt-1.5 text-xs leading-tight">
        <p className="eyebrow truncate text-[10px] text-muted-foreground">
          {[p.brandName, p.categoryName].filter(Boolean).join(" · ")}
        </p>
        <p className="truncate text-sm font-medium">{p.name}</p>
        <p className="truncate text-muted-foreground">{p.tagline || "\u00a0"}</p>
        <p className="text-sm">
          {p.compareAtCents ? (
            <>
              <span className="sr-only">Now </span>
              <span className="text-primary">{formatCents(p.priceCents)}</span>{" "}
              <span className="sr-only">was </span>
              <s className="text-muted-foreground">{formatCents(p.compareAtCents)}</s>
            </>
          ) : (
            formatCents(p.priceCents)
          )}
        </p>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="product-grid" data-testid="product-grid">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
