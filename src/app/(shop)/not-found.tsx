import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="reading-column px-4 py-20 text-center" data-testid="not-found">
      <h1 className="text-3xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted-foreground">It may have moved, or the link may be mistyped. Let&apos;s get you back to something beautiful.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/shop" className={buttonVariants()}>
          Browse the shop
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
