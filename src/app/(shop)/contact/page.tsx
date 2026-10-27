import type { Metadata } from "next";
import Link from "next/link";
import { settings } from "@/config/settings";
import { getStores } from "@/lib/catalog";

export const metadata: Metadata = { title: "Contact us" };

export default async function ContactPage() {
  const stores = await getStores();
  return (
    <div className="reading-column px-4 pt-8 sm:px-6 md:pt-12">
      <h1 className="text-3xl md:text-4xl">Contact us</h1>
      <p className="mt-3 border border-primary bg-[#f6ecee] p-4 text-sm" data-testid="contact-demo-notice">
        This is a demo store. Messages are not monitored, and this page has no form: nothing you type here is sent anywhere.
      </p>

      <section aria-labelledby="email-heading" className="mt-8">
        <h2 id="email-heading" className="text-2xl">Email</h2>
        <p className="mt-2 select-all text-lg" data-testid="contact-email">
          <a href={`mailto:${settings.store.contactEmail}`} className="underline underline-offset-4">
            {settings.store.contactEmail}
          </a>
        </p>
        <p className="mt-1 text-muted-foreground">{settings.store.responseTime}</p>
      </section>

      <section aria-labelledby="hours-heading" className="mt-8">
        <h2 id="hours-heading" className="text-2xl">Studio hours</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          {settings.store.hours.map((h) => (
            <div key={h.days} className="contents">
              <dt className="font-medium">{h.days}</dt>
              <dd className="text-muted-foreground">{h.hours}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="stores-heading" className="mt-8">
        <h2 id="stores-heading" className="text-2xl">Our stores</h2>
        <ul className="mt-2 space-y-4">
          {stores.map((s) => (
            <li key={s.id}>
              <p className="font-medium">
                {s.name}
                {s.note ? <span className="ml-2 text-sm font-normal text-muted-foreground">({s.note})</span> : null}
              </p>
              <p className="text-muted-foreground">{s.address}</p>
              <p>
                <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-4">{s.phone}</a>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 border-t pt-6">
        Looking for answers fast? Try{" "}
        <Link href="/help" className="underline underline-offset-4">Help &amp; FAQ</Link> or read our{" "}
        <Link href="/returns" className="underline underline-offset-4">returns &amp; refunds policy</Link>.
      </p>
    </div>
  );
}
