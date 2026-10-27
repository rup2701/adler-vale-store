import { requireOwnerApi } from "@/lib/auth";
import { getStoreStatus } from "@/lib/status";

export async function GET() {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  return Response.json(await getStoreStatus());
}
