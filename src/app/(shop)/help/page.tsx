import type { Metadata } from "next";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { settings } from "@/config/settings";
import { formatCentsExact } from "@/lib/money";

export const metadata: Metadata = { title: "Help & FAQ" };

const o = settings.orders;

const topics: { id: string; title: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    id: "orders",
    title: "Orders and shipping",
    items: [
      {
        q: "How much does shipping cost?",
        a: `Shipping is a flat-rate estimate of ${formatCentsExact(o.shippingFlatCents)}, and it is free on orders over ${formatCentsExact(o.freeShippingOverCents)}. These are demo values for this sample store.`,
      },
      {
        q: "Can I pick my order up in a store?",
        a: "Yes. At checkout choose Pick up in store, then pick Los Gatos or Santa Barbara. Pickup has no shipping charge, and each store's usual ready time is shown at checkout and on the product page.",
      },
      {
        q: "Do you ship outside the United States?",
        a: "Not yet. Checkout currently accepts addresses in the United States only.",
      },
      {
        q: "What is the most I can buy of one item?",
        a: `You can add up to ${o.maxQuantityPerLine} of the same item and size to your cart. For larger orders, please contact the studio.`,
      },
    ],
  },
  {
    id: "returns",
    title: "Returns",
    items: [
      {
        q: "How long do I have to return something?",
        a: (
          <>
            {settings.returnsWindowDays} days from the day your order arrives or is picked up. Read the full{" "}
            <Link href="/returns" className="underline underline-offset-4">
              returns &amp; refunds policy
            </Link>
            .
          </>
        ),
      },
      {
        q: "Can I return a personalized item?",
        a: "Personalized pieces are final sale unless they arrive damaged or incorrect.",
      },
    ],
  },
  {
    id: "personalization",
    title: "Personalization",
    items: [
      {
        q: "Which pieces can be personalized?",
        a: "Only pieces that show a monogram field on their product page, such as the Wren Leather Tote and the Merino Wrap Scarf.",
      },
      {
        q: "What can I write?",
        a: `Letters, numbers, spaces and & . , ' - only. Each piece shows its own character limit (up to ${settings.personalization.defaultMaxLength} by default) and a live counter.`,
      },
    ],
  },
  {
    id: "care",
    title: "Care",
    items: [
      {
        q: "How do I care for my pieces?",
        a: "Each product page lists its materials and care. As a rule: dry clean silks and tailoring, hand wash knitwear cold and dry flat, wipe leather with a soft dry cloth, and store jewelry separately.",
      },
      { q: "Do you offer alterations?", a: "Our Los Gatos store can arrange alterations on request. Ask in store." },
    ],
  },
  {
    id: "demo",
    title: "About this demo",
    items: [
      {
        q: "Is this a real store?",
        a: "No. Alder & Vale is a demonstration store. Brands, products, addresses and prices are fictional samples.",
      },
      {
        q: "Will I be charged?",
        a: "No. Checkout is simulated. We never ask for card details and no payment is collected or processed. The payment methods in the footer are shown for demonstration only.",
      },
      {
        q: "Will I get a confirmation email?",
        a: "No. No email is sent. Your order reference appears on the confirmation page after checkout.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="reading-column px-4 pt-8 sm:px-6 md:pt-12">
      <h1 className="text-3xl md:text-4xl">Help &amp; FAQ</h1>
      <p className="mt-2 text-muted-foreground">Answers to common questions. Tap a question to open it.</p>
      <div className="mt-8 space-y-10">
        {topics.map((t) => (
          <section key={t.id} aria-labelledby={`topic-${t.id}`}>
            <h2 id={`topic-${t.id}`} className="mb-1 text-2xl">
              {t.title}
            </h2>
            <Accordion type="multiple" className="border-t">
              {t.items.map((it, i) => (
                <AccordionItem key={i} value={`${t.id}-${i}`}>
                  <AccordionTrigger>{it.q}</AccordionTrigger>
                  <AccordionContent>{it.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>
      <p className="mt-10 border-t pt-6">
        Still need help?{" "}
        <Link href="/contact" className="underline underline-offset-4">
          Contact the studio
        </Link>
        .
      </p>
    </div>
  );
}
