"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { saveSetting } from "@/lib/site-settings";
import type { ActionResult } from "@/lib/admin-lists";

const schema = z.object({
  enabled: z.boolean(),
  messages: z.array(z.string().trim().min(1).max(120, "Keep each message under 120 characters.")).max(5, "Use at most 5 messages."),
});

export async function saveAnnouncementAction(input: { enabled: boolean; messages: string }): Promise<ActionResult> {
  await requireOwner();
  const lines = String(input.messages ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed = schema.safeParse({ enabled: !!input.enabled, messages: lines });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (parsed.data.enabled && parsed.data.messages.length === 0) {
    return { ok: false, message: "Write at least one message, or switch the announcement bar off." };
  }
  await saveSetting("announcement", parsed.data);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: parsed.data.enabled
      ? `Saved. The announcement bar now shows ${parsed.data.messages.length} message${parsed.data.messages.length === 1 ? "" : "s"} at the top of every page.`
      : "Saved. The announcement bar is switched off.",
  };
}
