"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { getHomeSettings, saveSetting } from "@/lib/site-settings";
import type { ActionResult } from "@/lib/admin-lists";

const heroSchema = z.object({
  heroHeadline: z.string().trim().min(1, "Write a headline.").max(90, "Keep the headline under 90 characters."),
  heroButtonLabel: z.string().trim().min(1, "Write the button label.").max(30, "Keep the button label under 30 characters."),
  heroButtonHref: z
    .string()
    .trim()
    .min(1, "Enter where the button goes.")
    .max(200)
    .refine((v) => /^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v), "The button link must start with / (a page in your store) or https://."),
  heroImageAlt: z.string().trim().max(200, "Keep the alt text under 200 characters."),
});

export async function saveHeroAction(input: Record<string, string>): Promise<ActionResult> {
  await requireOwner();
  const parsed = heroSchema.safeParse({
    heroHeadline: input.heroHeadline ?? "",
    heroButtonLabel: input.heroButtonLabel ?? "",
    heroButtonHref: input.heroButtonHref ?? "",
    heroImageAlt: input.heroImageAlt ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const home = await getHomeSettings();
  await saveSetting("home", { ...home, ...parsed.data });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. The home page hero now shows your headline and button." };
}

export async function saveHomeCollectionsAction(items: { id: number; show: boolean }[]): Promise<ActionResult> {
  await requireOwner();
  const parsed = z.array(z.object({ id: z.number().int(), show: z.boolean() })).max(100).safeParse(items);
  if (!parsed.success) return { ok: false, message: "That request could not be read." };
  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.length; i++) {
      await tx
        .update(s.collections)
        .set({ showOnHome: parsed.data[i].show, homePosition: i })
        .where(eq(s.collections.id, parsed.data[i].id));
    }
  });
  revalidatePath("/", "layout");
  const n = parsed.data.filter((i) => i.show).length;
  return { ok: true, message: `Saved. ${n} collection${n === 1 ? "" : "s"} will show on the home page, in this order. A collection with no published products is skipped.` };
}
