import type { Metadata } from "next";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { getHomeSettings } from "@/lib/site-settings";
import { storageStatus } from "@/lib/storage";
import { HomeSettingsForm } from "@/components/admin/home-settings";

export const metadata: Metadata = { title: "Home page" };

export default async function AdminHomePage() {
  await requireOwner();
  const home = await getHomeSettings();
  const cols = await db
    .select({
      id: s.collections.id,
      name: s.collections.name,
      show: s.collections.showOnHome,
      count: sql<number>`count(${s.productCollections.productId})::int`,
    })
    .from(s.collections)
    .leftJoin(s.productCollections, eq(s.productCollections.collectionId, s.collections.id))
    .groupBy(s.collections.id)
    .orderBy(sql`${s.collections.showOnHome} desc`, asc(s.collections.homePosition), asc(s.collections.id));
  return (
    <div>
      <h1 className="text-3xl">Home page</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">The banner, the logo and which collections shoppers see first.</p>
      <HomeSettingsForm home={home} storage={storageStatus()} collections={cols} />
    </div>
  );
}
