import type { Metadata } from "next";
import Link from "next/link";
import { settings } from "@/config/settings";

export const metadata: Metadata = { title: "Returns & refunds" };

export default function ReturnsPage() {
  const days = settings.returnsWindowDays;
  const h2 = "mt-10 text-2xl";
  return (
    <div className="reading-column px-4 pb-4 pt-8 sm:px-6 md:pt-12">
      <h1 className="text-3xl md:text-4xl">Returns &amp; refunds</h1>
      <p className="mt-3 border border-primary bg-[#f6ecee] p-4 text-sm" data-testid="policy-demo-notice">
        This is a sample policy for a demo store. No real returns or refunds are processed.
      </p>

      <section aria-labelledby="glance" className="mt-8 bg-muted p-5">
        <h2 id="glance" className="text-xl">At a glance</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li><strong>{days} days</strong> to return unworn items.</li>
          <li>Refunds go back to your original payment method within <strong>5 to 7 business days</strong> of us receiving the return.</li>
          <li>Return shipping is <strong>free</strong> for damaged or incorrect items, and <strong>$8</strong> otherwise (or free to return in store).</li>
          <li><strong>Personalized items are final sale</strong> unless they arrive damaged or incorrect.</li>
        </ul>
      </section>

      <h2 className={h2}>Return window and condition</h2>
      <p className="mt-2 text-muted-foreground">
        You can return most items within {days} days of delivery or pickup. Items must be unworn, unwashed and unaltered, with all original
        tags attached. Shoes should be tried on indoors only. Jewelry must be unused and in its original pouch.
      </p>

      <h2 className={h2}>How to start a return</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>
          <Link href="/contact" className="underline underline-offset-4">Contact the studio</Link> with your order reference and the
          items you would like to return.
        </li>
        <li>We reply with a prepaid label, or you can bring the items to either of our stores.</li>
        <li>Pack the items securely with all tags attached and send them back.</li>
      </ol>

      <h2 className={h2}>Refund method and timing</h2>
      <p className="mt-2 text-muted-foreground">
        Refunds are issued to the original payment method within 5 to 7 business days after we receive and inspect your return. Original
        shipping charges are not refunded unless the item was damaged or incorrect. Exchanges for a different size are free, subject to stock.
      </p>

      <h2 className={h2}>Return shipping costs</h2>
      <p className="mt-2 text-muted-foreground">
        Returning by mail costs a flat $8, deducted from your refund. Returns in store are free. If your item arrived damaged or was not what
        you ordered, we pay for return shipping.
      </p>

      <h2 className={h2}>Personalized and final-sale items</h2>
      <p className="mt-2 text-muted-foreground">
        Personalized pieces, such as a monogrammed tote or scarf, are made for you and are <strong className="text-foreground">final sale unless
        they arrive damaged or incorrect</strong>. Items in the Sale category are returnable for store credit only.
      </p>

      <h2 className={h2}>Damaged or incorrect items</h2>
      <p className="mt-2 text-muted-foreground">
        If something arrives damaged, faulty or is not what you ordered, contact us within 7 days with a photo. We will send a replacement or
        refund you in full, including shipping, and cover the cost of the return.
      </p>

      <h2 className={h2}>Questions?</h2>
      <p className="mt-2 text-muted-foreground">
        See our <Link href="/help" className="underline underline-offset-4">Help &amp; FAQ</Link> or{" "}
        <Link href="/contact" className="underline underline-offset-4">contact the studio</Link>.
      </p>
    </div>
  );
}
