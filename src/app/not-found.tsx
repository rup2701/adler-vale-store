import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { settings } from "@/config/settings";

export default function GlobalNotFound() {
  return (
    <main className="reading-column px-4 py-24 text-center">
      <p className="font-serif text-2xl tracking-[0.12em]">{settings.store.name.toUpperCase()}</p>
      <h1 className="mt-8 text-3xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted-foreground">It may have moved, or the link may be mistyped.</p>
      <Link href="/shop" className={buttonVariants({ className: "mt-8" })}>
        Browse the shop
      </Link>
    </main>
  );
}
