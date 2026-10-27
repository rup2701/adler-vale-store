"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveHeroAction, saveHomeCollectionsAction } from "@/app/admin/(protected)/home/actions";
import type { HomeSettings } from "@/lib/site-settings";

type Msg = { ok: boolean; message: string } | null;

function MessageBox({ msg, boxRef, id }: { msg: Msg; boxRef: React.RefObject<HTMLDivElement | null>; id: string }) {
  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      role={msg && !msg.ok ? "alert" : "status"}
      data-testid={id}
      className={msg ? `border p-3 text-sm ${msg.ok ? "border-success bg-[#eef6f0]" : "border-destructive bg-[#fbeceb]"}` : "visually-hidden"}
    >
      {msg?.message}
    </div>
  );
}

function ImageUploader({
  kind,
  label,
  currentUrl,
  storage,
  hint,
}: {
  kind: "hero" | "logo";
  label: string;
  currentUrl: string | null;
  storage: { ok: boolean; message: string };
  hint: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    const data = new FormData();
    data.append("kind", kind);
    data.append("file", file);
    try {
      const res = await fetch("/api/admin/site-image", { method: "POST", body: data });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setMsg({ ok: true, message: `${label} updated.${body.warnings?.length ? " " + body.warnings.join(" ") : ""}` });
        router.refresh();
      } else {
        setMsg({ ok: false, message: body.error ?? "The upload failed. Please try again." });
      }
    } catch {
      setMsg({ ok: false, message: "The upload failed (the connection dropped). Please try again." });
    }
    setBusy(false);
    requestAnimationFrame(() => boxRef.current?.focus());
  }

  async function remove() {
    if (!window.confirm(`Remove the ${label.toLowerCase()}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/site-image?kind=${kind}`, { method: "DELETE" });
    setMsg(res.ok ? { ok: true, message: `${label} removed.` } : { ok: false, message: "We couldn't remove it. Please try again." });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-40 items-center justify-center overflow-hidden bg-muted text-xs text-muted-foreground">
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt={`Current ${label.toLowerCase()}`} className="h-full w-full object-cover" />
          ) : (
            "None yet"
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="visually-hidden"
            aria-label={`Choose ${label.toLowerCase()} file`}
            data-testid={`${kind}-input`}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy || !storage.ok} onClick={() => input.current?.click()}>
              {busy ? "Working…" : currentUrl ? "Replace image" : "Upload image"}
            </Button>
            {currentUrl && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      {!storage.ok && <p role="alert" className="text-sm text-destructive">{storage.message}</p>}
      <MessageBox msg={msg} boxRef={boxRef} id={`${kind}-message`} />
    </div>
  );
}

export function HomeSettingsForm({
  home,
  storage,
  collections,
}: {
  home: HomeSettings;
  storage: { ok: boolean; message: string };
  collections: { id: number; name: string; show: boolean; count: number }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    heroHeadline: home.heroHeadline,
    heroButtonLabel: home.heroButtonLabel,
    heroButtonHref: home.heroButtonHref,
    heroImageAlt: home.heroImageAlt,
  });
  const [heroMsg, setHeroMsg] = useState<Msg>(null);
  const [colMsg, setColMsg] = useState<Msg>(null);
  const [items, setItems] = useState(collections);
  const [pending, start] = useTransition();
  const heroBox = useRef<HTMLDivElement>(null);
  const colBox = useRef<HTMLDivElement>(null);

  const move = (i: number, d: number) =>
    setItems((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="space-y-8">
      <section aria-labelledby="hero-h" className="space-y-4 border bg-white p-5">
        <h2 id="hero-h" className="text-xl">Hero banner</h2>
        <ImageUploader
          kind="hero"
          label="Hero image"
          currentUrl={home.heroImageUrl}
          storage={storage}
          hint="JPEG, PNG or WebP, up to 5 MB. A wide photo (1600 pixels or more) looks best. Until you add one, a neutral placeholder is shown."
        />
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setHeroMsg(await saveHeroAction(values));
              router.refresh();
              requestAnimationFrame(() => heroBox.current?.focus());
            });
          }}
        >
          <MessageBox msg={heroMsg} boxRef={heroBox} id="hero-save-message" />
          <div>
            <Label htmlFor="h-headline">Headline</Label>
            <Input id="h-headline" value={values.heroHeadline} onChange={(e) => setValues({ ...values, heroHeadline: e.target.value })} maxLength={90} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="h-label">Button label</Label>
              <Input id="h-label" value={values.heroButtonLabel} onChange={(e) => setValues({ ...values, heroButtonLabel: e.target.value })} maxLength={30} />
            </div>
            <div>
              <Label htmlFor="h-href">Button goes to</Label>
              <Input id="h-href" value={values.heroButtonHref} onChange={(e) => setValues({ ...values, heroButtonHref: e.target.value })} placeholder="/shop" />
            </div>
          </div>
          <div>
            <Label htmlFor="h-alt">Hero image description (alt text)</Label>
            <Input id="h-alt" value={values.heroImageAlt} onChange={(e) => setValues({ ...values, heroImageAlt: e.target.value })} maxLength={200} />
            <p className="mt-1 text-xs text-muted-foreground">Describe the photo for people who can&apos;t see it. Leave empty if it is purely decorative.</p>
          </div>
          <Button type="submit" disabled={pending}>Save hero text</Button>
        </form>
      </section>

      <section aria-labelledby="logo-h" className="space-y-4 border bg-white p-5">
        <h2 id="logo-h" className="text-xl">Logo</h2>
        <ImageUploader
          kind="logo"
          label="Logo"
          currentUrl={home.logoUrl}
          storage={storage}
          hint="Shown centered in the header. Until you upload one, the store name is shown as a text wordmark."
        />
      </section>

      <section aria-labelledby="cols-h" className="space-y-4 border bg-white p-5">
        <h2 id="cols-h" className="text-xl">Collections on the home page</h2>
        <p className="text-sm text-muted-foreground">Tick the collections to show, and use the arrows to set their order (top first).</p>
        <MessageBox msg={colMsg} boxRef={colBox} id="collections-message" />
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collections yet. Add some under Collections.</p>
        ) : (
          <ul className="space-y-2" data-testid="home-collections">
            {items.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#6e2a3a]"
                    checked={c.show}
                    onChange={(e) => setItems((l) => l.map((x) => (x.id === c.id ? { ...x, show: e.target.checked } : x)))}
                  />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">({c.count} product{c.count === 1 ? "" : "s"})</span>
                </label>
                <div className="flex">
                  <button type="button" className="p-2 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" className="p-2 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label={`Move ${c.name} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          disabled={pending || items.length === 0}
          data-testid="save-home-collections"
          onClick={() =>
            start(async () => {
              setColMsg(await saveHomeCollectionsAction(items.map((c) => ({ id: c.id, show: c.show }))));
              router.refresh();
              requestAnimationFrame(() => colBox.current?.focus());
            })
          }
        >
          Save collections
        </Button>
      </section>
    </div>
  );
}
