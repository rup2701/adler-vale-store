"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/collections", label: "Collections" },
  { href: "/admin/stores", label: "Stores & pickup" },
  { href: "/admin/announcement", label: "Announcement bar" },
  { href: "/admin/home", label: "Home page" },
  { href: "/admin/signups", label: "Email signups" },
  { href: "/admin/status", label: "Store status" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Owner area" className="md:sticky md:top-4 md:self-start">
      <ul className="flex flex-wrap gap-1 md:flex-col">
        {items.map((i) => {
          const active = pathname === i.href || pathname.startsWith(i.href + "/");
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn("block px-3 py-2 text-sm", active ? "bg-foreground text-background font-medium" : "hover:bg-white")}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
