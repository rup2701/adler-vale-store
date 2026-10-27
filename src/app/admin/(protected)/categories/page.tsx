import type { Metadata } from "next";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { ListManager } from "@/components/admin/list-manager";
import { addCategoryAction, deleteCategoryAction, moveCategoryAction, renameCategoryAction } from "./actions";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await requireOwner();
  const rows = await db
    .select({
      id: s.categories.id,
      name: s.categories.name,
      count: sql<number>`count(${s.products.id})::int`,
      published: sql<number>`count(${s.products.id}) filter (where ${s.products.status} = 'published')::int`,
    })
    .from(s.categories)
    .leftJoin(s.products, eq(s.products.categoryId, s.categories.id))
    .groupBy(s.categories.id)
    .orderBy(asc(s.categories.position), asc(s.categories.id));

  return (
    <div>
      <h1 className="text-3xl">Categories</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Categories drive the shop menu, the catalog filter and the “shop by” links. The order here is the order in the menu. A category with no
        published products is hidden from shoppers.
      </p>
      <ListManager
        noun="category"
        nounPlural="categories"
        fields={[{ name: "name", label: "Name", maxLength: 40 }]}
        items={rows.map((r) => ({
          id: r.id,
          title: r.name,
          values: { name: r.name },
          meta: `${r.count} product${r.count === 1 ? "" : "s"} (${r.published} published)${r.published === 0 ? " · hidden from shoppers" : ""}`,
        }))}
        addAction={addCategoryAction}
        updateAction={renameCategoryAction}
        moveAction={moveCategoryAction}
        deleteAction={deleteCategoryAction}
        emptyText="No categories yet. Add your first one above."
      />
    </div>
  );
}
