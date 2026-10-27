import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isOwner } from "@/lib/auth";
import { settings } from "@/config/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Owner sign-in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await isOwner().catch(() => false)) redirect("/admin/products");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <p className="font-serif text-2xl tracking-[0.12em]">{settings.store.name.toUpperCase()}</p>
      <h1 className="mt-6 text-3xl">Owner sign-in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to manage products, photos and stock.</p>
      <LoginForm />
      <p className="mt-8 text-sm">
        <Link href="/" className="underline underline-offset-4">
          Back to the store
        </Link>
      </p>
    </main>
  );
}
