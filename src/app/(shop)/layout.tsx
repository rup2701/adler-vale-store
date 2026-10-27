import { AnnouncementBar } from "@/components/site/announcement-bar";
import { SiteHeader, type NavItem } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { StorageNotice } from "@/components/cart/storage-notice";
import { getStores, getVisibleCategories } from "@/lib/catalog";
import { getAnnouncement, getHomeSettings, defaultAnnouncement, defaultHome } from "@/lib/site-settings";
import { getDepartment } from "@/lib/dept";
import { settings } from "@/config/settings";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[layout] database unavailable", e);
    return fallback;
  }
}

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  // The layout must still render when the database is down, so the page's error screen can show.
  const [categories, announcement, home, stores, department] = await Promise.all([
    safe(getVisibleCategories, []),
    safe(getAnnouncement, defaultAnnouncement()),
    safe(getHomeSettings, defaultHome()),
    safe(getStores, []),
    getDepartment(),
  ]);

  const sale = categories.find((c) => c.name.toLowerCase() === "sale");
  const nav: NavItem[] = [
    ...categories.filter((c) => c !== sale).map((c) => ({ label: c.name, href: `/shop/${c.slug}` })),
    { label: "Designers", href: "/brands" },
    ...(sale ? [{ label: sale.name, href: `/shop/${sale.slug}` }] : []),
  ];

  return (
    <>
      <a
        href="#main"
        className="visually-hidden focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-background focus:p-3"
      >
        Skip to main content
      </a>
      {announcement.enabled && announcement.messages.length > 0 && <AnnouncementBar messages={announcement.messages} />}
      <SiteHeader storeName={settings.store.name} logoUrl={home.logoUrl} nav={nav} department={department} />
      <StorageNotice />
      <main id="main">{children}</main>
      <SiteFooter stores={stores} />
    </>
  );
}
