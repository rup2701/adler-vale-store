import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { settings } from "@/config/settings";
import { signOutAction } from "../actions";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "Owner area", template: `%s | Owner area` }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="border-b bg-foreground text-background on-dark">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="font-serif tracking-[0.1em]">
            {settings.store.name.toUpperCase()} <span className="ml-2 text-xs font-sans tracking-normal opacity-80">Owner area</span>
          </p>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" target="_blank" className="underline underline-offset-4">
              View store
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="cursor-pointer underline underline-offset-4" data-testid="sign-out">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <AdminNav />
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
