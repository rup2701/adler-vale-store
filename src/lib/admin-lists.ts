import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { slugify } from "@/lib/slug";

export type ActionResult = { ok: boolean; message: string };

/** Swap an item with its neighbour in a table that has an integer position column. */
type Ordered = typeof s.categories | typeof s.brands | typeof s.stores;

export async function swapPosition(table: Ordered, id: number, dir: "up" | "down") {
  const rows = await db.select({ id: table.id, position: table.position }).from(table).orderBy(table.position, table.id);
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return;
  // Rewrite positions as 0..n-1 so ties never leave things unordered.
  const order = rows.map((r) => r.id);
  [order[i], order[j]] = [order[j], order[i]];
  await db.transaction(async (tx) => {
    for (let k = 0; k < order.length; k++) {
      await tx.update(table).set({ position: k }).where(eq(table.id, order[k]));
    }
  });
}

export async function nextPosition(table: Ordered): Promise<number> {
  const [row] = await db.select({ max: sql<number>`coalesce(max(${table.position}), -1)::int` }).from(table);
  return (row?.max ?? -1) + 1;
}

/** A slug for a category that is not used by another category and is not someone else's old address. */
export async function freeCategorySlug(name: string, excludeId?: number): Promise<string> {
  const base = slugify(name) || "category";
  for (let i = 1; i < 200; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const [hit] = await db
      .select({ id: s.categories.id })
      .from(s.categories)
      .where(excludeId ? and(eq(s.categories.slug, candidate), ne(s.categories.id, excludeId)) : eq(s.categories.slug, candidate));
    if (!hit) return candidate;
  }
  return `${base}-${Date.now()}`;
}
