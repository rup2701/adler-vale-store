"use server";
import { z } from "zod";
import { db } from "@/db";
import { emailSignups } from "@/db/schema";

export type SignupState = { status: "idle" | "ok" | "error"; message: string };

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address, like name@example.com.");

/** Stores the address and says thank you. Nothing is sent. Signing up twice is fine. */
export async function subscribeEmail(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  try {
    await db.insert(emailSignups).values({ email: parsed.data }).onConflictDoNothing({ target: emailSignups.email });
  } catch (e) {
    console.error("[signup] failed", e);
    return { status: "error", message: "We couldn't save your address just now. Please try again in a moment." };
  }
  return { status: "ok", message: "Thank you! You're on the list. (This is a demo store, so no emails will be sent.)" };
}
