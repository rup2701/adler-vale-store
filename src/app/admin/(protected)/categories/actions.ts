"use server";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { freeCategorySlug, nextPosition, swapPosition, type ActionResult } from "@/lib/admin-lists";
import { slugify } from "@/lib/slug";

const NAME_MAX = 40;

function checkName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, message: "Enter a category name." };
  if (name.length > NAME_MAX) return { ok: false, message: `Keep the name under ${NAME_MAX} characters.` };
  if (!slugify(name)) return { ok: false, message: "Use at least one letter or number in the name." };
  return { ok: true, name };
}

async function nameTaken(name: string, excludeId?: number) {
  const [hit] = await db
    .select({ id: s.categories.id })
    .from(s.categories)
    .where(
      excludeId
        ? and(sql`lower(${s.categories.name}) = ${name.toLowerCase()}`, ne(s.categories.id, excludeId))
        : sql`lower(${s.categories.name}) = ${name.toLowerCase()}`,
    );
  return !!hit;
}

function done() {
  revalidatePath("/", "layout");
}

export async function addCategoryAction(values: Record<string, string>): Promise<ActionResult> {
  await requireOwner();
  const c = checkName(String(values.name ?? ""));
  if (!c.ok) return c;
  if (await nameTaken(c.name)) return { ok: false, message: `There is already a category called “${c.name}”.` };
  const slug = await freeCategorySlug(c.name);
  await db.delete(s.categoryAliases).where(eq(s.categoryAliases.slug, slug));
  await db.insert(s.categories).values({ name: c.name, slug, position: await nextPosition(s.categories) });
  done();
  return { ok: true, message: `Added “${c.name}”. Next: assign products to it when you add or edit them. It stays hidden from shoppers until it has a published product.` };
}

export async function renameCategoryAction(id: number, values: Record<string, string>): Promise<ActionResult> {
  await requireOwner();
  const c = checkName(String(values.name ?? ""));
  if (!c.ok) return c;
  const [cat] = await db.select().from(s.categories).where(eq(s.categories.id, id));
  if (!cat) return { ok: false, message: "That category no longer exists." };
  if (await nameTaken(c.name, id)) return { ok: false, message: `There is already a category called “${c.name}”.` };
  const slug = slugify(c.name) === cat.slug ? cat.slug : await freeCategorySlug(c.name, id);
  await db.transaction(async (tx) => {
    if (slug !== cat.slug) {
      // The old address keeps working: it redirects to the new one.
      await tx.delete(s.categoryAliases).where(eq(s.categoryAliases.slug, slug));
      await tx.insert(s.categoryAliases).values({ slug: cat.slug, categoryId: id }).onConflictDoUpdate({
        target: s.categoryAliases.slug,
        set: { categoryId: id },
      });
    }
    await tx.update(s.categories).set({ name: c.name, slug }).where(eq(s.categories.id, id));
  });
  done();
  return { ok: true, message: `Renamed to “${c.name}”. Every product in it moved with it, and the old web address redirects to the new one.` };
}

export async function moveCategoryAction(id: number, dir: "up" | "down"): Promise<ActionResult> {
  await requireOwner();
  await swapPosition(s.categories, id, dir);
  done();
  return { ok: true, message: "Order updated. This is the order shoppers see in the menu." };
}

export async function deleteCategoryAction(id: number): Promise<ActionResult> {
  await requireOwner();
  const [cat] = await db.select().from(s.categories).where(eq(s.categories.id, id));
  if (!cat) return { ok: false, message: "That category was already deleted." };
  const n = await db.$count(s.products, eq(s.products.categoryId, id));
  if (n > 0) {
    return {
      ok: false,
      message: `“${cat.name}” still has ${n} product${n === 1 ? "" : "s"}. Move ${n === 1 ? "it" : "them"} to another category first, then delete.`,
    };
  }
  await db.delete(s.categories).where(eq(s.categories.id, id));
  done();
  return { ok: true, message: `Deleted “${cat.name}”.` };
}
