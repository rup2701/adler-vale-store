import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function OrderNotFound() {
  return (
    <div className="reading-column px-4 py-20 text-center" data-testid="order-not-found">
      <h1 className="text-3xl">We couldn&apos;t find that order</h1>
      <p className="mt-3 text-muted-foreground">
        Order references look like <span className="font-mono">AV-7K3Q9X</span>: the letters AV, a dash, then six letters and numbers. Check
        the reference on your confirmation page. If you can&apos;t find it, you can place a new demo order or contact the studio.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/shop" className={buttonVariants()}>
          Back to the shop
        </Link>
        <Link href="/contact" className={buttonVariants({ variant: "outline" })}>
          Contact us
        </Link>
      </div>
    </div>
  );
}
