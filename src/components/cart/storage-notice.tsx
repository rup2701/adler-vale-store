"use client";
import { useStorageBlocked } from "@/components/cart/cart-store";

/** E-010: tell shoppers whose browser blocks storage that the cart will not survive closing the tab. */
export function StorageNotice() {
  const blocked = useStorageBlocked();
  if (!blocked) return null;
  return (
    <p role="status" data-testid="storage-notice" className="bg-muted py-2 text-center text-sm">
      Your cart won&apos;t be saved if you close this tab.
    </p>
  );
}
