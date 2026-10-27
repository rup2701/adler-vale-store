import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { storageStatus } from "@/lib/storage";
import { TEMPLATE_VERSION } from "@/config/settings";
import { isDeployed } from "@/lib/env";

export type StoreStatus = {
  database: { ok: boolean; message: string };
  storage: { ok: boolean; kind: string; message: string };
  ownerConfigured: boolean;
  deployed: boolean;
  templateVersion: string;
  events: { id: number; kind: string; message: string; createdAt: string }[];
  counts: { products: number; orders: number } | null;
};

export async function getStoreStatus(): Promise<StoreStatus> {
  let database = { ok: true, message: "The database is reachable." };
  let events: StoreStatus["events"] = [];
  let counts: StoreStatus["counts"] = null;
  try {
    await db.execute(sql`select 1`);
    const rows = await db.select().from(s.systemEvents).orderBy(desc(s.systemEvents.createdAt)).limit(10);
    events = rows.map((r) => ({ id: r.id, kind: r.kind, message: r.message, createdAt: r.createdAt.toISOString() }));
    counts = { products: await db.$count(s.products), orders: await db.$count(s.orders) };
  } catch (e) {
    database = {
      ok: false,
      message: `The database can't be reached (${e instanceof Error ? e.message : "unknown error"}). Shoppers see “The shop is having a moment”. Check that the database is running and that DATABASE_URL is correct.`,
    };
  }
  return {
    database,
    storage: storageStatus(),
    ownerConfigured: !!process.env.OWNER_EMAIL && !!process.env.OWNER_PASSWORD_HASH,
    deployed: isDeployed(),
    templateVersion: TEMPLATE_VERSION,
    events,
    counts,
  };
}
