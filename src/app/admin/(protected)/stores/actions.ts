"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { nextPosition, swapPosition, type ActionResult } from "@/lib/admin-lists";

const schema = z.object({
  name: z.string().trim().min(1, "Enter the store name.").max(60, "Keep the name under 60 characters."),
  address: z.string().trim().min(1, "Enter the store's address.").max(200, "Keep the address under 200 characters."),
  phone: z.string().trim().min(1, "Enter a phone number.").max(30, "Keep the phone number under 30 characters."),
  pickup: z.boolean(),
  pickupReady: z.string().trim().max(100, "Keep the ready time under 100 characters."),
  note: z.string().trim().max(60, "Keep the note under 60 characters."),
});

function parse(v: Record<string, string>) {
  const p = schema.safeParse({
    name: v.name ?? "",
    address: v.address ?? "",
    phone: v.phone ?? "",
    pickup: v.pickup === "true",
    pickupReady: v.pickupReady ?? "",
    note: v.note ?? "",
  });
  return p.success ? { ok: true as const, data: p.data } : { ok: false as const, message: p.error.issues[0].message };
}

export async function addStoreAction(values: Record<string, string>): Promise<ActionResult> {
  await requireOwner();
  const p = parse(values);
  if (!p.ok) return p;
  await db.insert(s.stores).values({ ...p.data, position: await nextPosition(s.stores) });
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Added the ${p.data.name} store. It now shows in the footer${p.data.pickup ? ", on product pages and at checkout for pickup" : ""}.`,
  };
}

export async function updateStoreAction(id: number, values: Record<string, string>): Promise<ActionResult> {
  await requireOwner();
  const p = parse(values);
  if (!p.ok) return p;
  await db.update(s.stores).set(p.data).where(eq(s.stores.id, id));
  revalidatePath("/", "layout");
  return { ok: true, message: `Saved the ${p.data.name} store.` };
}

export async function moveStoreAction(id: number, dir: "up" | "down"): Promise<ActionResult> {
  await requireOwner();
  await swapPosition(s.stores, id, dir);
  revalidatePath("/", "layout");
  return { ok: true, message: "Order updated." };
}

export async function deleteStoreAction(id: number): Promise<ActionResult> {
  await requireOwner();
  const [st] = await db.select().from(s.stores).where(eq(s.stores.id, id));
  if (!st) return { ok: false, message: "That store was already deleted." };
  await db.delete(s.stores).where(eq(s.stores.id, id));
  revalidatePath("/", "layout");
  return { ok: true, message: `Deleted the ${st.name} store. Past orders keep its name.` };
}
