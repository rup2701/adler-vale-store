import type { Metadata } from "next";
import Link from "next/link";
import { settings } from "@/config/settings";

export const metadata: Metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <div className="reading-column px-4 pt-8 sm:px-6 md:pt-12">
      <h1 className="text-3xl md:text-4xl">About {settings.store.name}</h1>
      <p className="mt-4 text-lg">
        {settings.store.name} is a designer boutique in {settings.store.town}, with a second location in Santa Barbara. We are small on
        purpose: every piece is chosen by our buyers, tried on, and worn before it reaches the rail.
      </p>
      <p className="mt-4 text-muted-foreground">
        We carry a curated set of five designers, from everyday tailoring to hand-pleated evening wear, and we love helping people find
        the piece that feels like theirs. Visit a store for a personal fitting, or shop online and pick up the same day.
      </p>
      <p className="mt-4 rounded-none border border-primary bg-[#f6ecee] p-4 text-sm">
        This is a demonstration store. The brands, products, addresses and prices are fictional samples.
      </p>
      <p className="mt-6">
        <Link href="/shop" className="underline underline-offset-4">Shop all</Link> ·{" "}
        <Link href="/brands" className="underline underline-offset-4">Meet the designers</Link> ·{" "}
        <Link href="/contact" className="underline underline-offset-4">Contact us</Link>
      </p>
    </div>
  );
}
