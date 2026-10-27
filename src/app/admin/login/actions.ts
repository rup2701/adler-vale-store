"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/lib/auth";

/** `email` is sent back so the form keeps what the owner typed after a failed attempt. */
export type LoginState = { error: string | null; locked: boolean; email?: string };

const schema = z.object({ email: z.string().max(200), password: z.string().max(200) });

export async function signInAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").slice(0, 200);
  const parsed = schema.safeParse({ email, password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { error: "Enter your email and password.", locked: false, email };
  if (!parsed.data.email.trim() || !parsed.data.password) return { error: "Enter your email and password.", locked: false, email };
  let result;
  try {
    result = await signIn(parsed.data.email, parsed.data.password);
  } catch (e) {
    console.error("[admin sign-in] failed", e);
    return { error: "Sign-in isn't available right now. Please try again in a moment.", locked: false, email };
  }
  if (result.ok) redirect("/admin/products");
  if (result.reason === "locked") {
    return {
      error: `Too many failed attempts. Sign-in is paused for ${result.minutesLeft} more ${result.minutesLeft === 1 ? "minute" : "minutes"}. Please try again later.`,
      locked: true,
      email,
    };
  }
  return { error: "That email or password isn't right. Please check them and try again.", locked: false, email };
}
