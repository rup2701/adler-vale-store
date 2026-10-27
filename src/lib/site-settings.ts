import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { settings } from "@/config/settings";

export type Announcement = { enabled: boolean; messages: string[] };
export type HomeSettings = {
  heroHeadline: string;
  heroButtonLabel: string;
  heroButtonHref: string;
  heroImageUrl: string | null;
  heroImageAlt: string;
  logoUrl: string | null;
};

export const defaultAnnouncement = (): Announcement => ({
  enabled: settings.defaults.announcementEnabled,
  messages: [...settings.defaults.announcementMessages],
});

export const defaultHome = (): HomeSettings => ({
  heroHeadline: settings.defaults.heroHeadline,
  heroButtonLabel: settings.defaults.heroButtonLabel,
  heroButtonHref: settings.defaults.heroButtonHref,
  heroImageUrl: null,
  heroImageAlt: "",
  logoUrl: null,
});

async function read<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
  return row ? ({ ...fallback, ...(row.value as object) } as T) : fallback;
}

export function getAnnouncement() {
  return read<Announcement>("announcement", defaultAnnouncement());
}

export function getHomeSettings() {
  return read<HomeSettings>("home", defaultHome());
}

export async function saveSetting(key: "announcement" | "home", value: object) {
  await db
    .insert(siteSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value } });
}
