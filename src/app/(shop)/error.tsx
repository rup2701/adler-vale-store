"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/** E-025: a friendly page instead of a stack trace when the database is unreachable. */
export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="reading-column px-4 py-20 text-center" data-testid="shop-error">
      <h1 className="text-3xl">The shop is having a moment</h1>
      <p className="mt-3 text-muted-foreground">
        Something on our side isn&apos;t responding. Your cart is saved in this browser, so nothing you chose is lost.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Link href="/cart" className={buttonVariants({ variant: "outline" })}>
          View my cart
        </Link>
      </div>
    </div>
  );
}
