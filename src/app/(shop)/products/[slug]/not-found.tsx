import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function ProductNotFound() {
  return (
    <div className="reading-column px-4 py-20 text-center" data-testid="product-not-found">
      <h1 className="text-3xl">We couldn&apos;t find that product</h1>
      <p className="mt-3 text-muted-foreground">
        The link may be mistyped, or this piece isn&apos;t available right now. Everything we have in stock is in the shop.
      </p>
      <Link href="/shop" className={buttonVariants({ className: "mt-8" })}>
        Back to the shop
      </Link>
    </div>
  );
}
