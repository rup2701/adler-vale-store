"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DEPT_COOKIE } from "@/lib/dept";

export async function setDepartment(dept: string) {
  const value = dept === "men" ? "men" : "women";
  const jar = await cookies();
  jar.set(DEPT_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
