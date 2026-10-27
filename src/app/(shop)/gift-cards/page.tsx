import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Gift cards" };

export default function GiftCardsPage() {
  return (
    <div className="reading-column px-4 pt-8 sm:px-6 md:pt-12">
      <h1 className="text-3xl md:text-4xl">Gift cards</h1>
      <p className="mt-4 text-lg">The easiest way to give something she will actually wear.</p>
      <p className="mt-4 text-muted-foreground">
        Gift cards are available in both of our stores in any amount. Online gift cards are not part of this demo store, so there is nothing to
        buy here yet. Because checkout is simulated, no real gift card can be purchased or redeemed on this site.
      </p>
      <p className="mt-6">
        Ask in a store, or <Link href="/contact" className="underline underline-offset-4">contact us</Link> for details. Meanwhile,{" "}
        <Link href="/shop" className="underline underline-offset-4">browse the shop</Link>.
      </p>
    </div>
  );
}
