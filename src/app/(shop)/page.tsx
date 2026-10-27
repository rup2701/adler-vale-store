import Link from "next/link";
import { getHomeCollections, getVisibleBrands } from "@/lib/catalog";
import { getHomeSettings } from "@/lib/site-settings";
import { getDepartment } from "@/lib/dept";
import { ProductCard } from "@/components/shop/product-card";
import { EmailSignup } from "@/components/site/email-signup";
import { Placeholder } from "@/components/shop/placeholder";
import { buttonVariants } from "@/components/ui/button";
import { settings } from "@/config/settings";

export default async function HomePage() {
  const department = await getDepartment();
  const [home, brands, sections] = await Promise.all([getHomeSettings(), getVisibleBrands(), getHomeCollections(department)]);

  return (
    <>
      <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden bg-[#e7e2db]">
        <div className="absolute inset-0 -z-10">
          {home.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={home.heroImageUrl} alt={home.heroImageAlt} className="h-full w-full object-cover" />
          ) : (
            <Placeholder label="" />
          )}
          {home.heroImageUrl && <div className="absolute inset-0 bg-black/25" aria-hidden="true" />}
        </div>
        <div
          className={`site-container flex min-h-[26rem] items-end py-12 md:min-h-[34rem] lg:min-h-[40rem] ${home.heroImageUrl ? "on-dark text-white" : ""}`}
        >
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">{settings.store.name} · {settings.store.town}</p>
            <h1 id="hero-heading" className="text-4xl leading-tight md:text-6xl">
              {home.heroHeadline}
            </h1>
            <p className="mt-3 max-w-lg text-base md:text-lg">{settings.store.tagline}</p>
            <Link
              href={home.heroButtonHref}
              className={buttonVariants({ variant: home.heroImageUrl ? "outline" : "dark", size: "lg", className: home.heroImageUrl ? "mt-6 border-white text-white hover:bg-white hover:text-black" : "mt-6" })}
            >
              {home.heroButtonLabel}
            </Link>
          </div>
        </div>
      </section>

      {brands.length > 0 && (
        <section aria-labelledby="brands-heading" className="border-b py-8">
          <div className="site-container">
            <h2 id="brands-heading" className="eyebrow mb-4 text-center font-sans font-semibold">
              The designers we carry
            </h2>
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:gap-x-14">
              {brands.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/brands/${b.slug}`}
                    className="font-serif text-lg tracking-wide hover:text-primary hover:underline underline-offset-8 md:text-2xl"
                  >
                    {b.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {sections.length === 0 && (
        <section className="site-container py-16 text-center">
          <h2 className="text-2xl">New pieces are on their way</h2>
          <p className="mt-2 text-muted-foreground">
            {department === "men" ? "The men's collection is empty for now. " : ""}
            Browse everything we have in the shop.
          </p>
          <Link href="/shop" className={buttonVariants({ className: "mt-6" })}>
            Browse products
          </Link>
        </section>
      )}

      {sections.map(({ collection, products }) => (
        <section key={collection.id} aria-labelledby={`col-${collection.id}`} className="site-container pt-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id={`col-${collection.id}`} className="text-2xl md:text-3xl">
                {collection.name}
              </h2>
              {collection.description && <p className="mt-1 text-muted-foreground">{collection.description}</p>}
            </div>
            <Link href={`/collections/${collection.slug}`} className="eyebrow underline underline-offset-4 hover:text-primary">
              View all<span className="visually-hidden"> {collection.name}</span>
            </Link>
          </div>
          <ul className="product-grid home-grid">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <EmailSignup />
    </>
  );
}
