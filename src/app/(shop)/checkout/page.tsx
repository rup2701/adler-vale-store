import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { getStores } from "@/lib/catalog";

export const metadata: Metadata = { title: "Checkout (demo)" };

export default async function CheckoutPage() {
  const stores = (await getStores()).filter((s) => s.pickup);
  return (
    <CheckoutView
      stores={stores.map((s) => ({ id: s.id, name: s.name, address: s.address, pickupReady: s.pickupReady, note: s.note }))}
    />
  );
}
