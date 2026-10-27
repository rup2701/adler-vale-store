import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { formatCentsExact } from "@/lib/money";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Placeholder } from "@/components/shop/placeholder";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const categoryId = Number(sp.category) || undefined;
  const status = sp.status === "draft" || sp.status === "published" ? sp.status : undefined;

  const total = await db.$count(s.products);
  const cats = await db.select().from(s.categories).orderBy(asc(s.categories.position));

  const conds: SQL[] = [];
  if (q) {
    const term = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(or(ilike(s.products.name, term), ilike(s.products.slug, term))!);
  }
  if (categoryId) conds.push(eq(s.products.categoryId, categoryId));
  if (status) conds.push(eq(s.products.status, status));

  const rows = await db
    .select({
      id: s.products.id,
      name: s.products.name,
      slug: s.products.slug,
      priceCents: s.products.priceCents,
      stock: s.products.stock,
      status: s.products.status,
      isSample: s.products.isSample,
      category: s.categories.name,
      brand: s.brands.name,
    })
    .from(s.products)
    .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
    .leftJoin(s.brands, eq(s.brands.id, s.products.brandId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(s.products.updatedAt), asc(s.products.id));

  const imgs = rows.length
    ? await db
        .select()
        .from(s.productImages)
        .where(inArray(s.productImages.productId, rows.map((r) => r.id)))
        .orderBy(asc(s.productImages.position), asc(s.productImages.id))
    : [];
  const cover = new Map<number, (typeof imgs)[number]>();
  for (const i of imgs) if (!cover.has(i.productId)) cover.set(i.productId, i);

  const all = await db
    .select({ status: s.products.status, stock: s.products.stock, id: s.products.id })
    .from(s.products);
  const withPhoto = new Set((await db.select({ id: s.productImages.productId }).from(s.productImages)).map((r) => r.id));
  const drafts = all.filter((p) => p.status === "draft").length;
  const soldOut = all.filter((p) => p.status === "published" && p.stock <= 0).length;
  const noPhoto = all.filter((p) => !withPhoto.has(p.id)).length;
  const filtered = !!(q || categoryId || status);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl" data-testid="products-heading">
          Products <span className="text-xl text-muted-foreground">({total})</span>
        </h1>
        <Link href="/admin/products/new" className={buttonVariants()} data-testid="add-product">
          Add product
        </Link>
      </div>

      {total === 0 ? (
        <div className="mt-8 border bg-white p-10 text-center" data-testid="empty-store">
          <h2 className="text-2xl">Add your first product</h2>
          <p className="mt-2 text-muted-foreground">
            Start with a name, price, category and stock. Then add photos and publish it so shoppers can see it.
          </p>
          <Link href="/admin/products/new" className={buttonVariants({ className: "mt-6" })}>
            Add your first product
          </Link>
        </div>
      ) : (
        <>
          {(drafts > 0 || soldOut > 0 || noPhoto > 0) && (
            <p className="mt-3 border-l-4 border-primary bg-white p-3 text-sm" data-testid="attention">
              Needs attention:{" "}
              {[
                drafts > 0 && `${drafts} draft${drafts === 1 ? "" : "s"} not yet visible to shoppers`,
                soldOut > 0 && `${soldOut} sold out`,
                noPhoto > 0 && `${noPhoto} without photos (add photos before publishing)`,
              ]
                .filter(Boolean)
                .join(", ")}
              .
            </p>
          )}
          <form method="get" className="mt-5 flex flex-wrap items-end gap-3" aria-label="Search and filter products">
            <div>
              <label htmlFor="q" className="mb-1 block text-xs font-medium uppercase tracking-wider">Search by name</label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                className="h-10 w-56 border border-[#8a847c] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
              />
            </div>
            <div>
              <label htmlFor="category" className="mb-1 block text-xs font-medium uppercase tracking-wider">Category</label>
              <Select id="category" name="category" defaultValue={categoryId ?? ""} className="h-10 w-44 text-sm">
                <option value="">All categories</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="status" className="mb-1 block text-xs font-medium uppercase tracking-wider">Status</label>
              <Select id="status" name="status" defaultValue={status ?? ""} className="h-10 w-40 text-sm">
                <option value="">All</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </Select>
            </div>
            <button type="submit" className={buttonVariants({ variant: "dark", size: "sm", className: "h-10" })}>Filter</button>
            {filtered && (
              <Link href="/admin/products" className="py-2 text-sm underline underline-offset-4">Clear filters</Link>
            )}
          </form>

          {rows.length === 0 ? (
            <p className="mt-8 border bg-white p-8 text-center" data-testid="no-results">
              No products match those filters. <Link href="/admin/products" className="underline underline-offset-4">Clear filters</Link>
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto border bg-white">
              <table className="w-full min-w-[40rem] text-left text-sm" data-testid="products-table">
                <caption className="visually-hidden">All products</caption>
                <thead className="border-b bg-muted text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="p-3">Photo</th>
                    <th scope="col" className="p-3">Name</th>
                    <th scope="col" className="p-3">Category</th>
                    <th scope="col" className="p-3 text-right">Price</th>
                    <th scope="col" className="p-3 text-right">Stock</th>
                    <th scope="col" className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const c = cover.get(r.id);
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-[#faf9f7]" data-testid="product-row">
                        <td className="w-16 p-3">
                          <div className="h-16 w-12 overflow-hidden bg-muted">
                            {c ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.thumbUrl} alt={c.alt} className="h-full w-full object-cover" />
                            ) : (
                              <Placeholder label="" />
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Link href={`/admin/products/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                            {r.name}<span className="visually-hidden">, edit</span>
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {r.brand ?? "No brand"}
                            {r.isSample && <span className="ml-2 border border-[#8a847c] px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Sample</span>}
                          </p>
                          {r.status === "draft" && !c && <p className="text-xs text-primary">Next: add photos, then publish</p>}
                          {r.status === "draft" && c && <p className="text-xs text-primary">Next: publish when ready</p>}
                        </td>
                        <td className="p-3">{r.category}</td>
                        <td className="p-3 text-right">{formatCentsExact(r.priceCents)}</td>
                        <td className="p-3 text-right" data-testid="stock-cell">
                          {r.stock <= 0 ? <span className="font-medium text-destructive">Sold out</span> : r.stock}
                        </td>
                        <td className="p-3">
                          <span
                            data-testid="status-cell"
                            className={`inline-block px-2 py-0.5 text-xs font-medium ${r.status === "published" ? "bg-[#dfeee4] text-success" : "bg-[#f3e7c9] text-[#6b4a00]"}`}
                          >
                            {r.status === "published" ? "Published" : "Draft"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
