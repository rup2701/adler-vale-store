"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { setDepartment } from "@/app/actions/department";
import { cartCount, useCartState } from "@/components/cart/cart-store";
import { cn } from "@/lib/utils";

export type NavItem = { label: string; href: string };

function DeptSwitch({ department, className }: { department: "women" | "men"; className?: string }) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState(department);
  useEffect(() => setOptimistic(department), [department]);
  return (
    <div role="group" aria-label="Shop for" className={cn("flex items-center gap-4 text-sm", className)}>
      {(["women", "men"] as const).map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={optimistic === d}
          disabled={pending}
          onClick={() => {
            setOptimistic(d);
            start(() => setDepartment(d));
          }}
          className={cn(
            "eyebrow cursor-pointer border-b-2 py-1 transition-colors",
            optimistic === d ? "border-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {d === "women" ? "Women" : "Men"}
        </button>
      ))}
    </div>
  );
}

export function SiteHeader({
  storeName,
  logoUrl,
  nav,
  department,
}: {
  storeName: string;
  logoUrl: string | null;
  nav: NavItem[];
  department: "women" | "men";
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const count = cartCount(useCartState());

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const searchForm = (idSuffix: string) => (
    <form role="search" action="/shop" method="get" className="flex items-center">
      <label htmlFor={`search-${idSuffix}`} className="visually-hidden">
        Search products
      </label>
      <input
        id={`search-${idSuffix}`}
        name="q"
        type="search"
        placeholder="Search"
        className="h-9 w-full border-0 border-b border-[#8a847c] bg-transparent px-1 text-sm placeholder:text-[#6f6a64] focus-visible:outline-2 focus-visible:outline-primary md:w-40 lg:w-52"
      />
      <button type="submit" className="p-2 cursor-pointer hover:text-primary" aria-label="Submit search">
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>
    </form>
  );

  return (
    <header className="border-b bg-background">
      <div className="site-container">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3">
          <div className="flex items-center">
            <button
              type="button"
              className="mr-1 p-2 md:hidden cursor-pointer"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
            <DeptSwitch department={department} className="hidden md:flex" />
          </div>

          <Link href="/" className="justify-self-center text-center" aria-label={`${storeName} home`}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={storeName} className="h-9 w-auto max-w-[12rem] object-contain md:h-11" />
            ) : (
              <span className="font-serif text-2xl tracking-[0.12em] md:text-3xl">{storeName.toUpperCase()}</span>
            )}
          </Link>

          <div className="flex items-center justify-end gap-1">
            <div className="hidden md:block">{searchForm("desktop")}</div>
            <button
              type="button"
              className="p-2 md:hidden cursor-pointer"
              aria-expanded={searchOpen}
              aria-controls="mobile-search"
              aria-label="Search"
              onClick={() => setSearchOpen((o) => !o)}
            >
              <Search className="h-6 w-6" aria-hidden="true" />
            </button>
            <Link
              href="/cart"
              className="relative p-2 hover:text-primary"
              aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
              data-testid="cart-link"
            >
              <ShoppingBag className="h-6 w-6" aria-hidden="true" />
              <span
                data-testid="cart-count"
                className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground"
              >
                {count}
              </span>
            </Link>
          </div>
        </div>

        {searchOpen && (
          <div id="mobile-search" className="pb-3 md:hidden">
            {searchForm("mobile")}
          </div>
        )}

        <nav aria-label="Main" className="hidden justify-center pb-3 md:flex">
          <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-1 lg:gap-x-9">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "eyebrow inline-block border-b-2 py-1 hover:text-primary",
                    isActive(item.href) ? "border-foreground font-semibold" : "border-transparent",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {menuOpen && (
          <nav id="mobile-menu" aria-label="Main" className="border-t pb-4 pt-3 md:hidden">
            <DeptSwitch department={department} className="mb-3" />
            <ul>
              {nav.map((item) => (
                <li key={item.href} className="border-b">
                  <Link href={item.href} className="eyebrow block py-3" aria-current={isActive(item.href) ? "page" : undefined}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
