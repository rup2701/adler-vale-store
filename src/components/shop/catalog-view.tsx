import Link from "next/link";
import { listProducts, getVisibleCategories, getVisibleBrands, type CatalogFilter } from "@/lib/catalog";
import { getDepartment } from "@/lib/dept";
import { ProductGrid } from "@/components/shop/product-card";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CatalogParams = { q?: string; brand?: string; sort?: string };

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
] as const;

export async function CatalogView({
  title,
  description,
  basePath,
  params,
  fixed,
  activeCategoryId,
  showCategories = true,
  hideBrandFilter = false,
}: {
  title: string;
  description?: string;
  basePath: string;
  params: CatalogParams;
  fixed: Pick<CatalogFilter, "categoryId" | "brandId" | "collectionId">;
  activeCategoryId?: number;
  showCategories?: boolean;
  hideBrandFilter?: boolean;
}) {
  const department = await getDepartment();
  const [categories, brands] = await Promise.all([getVisibleCategories(), getVisibleBrands()]);
  const brand = brands.find((b) => b.slug === params.brand);
  const sort = SORTS.some((s) => s.value === params.sort) ? (params.sort as CatalogFilter["sort"]) : "featured";
  const q = params.q?.trim() ?? "";

  const products = await listProducts({
    ...fixed,
    brandId: fixed.brandId ?? brand?.id,
    q,
    sort,
    department,
  });

  const filtersActive = !!(q || brand || (params.sort && params.sort !== "featured"));
  const anyActive = filtersActive || (fixed.categoryId && basePath !== "/shop");

  return (
    <div className="site-container pt-8 md:pt-12">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
        {q && (
          <p className="mt-2 text-muted-foreground">
            Results for “<span className="text-foreground">{q}</span>”
          </p>
        )}
      </header>

      {showCategories && (
        <nav aria-label="Categories" className="mb-5 flex flex-wrap gap-2">
          <Link
            href="/shop"
            aria-current={basePath === "/shop" ? "page" : undefined}
            className={cn("eyebrow border px-3 py-2", basePath === "/shop" ? "border-foreground bg-foreground text-background" : "hover:border-foreground")}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/shop/${c.slug}`}
              aria-current={activeCategoryId === c.id ? "page" : undefined}
              className={cn(
                "eyebrow border px-3 py-2",
                activeCategoryId === c.id ? "border-foreground bg-foreground text-background" : "hover:border-foreground",
              )}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      <form method="get" action={basePath} className="mb-6 flex flex-wrap items-end gap-3" aria-label="Filter and sort products">
        <div>
          <label htmlFor="f-q" className="mb-1 block text-xs font-medium uppercase tracking-wider">
            Search
          </label>
          <input
            id="f-q"
            name="q"
            defaultValue={q}
            type="search"
            className="h-10 w-48 border border-[#8a847c] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
          />
        </div>
        {!hideBrandFilter && (
          <div>
            <label htmlFor="f-brand" className="mb-1 block text-xs font-medium uppercase tracking-wider">
              Designer
            </label>
            <Select id="f-brand" name="brand" defaultValue={brand?.slug ?? ""} className="h-10 w-48 text-sm">
              <option value="">All designers</option>
              {brands.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <label htmlFor="f-sort" className="mb-1 block text-xs font-medium uppercase tracking-wider">
            Sort by
          </label>
          <Select id="f-sort" name="sort" defaultValue={sort} className="h-10 w-48 text-sm">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <button type="submit" className={buttonVariants({ variant: "dark", size: "sm", className: "h-10" })}>
          Apply
        </button>
        {anyActive && (
          <Link href="/shop" className="py-2 text-sm underline underline-offset-4 hover:text-primary" data-testid="clear-filters">
            Clear filters
          </Link>
        )}
      </form>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite" data-testid="result-count">
        {products.length} {products.length === 1 ? "product" : "products"}
        {department === "men" ? " for Men" : ""}
      </p>

      {products.length === 0 ? (
        <div className="py-16 text-center" data-testid="empty-results">
          <h2 className="text-2xl">Nothing to show here yet</h2>
          <p className="mt-2 text-muted-foreground">
            {department === "men" && !filtersActive
              ? "There are no pieces for Men in this section yet. Switch to Women at the top of the page, or browse everything."
              : "No products match these filters. Try fewer filters or browse the whole shop."}
          </p>
          <Link href="/shop" className={buttonVariants({ className: "mt-6" })}>
            Clear filters and browse all
          </Link>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
