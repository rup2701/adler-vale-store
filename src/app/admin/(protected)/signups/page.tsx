import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { emailSignups } from "@/db/schema";
import { requireOwner } from "@/lib/auth";

export const metadata: Metadata = { title: "Email signups" };

export default async function AdminSignupsPage() {
  await requireOwner();
  const rows = await db.select().from(emailSignups).orderBy(desc(emailSignups.createdAt));
  return (
    <div>
      <h1 className="text-3xl">Email signups <span className="text-xl text-muted-foreground">({rows.length})</span></h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Addresses collected by the signup strip on the home page. Nothing is sent to them from this store.
      </p>
      {rows.length === 0 ? (
        <p className="border bg-white p-8 text-center text-muted-foreground" data-testid="signups-empty">
          No signups yet. They appear here when a shopper uses the form near the bottom of the home page.
        </p>
      ) : (
        <div className="overflow-x-auto border bg-white">
          <table className="w-full text-left text-sm" data-testid="signups-table">
            <caption className="visually-hidden">Email signups, newest first</caption>
            <thead className="border-b bg-muted text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="p-3">Email</th>
                <th scope="col" className="p-3">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-3">{r.email}</td>
                  <td className="p-3 text-muted-foreground">{r.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
