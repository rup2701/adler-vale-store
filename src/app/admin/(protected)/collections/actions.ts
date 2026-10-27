"use server";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import type { ActionResult } from "@/lib/admin-lists";
import { slugify } from "@/lib/slug";

const schema = z.object({
  name: z.string().transform((v) => v.replace(/\s+/g, " ").trim()).pipe(z.string().min(1, "Enter a collection name.").max(60, "Keep the name under 60 characters.")),
  description: z.string().trim().max(300, "Keep the description under 300 characters."),
});

async function freeSlug(name: string, excludeId?: number) {
  const base = slugify(name) || "collection";
  for (let i = 1; i < 200; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const [hit] = await db
      .select({ id: s.collections.id })
      .from(s.collections)
      .where(excludeId ? and(eq(s.collections.slug, candidate), ne(s.collections.id, excludeId)) : eq(s.collections.slug, candidate));
    if (!hit) return candidate;
  }
  return `${base}-${Date.now()}`;
}

async function taken(name: string, excludeId?: number) {
  const cond = sql`lower(${s.collections.name}) = ${name.toLowerCase()}`;
  const [hit] = await db.select({ id: s.collections.id }).from(s.collections).where(excludeId ? and(cond, ne(s.collections.id, excludeId)) : cond);
  return !!hit;
}

function parse(values: Record<string, string>) {
  const p = schema.safeParse({ name: values.name ?? "", description: values.description ?? "" });
  return p.success ? { ok: true as const, data: p.data } : { ok: false as const, message: p.error.issues[0].message };
}

export async function addCollectionAction(values: Record<string, string>): Promise<ActionResult> {
  await requireOwner();
  const p = parse(values);
  if (!p.ok) return p;
  if (await taken(p.data.name)) return { ok: false, message: `There is already a collection called “${p.data.name}”.` };
  await db.insert(s.collections).values({ ...p.data, slug: await freeSlug(p.data.name) });
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Added “${p.data.name}”. Next: tick it on products (in the product form), then choose whether it shows on the home page under Home page.`,
  };
}

export async function updateCollectionAction(id: number, values: Record<string, string>): Promise<ActionResult> {
  await requireOwner();
  const p = parse(values);
  if (!p.ok) return p;
  if (await taken(p.data.name, id)) return { ok: false, message: `There is already a collection called “${p.data.name}”.` };
  await db.update(s.collections).set(p.data).where(eq(s.collections.id, id));
  revalidatePath("/", "layout");
  return { ok: true, message: `Saved “${p.data.name}”. Its web address stays the same.` };
}

export async function deleteCollectionAction(id: number): Promise<ActionResult> {
  await requireOwner();
  const [c] = await db.select().from(s.collections).where(eq(s.collections.id, id));
  if (!c) return { ok: false, message: "That collection was already deleted." };
  await db.delete(s.collections).where(eq(s.collections.id, id));
  revalidatePath("/", "layout");
  return { ok: true, message: `Deleted “${c.name}”. The products in it were not deleted.` };
}
