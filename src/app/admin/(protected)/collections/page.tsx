import type { Metadata } from "next";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { ListManager } from "@/components/admin/list-manager";
import { addCollectionAction, deleteCollectionAction, updateCollectionAction } from "./actions";

export const metadata: Metadata = { title: "Collections" };

export default async function AdminCollectionsPage() {
  await requireOwner();
  const rows = await db
    .select({
      id: s.collections.id,
      name: s.collections.name,
      description: s.collections.description,
      showOnHome: s.collections.showOnHome,
      count: sql<number>`count(${s.productCollections.productId})::int`,
    })
    .from(s.collections)
    .leftJoin(s.productCollections, eq(s.productCollections.collectionId, s.collections.id))
    .groupBy(s.collections.id)
    .orderBy(asc(s.collections.homePosition), asc(s.collections.id));
  return (
    <div>
      <h1 className="text-3xl">Collections</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Collections group products across categories (a product can be in several). Choose products in the product form. Choose which collections show on
        the home page, and in what order, under Home page.
      </p>
      <ListManager
        noun="collection"
        nounPlural="collections"
        fields={[
          { name: "name", label: "Name", maxLength: 60 },
          { name: "description", label: "Description (shown above the products)", type: "textarea", maxLength: 300 },
        ]}
        items={rows.map((r) => ({
          id: r.id,
          title: r.name,
          values: { name: r.name, description: r.description },
          meta: `${r.count} product${r.count === 1 ? "" : "s"} · ${r.showOnHome ? "shown on the home page" : "not on the home page"}`,
          deleteNote: "Products in it are kept.",
        }))}
        addAction={addCollectionAction}
        updateAction={updateCollectionAction}
        deleteAction={deleteCollectionAction}
        emptyText="No collections yet. Add one above."
      />
    </div>
  );
}
