import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { getAnnouncement } from "@/lib/site-settings";
import { AnnouncementForm } from "@/components/admin/announcement-form";

export const metadata: Metadata = { title: "Announcement bar" };

export default async function AdminAnnouncementPage() {
  await requireOwner();
  const a = await getAnnouncement();
  return (
    <div>
      <h1 className="text-3xl">Announcement bar</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        The thin bar above the header on every page. Use it for news such as a new location or an offer. Note: it only displays text. It does not
        apply discounts, so only mention an offer you honor in store.
      </p>
      <AnnouncementForm enabled={a.enabled} messages={a.messages} />
    </div>
  );
}
