import type { Metadata } from "next";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { ListManager } from "@/components/admin/list-manager";
import { addBrandAction, deleteBrandAction, moveBrandAction, updateBrandAction } from "./actions";

export const metadata: Metadata = { title: "Brands" };

export default async function AdminBrandsPage() {
  await requireOwner();
  const rows = await db
    .select({ id: s.brands.id, name: s.brands.name, description: s.brands.description, count: sql<number>`count(${s.products.id})::int` })
    .from(s.brands)
    .leftJoin(s.products, eq(s.products.brandId, s.brands.id))
    .groupBy(s.brands.id)
    .orderBy(asc(s.brands.position), asc(s.brands.id));
  return (
    <div>
      <h1 className="text-3xl">Brands</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        The designers you carry. They appear in the home page strip and on the Designers page, each with its own page.
      </p>
      <ListManager
        noun="brand"
        nounPlural="brands"
        fields={[
          { name: "name", label: "Name", maxLength: 60 },
          { name: "description", label: "Short description (shown on the brand page)", type: "textarea", maxLength: 400 },
        ]}
        items={rows.map((r) => ({
          id: r.id,
          title: r.name,
          values: { name: r.name, description: r.description },
          meta: `${r.count} product${r.count === 1 ? "" : "s"}`,
        }))}
        addAction={addBrandAction}
        updateAction={updateBrandAction}
        moveAction={moveBrandAction}
        deleteAction={deleteBrandAction}
        emptyText="No brands yet. Add the first designer you carry."
      />
    </div>
  );
}
