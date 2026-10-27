import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";

export default async function AdminHome() {
  await requireOwner();
  redirect("/admin/products");
}
