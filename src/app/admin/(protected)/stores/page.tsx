import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { ListManager } from "@/components/admin/list-manager";
import { addStoreAction, deleteStoreAction, moveStoreAction, updateStoreAction } from "./actions";

export const metadata: Metadata = { title: "Stores & pickup" };

export default async function AdminStoresPage() {
  await requireOwner();
  const rows = await db.select().from(s.stores).orderBy(asc(s.stores.position), asc(s.stores.id));
  return (
    <div>
      <h1 className="text-3xl">Stores &amp; pickup</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Your stores appear in the footer and the Contact page. Stores with pickup switched on show on product pages and can be chosen at checkout,
        with the ready time you write here.
      </p>
      <ListManager
        noun="store"
        nounPlural="stores"
        fields={[
          { name: "name", label: "Store name", maxLength: 60 },
          { name: "address", label: "Address", maxLength: 200 },
          { name: "phone", label: "Phone", maxLength: 30 },
          { name: "pickup", label: "Offer pickup at this store", type: "checkbox" },
          { name: "pickupReady", label: "Pickup ready time (shown to shoppers)", maxLength: 100, placeholder: "Usually ready in 4 hours" },
          { name: "note", label: "Small note (optional, for example “New location”)", maxLength: 60 },
        ]}
        items={rows.map((r) => ({
          id: r.id,
          title: r.name,
          values: { name: r.name, address: r.address, phone: r.phone, pickup: String(r.pickup), pickupReady: r.pickupReady, note: r.note },
          meta: `${r.address} · ${r.phone} · ${r.pickup ? "pickup on" : "pickup off"}`,
          deleteNote: "Past orders keep the store's name.",
        }))}
        addAction={addStoreAction}
        updateAction={updateStoreAction}
        moveAction={moveStoreAction}
        deleteAction={deleteStoreAction}
        emptyText="No stores yet. Add your first store above."
      />
    </div>
  );
}
