"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { parseProductInput, type FieldErrors } from "@/lib/product-input";
import { saveProductRecord, setPublished } from "@/lib/product-admin";
import { getStorage } from "@/lib/storage";

export type SaveActionResult =
  | { ok: true; id: number; slug: string; created: boolean }
  | { ok: false; errors: FieldErrors };

export async function saveProductAction(raw: unknown): Promise<SaveActionResult> {
  await requireOwner();
  const parsed = parseProductInput(raw);
  if (!parsed.ok) return parsed;
  const res = await saveProductRecord(parsed.data);
  if (res.ok) {
    revalidatePath("/", "layout");
    return { ok: true, id: res.id, slug: res.slug, created: res.created };
  }
  return res;
}

export async function setPublishedAction(id: number, publish: boolean): Promise<{ ok: true } | { ok: false; reason: string }> {
  await requireOwner();
  const res = await setPublished(id, publish);
  revalidatePath("/", "layout");
  return res;
}

export async function deleteProductAction(id: number): Promise<{ ok: boolean }> {
  await requireOwner();
  const images = await db.select().from(s.productImages).where(eq(s.productImages.productId, id));
  await db.delete(s.products).where(eq(s.products.id, id));
  try {
    const storage = getStorage();
    for (const i of images) {
      await storage.remove(i.url);
      await storage.remove(i.thumbUrl);
      await storage.remove(i.originalUrl);
    }
  } catch {
    /* files are cleaned up on a best-effort basis */
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
