"use server";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { nextPosition, swapPosition, type ActionResult } from "@/lib/admin-lists";
import { slugify } from "@/lib/slug";

const schema = z.object({
  name: z.string().transform((v) => v.replace(/\s+/g, " ").trim()).pipe(z.string().min(1, "Enter a brand name.").max(60, "Keep the name under 60 characters.")),
  description: z.string().trim().max(400, "Keep the description under 400 characters."),
});

async function freeSlug(name: string, excludeId?: number) {
  const base = slugify(name) || "brand";
  for (let i = 1; i < 200; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const [hit] = await db
      .select({ id: s.brands.id })
      .from(s.brands)
      .where(excludeId ? and(eq(s.brands.slug, candidate), ne(s.brands.id, excludeId)) : eq(s.brands.slug, candidate));
    if (!hit) return candidate;
  }
  return `${base}-${Date.now()}`;
}

async function taken(name: string, excludeId?: number) {
  const cond = sql`lower(${s.brands.name}) = ${name.toLowerCase()}`;
  const [hit] = await db.select({ id: s.brands.id }).from(s.brands).where(excludeId ? and(cond, ne(s.brands.id, excludeId)) : cond);
  return !!hit;
}

function parse(values: Record<string, string>) {
  const p = schema.safeParse({ name: values.name ?? "", description: values.description ?? "" });
  return p.success ? { ok: true as const, data: p.data } : { ok: false as const, message: p.error.issues[0].message };
}

export async function addBrandAction(values: Record<string, string>): Promise<ActionResult> {
  await requireOwner();
  const p = parse(values);
  if (!p.ok) return p;
  if (await taken(p.data.name)) return { ok: false, message: `There is already a brand called “${p.data.name}”.` };
  await db.insert(s.brands).values({ ...p.data, slug: await freeSlug(p.data.name), position: await nextPosition(s.brands) });
  revalidatePath("/", "layout");
  return { ok: true, message: `Added “${p.data.name}”. Next: choose it when you add or edit a product. It shows on the Designers page once it has a published product.` };
}

export async function updateBrandAction(id: number, values: Record<string, string>): Promise<ActionResult> {
  await requireOwner();
  const p = parse(values);
  if (!p.ok) return p;
  if (await taken(p.data.name, id)) return { ok: false, message: `There is already a brand called “${p.data.name}”.` };
  await db.update(s.brands).set(p.data).where(eq(s.brands.id, id));
  revalidatePath("/", "layout");
  return { ok: true, message: `Saved “${p.data.name}”. The brand's web address stays the same.` };
}

export async function moveBrandAction(id: number, dir: "up" | "down"): Promise<ActionResult> {
  await requireOwner();
  await swapPosition(s.brands, id, dir);
  revalidatePath("/", "layout");
  return { ok: true, message: "Order updated. This is the order of the brands strip on the home page." };
}

export async function deleteBrandAction(id: number): Promise<ActionResult> {
  await requireOwner();
  const [b] = await db.select().from(s.brands).where(eq(s.brands.id, id));
  if (!b) return { ok: false, message: "That brand was already deleted." };
  const n = await db.$count(s.products, eq(s.products.brandId, id));
  if (n > 0) {
    return { ok: false, message: `“${b.name}” still has ${n} product${n === 1 ? "" : "s"}. Move ${n === 1 ? "it" : "them"} to another brand first, then delete.` };
  }
  await db.delete(s.brands).where(eq(s.brands.id, id));
  revalidatePath("/", "layout");
  return { ok: true, message: `Deleted “${b.name}”.` };
}
