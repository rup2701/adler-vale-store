import Link from "next/link";
import { settings } from "@/config/settings";

type FooterStore = { id: number; name: string; address: string; phone: string; note: string };

export function SiteFooter({ stores }: { stores: FooterStore[] }) {
  const year = new Date().getFullYear();
  const linkClass = "py-1 inline-block hover:underline underline-offset-4";
  return (
    <footer className="mt-20 border-t bg-muted" aria-label="Site footer">
      <div className="site-container grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <nav aria-labelledby="footer-service">
          <h2 id="footer-service" className="eyebrow mb-3 font-sans font-semibold">
            Customer Service
          </h2>
          <ul className="space-y-1 text-sm">
            <li><Link className={linkClass} href="/help">Help &amp; FAQ</Link></li>
            <li><Link className={linkClass} href="/returns">Returns &amp; refunds</Link></li>
            <li><Link className={linkClass} href="/contact">Contact us</Link></li>
          </ul>
        </nav>
        <section aria-labelledby="footer-stores">
          <h2 id="footer-stores" className="eyebrow mb-3 font-sans font-semibold">
            Stores &amp; Contact
          </h2>
          <ul className="space-y-3 text-sm">
            {stores.map((st) => (
              <li key={st.id}>
                <p className="font-medium">
                  {st.name}
                  {st.note ? <span className="ml-2 text-xs text-muted-foreground">({st.note})</span> : null}
                </p>
                <p className="text-muted-foreground">{st.address}</p>
                <p>
                  <a className="underline-offset-4 hover:underline" href={`tel:${st.phone.replace(/[^\d+]/g, "")}`}>
                    {st.phone}
                  </a>
                </p>
              </li>
            ))}
            <li>
              <a className="underline-offset-4 hover:underline" href={`mailto:${settings.store.contactEmail}`}>
                {settings.store.contactEmail}
              </a>
            </li>
          </ul>
        </section>
        <nav aria-labelledby="footer-explore">
          <h2 id="footer-explore" className="eyebrow mb-3 font-sans font-semibold">
            Explore
          </h2>
          <ul className="space-y-1 text-sm">
            <li><Link className={linkClass} href="/about">About us</Link></li>
            <li><Link className={linkClass} href="/gift-cards">Gift cards</Link></li>
            <li><Link className={linkClass} href="/shop">Shop all</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <div className="site-container flex flex-col gap-3 py-6 text-xs text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-1 font-medium text-foreground">Payment methods we plan to accept at launch (demo information)</p>
            <ul aria-label="Accepted payment methods, shown for demo only" className="flex flex-wrap gap-x-4 gap-y-1">
              {settings.paymentMethodsDemo.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div className="lg:text-right">
            <p>This is a demo store. Checkout is simulated and does not collect any payment.</p>
            <p>
              &copy; {year} {settings.store.name}. Sample products and fictional brands.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
