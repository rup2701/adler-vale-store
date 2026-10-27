import { cookies } from "next/headers";
import type { Department } from "@/config/settings";

export const DEPT_COOKIE = "av_dept";

/** Women is the default. The switch only filters by the department field on each product. */
export async function getDepartment(): Promise<Department> {
  const jar = await cookies();
  return jar.get(DEPT_COOKIE)?.value === "men" ? "men" : "women";
}
