"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoManager, type PhotoDTO } from "@/components/admin/photo-manager";
import { deleteProductAction, saveProductAction, setPublishedAction } from "@/app/admin/(protected)/products/actions";
import { slugify } from "@/lib/slug";
import { settings } from "@/config/settings";

export type OptionValueForm = { key: string; id?: number; value: string; adjust: string; stock: string };
export type OptionForm = {
  key: string;
  id?: number;
  name: string;
  required: boolean;
  defaultValue: string;
  tracksStock: boolean;
  values: OptionValueForm[];
};
export type ProductForm = {
  name: string;
  slug: string;
  tagline: string;
  brandId: string;
  categoryId: string;
  department: "women" | "men";
  description: string;
  price: string;
  compareAt: string;
  stock: string;
  personalizable: boolean;
  personalizationLabel: string;
  personalizationMaxLength: string;
  materialsCare: string;
  specifications: string;
  collectionIds: number[];
  options: OptionForm[];
};

type Props = {
  productId: number | null;
  status: "draft" | "published";
  isSample: boolean;
  initial: ProductForm;
  categories: { id: number; name: string }[];
  brands: { id: number; name: string }[];
  collections: { id: number; name: string }[];
  photos: PhotoDTO[];
  storage: { ok: boolean; message: string };
  flash: "created" | "updated" | "published" | "unpublished" | null;
};

let keySeq = 0;
const nk = () => `k${++keySeq}`;

export function newOption(name = ""): OptionForm {
  return { key: nk(), name, required: true, defaultValue: "", tracksStock: false, values: [{ key: nk(), value: "", adjust: "0.00", stock: "0" }] };
}

export function ProductEditor(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ProductForm>(props.initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(props.initial));
  const [slugTouched, setSlugTouched] = useState(props.productId != null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, startSaving] = useTransition();
  const [status, setStatus] = useState(props.status);
  const [photoCount, setPhotoCount] = useState(props.photos.length);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(() => {
    const f = props.flash;
    if (!f) return null;
    const next =
      props.photos.length === 0
        ? "Next: add photos below, then publish."
        : props.status === "draft"
          ? "Next: publish it so shoppers can see it."
          : "Your changes are live in the store.";
    const text =
      f === "created"
        ? "Product saved as a draft. " + (props.photos.length === 0 ? "Next: add photos below, then publish it so shoppers can see it." : next)
        : f === "updated"
          ? "Saved. " + next
          : f === "published"
            ? "Published. Shoppers can now find it in the store. Next: open it in the store to check how it looks."
            : "Unpublished. It is now a draft and hidden from shoppers.";
    return { kind: "ok", text };
  });
  const [publishing, setPublishing] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.flash) {
      window.history.replaceState(null, "", window.location.pathname);
      requestAnimationFrame(() => messageRef.current?.focus());
    }
  }, [props.flash]);

  const dirty = useMemo(() => JSON.stringify(form) !== baseline, [form, baseline]);
  const tracked = form.options.some((o) => o.tracksStock);
  const trackedTotal = form.options
    .filter((o) => o.tracksStock)
    .flatMap((o) => o.values)
    .reduce((a, v) => a + (/^\d+$/.test(v.stock) ? Number(v.stock) : 0), 0);

  // Ask before leaving with unsaved changes: closing the tab, and following any link.
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("You have unsaved changes. Leave this page and lose them?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const err = (path: string) => errors[path];
  const ErrorText = ({ path }: { path: string }) =>
    err(path) ? (
      <p id={`e-${path}`} className="mt-1 text-sm font-medium text-destructive" data-testid={`error-${path}`}>
        {err(path)}
      </p>
    ) : null;
  const fp = (path: string) => ({
    id: `f-${path}`,
    "aria-invalid": err(path) ? true : undefined,
    "aria-describedby": err(path) ? `e-${path}` : undefined,
  });

  const updateOption = (i: number, patch: Partial<OptionForm>) =>
    setForm((f) => ({ ...f, options: f.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) }));
  const updateValue = (oi: number, vi: number, patch: Partial<OptionValueForm>) =>
    setForm((f) => ({
      ...f,
      options: f.options.map((o, idx) =>
        idx === oi ? { ...o, values: o.values.map((v, j) => (j === vi ? { ...v, ...patch } : v)) } : o,
      ),
    }));

  function addSizeOption() {
    setForm((f) => ({
      ...f,
      options: [
        ...f.options,
        {
          key: nk(),
          name: "Size",
          required: true,
          defaultValue: "",
          tracksStock: true,
          values: settings.sizes.map((s) => ({ key: nk(), value: s, adjust: "0.00", stock: "0" })),
        },
      ],
    }));
  }

  const onSave = useCallback(() => {
    setMessage(null);
    const payload = {
      id: props.productId ?? undefined,
      name: form.name,
      slug: form.slug,
      tagline: form.tagline,
      brandId: form.brandId ? Number(form.brandId) : null,
      categoryId: form.categoryId ? Number(form.categoryId) : 0,
      department: form.department,
      description: form.description,
      price: form.price,
      compareAt: form.compareAt,
      stock: tracked ? String(trackedTotal) : form.stock,
      personalizable: form.personalizable,
      personalizationLabel: form.personalizationLabel,
      personalizationMaxLength: form.personalizationMaxLength,
      materialsCare: form.materialsCare,
      specifications: form.specifications,
      collectionIds: form.collectionIds,
      options: form.options.map((o) => ({
        id: o.id,
        name: o.name,
        required: o.required,
        defaultValue: o.defaultValue || null,
        tracksStock: o.tracksStock,
        values: o.values.map((v) => ({ id: v.id, value: v.value, adjust: v.adjust || "0", stock: v.stock || "0" })),
      })),
    };
    startSaving(async () => {
      const res = await saveProductAction(payload);
      if (!res.ok) {
        setErrors(res.errors);
        const keys = Object.keys(res.errors);
        setMessage({
          kind: "error",
          text: `Your product wasn't saved. Please fix ${keys.length === 1 ? "the problem" : `${keys.length} problems`} marked below. What you typed is kept.`,
        });
        requestAnimationFrame(() => {
          const first = keys[0];
          (document.getElementById(`f-${first}`) ?? messageRef.current)?.focus();
        });
        return;
      }
      setErrors({});
      setBaseline(JSON.stringify(form));
      // Reload from the server so new options and values get their real ids.
      router.replace(`/admin/products/${res.id}?saved=${res.created ? "created" : "updated"}`);
    });
  }, [form, props.productId, router, tracked, trackedTotal]);

  async function togglePublish() {
    if (props.productId == null) return;
    setPublishing(true);
    setMessage(null);
    const wantPublish = status !== "published";
    const res = await setPublishedAction(props.productId, wantPublish);
    setPublishing(false);
    if (!res.ok) {
      setMessage({ kind: "error", text: res.reason });
      requestAnimationFrame(() => messageRef.current?.focus());
      return;
    }
    router.replace(`/admin/products/${props.productId}?saved=${wantPublish ? "published" : "unpublished"}`);
  }

  async function onDelete() {
    if (props.productId == null) return;
    if (!window.confirm("Delete this product for good? Orders already placed keep their copy of it.")) return;
    await deleteProductAction(props.productId);
    setBaseline(JSON.stringify(form));
    router.push("/admin/products");
  }

  function cancel() {
    if (dirty && !window.confirm("You have unsaved changes. Leave this page and lose them?")) return;
    setBaseline(JSON.stringify(form));
    router.push("/admin/products");
  }

  const priceHint = form.price && /^\d+(\.\d{1,2})?$/.test(form.price) ? "" : "In dollars, for example 48.00";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl" data-testid="editor-heading">
            {props.productId == null ? "New product" : form.name || "Product"}
          </h1>
          <p className="mt-1 text-sm">
            {props.productId == null ? (
              "Not saved yet"
            ) : (
              <>
                <span
                  data-testid="editor-status"
                  className={`inline-block px-2 py-0.5 text-xs font-medium ${status === "published" ? "bg-[#dfeee4] text-success" : "bg-[#f3e7c9] text-[#6b4a00]"}`}
                >
                  {status === "published" ? "Published" : "Draft"}
                </span>
                {props.isSample && <span className="ml-2 border border-[#8a847c] px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Sample product</span>}
                {dirty && <span className="ml-2 text-primary" data-testid="unsaved">Unsaved changes</span>}
                <Link href={`/products/${form.slug}`} target="_blank" className="ml-3 underline underline-offset-4">
                  View in store
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.productId != null && (
            <Button
              type="button"
              variant={status === "published" ? "outline" : "default"}
              onClick={togglePublish}
              disabled={publishing || dirty}
              title={dirty ? "Save your changes first" : undefined}
              data-testid="publish-toggle"
            >
              {publishing ? "Working…" : status === "published" ? "Unpublish" : "Publish"}
            </Button>
          )}
        </div>
      </div>
      {dirty && props.productId != null && <p className="mt-1 text-xs text-muted-foreground">Save your changes before publishing.</p>}

      <div
        ref={messageRef}
        tabIndex={-1}
        role={message?.kind === "error" ? "alert" : "status"}
        aria-live="polite"
        data-testid="editor-message"
        className={message ? `mt-4 border p-3 text-sm ${message.kind === "ok" ? "border-success bg-[#eef6f0]" : "border-destructive bg-[#fbeceb]"}` : "visually-hidden"}
      >
        {message?.text}
      </div>

      <form
        className="mt-6 space-y-8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <section aria-labelledby="basics" className="space-y-4 border bg-white p-5">
          <h2 id="basics" className="text-xl">Basics</h2>
          <div>
            <Label htmlFor="f-name">Name</Label>
            <Input
              {...fp("name")}
              value={form.name}
              maxLength={200}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">{form.name.length}/80 characters</p>
            <ErrorText path="name" />
          </div>
          <div>
            <Label htmlFor="f-slug">Web address (slug)</Label>
            <Input
              {...fp("slug")}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value);
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">Shoppers see /products/{form.slug || "your-product"}. Lowercase letters, numbers and hyphens.</p>
            <ErrorText path="slug" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="f-brandId">Brand</Label>
              <Select {...fp("brandId")} value={form.brandId} onChange={(e) => set("brandId", e.target.value)}>
                <option value="">No brand</option>
                {props.brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
              <ErrorText path="brandId" />
            </div>
            <div>
              <Label htmlFor="f-categoryId">Category</Label>
              <Select {...fp("categoryId")} value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">Choose a category</option>
                {props.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <ErrorText path="categoryId" />
            </div>
            <div>
              <Label htmlFor="f-department">Shop section</Label>
              <Select {...fp("department")} value={form.department} onChange={(e) => set("department", e.target.value as "women" | "men")}>
                <option value="women">Women</option>
                <option value="men">Men</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="f-tagline">Tagline (one line shown on cards)</Label>
            <Input {...fp("tagline")} value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
            <ErrorText path="tagline" />
          </div>
          <div>
            <Label htmlFor="f-description">Description</Label>
            <Textarea {...fp("description")} rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">{form.description.length}/2000 characters</p>
            <ErrorText path="description" />
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Collections</legend>
            {props.collections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No collections yet. Add some under Collections.</p>
            ) : (
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {props.collections.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.collectionIds.includes(c.id)}
                      onChange={(e) =>
                        set("collectionIds", e.target.checked ? [...form.collectionIds, c.id] : form.collectionIds.filter((x) => x !== c.id))
                      }
                      className="h-4 w-4 accent-[#6e2a3a]"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </section>

        <section aria-labelledby="pricing" className="space-y-4 border bg-white p-5">
          <h2 id="pricing" className="text-xl">Price and stock</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="f-price">Price (USD)</Label>
              <Input {...fp("price")} inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" />
              {priceHint && !err("price") && <p className="mt-1 text-xs text-muted-foreground">{priceHint}</p>}
              <ErrorText path="price" />
            </div>
            <div>
              <Label htmlFor="f-compareAt">Original price (optional)</Label>
              <Input {...fp("compareAt")} inputMode="decimal" value={form.compareAt} onChange={(e) => set("compareAt", e.target.value)} placeholder="Shown struck through" />
              <ErrorText path="compareAt" />
            </div>
            <div>
              <Label htmlFor="f-stock">Stock</Label>
              {tracked ? (
                <>
                  <Input {...fp("stock")} value={String(trackedTotal)} disabled />
                  <p className="mt-1 text-xs text-muted-foreground">Added up from the stock of each value below.</p>
                </>
              ) : (
                <Input {...fp("stock")} inputMode="numeric" value={form.stock} onChange={(e) => set("stock", e.target.value)} />
              )}
              <ErrorText path="stock" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Stock 0 shows “Sold out” to shoppers and blocks adding to the cart. One-of-a-kind items: use stock 1.</p>
        </section>

        <section aria-labelledby="options" className="space-y-4 border bg-white p-5" data-testid="options-editor">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="options" className="text-xl">Options</h2>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={addSizeOption} data-testid="add-size-option">
                <Plus className="h-4 w-4" aria-hidden="true" /> Add sizes (0–10)
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => set("options", [...form.options, newOption()])} data-testid="add-option">
                <Plus className="h-4 w-4" aria-hidden="true" /> Add option
              </Button>
            </div>
          </div>
          {form.options.length === 0 && (
            <p className="text-sm text-muted-foreground">No options. Shoppers buy this piece as it is. Add a size, color or finish if you offer choices.</p>
          )}
          {form.options.map((o, oi) => (
            <fieldset key={o.key} className="space-y-3 border p-4" data-testid="option-editor">
              <legend className="px-1 text-sm font-medium">Option {oi + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <Label htmlFor={`f-options.${oi}.name`}>Option name</Label>
                  <Input {...fp(`options.${oi}.name`)} value={o.name} onChange={(e) => updateOption(oi, { name: e.target.value })} placeholder="Size, Color, Glaze…" />
                  <ErrorText path={`options.${oi}.name`} />
                </div>
                <div className="flex flex-col justify-end gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-[#6e2a3a]" checked={o.required} onChange={(e) => updateOption(oi, { required: e.target.checked })} />
                    Required
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`f-options.${oi}.tracksStock`}
                      className="h-4 w-4 accent-[#6e2a3a]"
                      checked={o.tracksStock}
                      onChange={(e) => updateOption(oi, { tracksStock: e.target.checked })}
                    />
                    Each value has its own stock
                  </label>
                  <ErrorText path={`options.${oi}.tracksStock`} />
                </div>
              </div>
              <div>
                <Label htmlFor={`f-options.${oi}.defaultValue`}>Default value</Label>
                <Select {...fp(`options.${oi}.defaultValue`)} value={o.defaultValue} onChange={(e) => updateOption(oi, { defaultValue: e.target.value })} className="max-w-xs">
                  <option value="">No default (shopper must choose)</option>
                  {o.values.filter((v) => v.value.trim()).map((v) => (
                    <option key={v.key} value={v.value.trim()}>{v.value.trim()}</option>
                  ))}
                </Select>
                <ErrorText path={`options.${oi}.defaultValue`} />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Values</p>
                <ul className="space-y-2">
                  {o.values.map((v, vi) => (
                    <li key={v.key} className="grid grid-cols-2 items-start gap-2 sm:grid-cols-[1fr_8rem_6rem_auto]" data-testid="value-row">
                      <div className="col-span-2 sm:col-span-1">
                        <label htmlFor={`f-options.${oi}.values.${vi}.value`} className="visually-hidden">Value {vi + 1}</label>
                        <Input {...fp(`options.${oi}.values.${vi}.value`)} value={v.value} onChange={(e) => updateValue(oi, vi, { value: e.target.value })} placeholder="Value, e.g. Black" />
                        <ErrorText path={`options.${oi}.values.${vi}.value`} />
                      </div>
                      <div>
                        <label htmlFor={`f-options.${oi}.values.${vi}.adjust`} className="mb-0.5 block text-xs text-muted-foreground">Price change ($)</label>
                        <Input {...fp(`options.${oi}.values.${vi}.adjust`)} inputMode="decimal" value={v.adjust} onChange={(e) => updateValue(oi, vi, { adjust: e.target.value })} />
                        <ErrorText path={`options.${oi}.values.${vi}.adjust`} />
                      </div>
                      {o.tracksStock ? (
                        <div>
                          <label htmlFor={`f-options.${oi}.values.${vi}.stock`} className="mb-0.5 block text-xs text-muted-foreground">Stock</label>
                          <Input {...fp(`options.${oi}.values.${vi}.stock`)} inputMode="numeric" value={v.stock} onChange={(e) => updateValue(oi, vi, { stock: e.target.value })} />
                          <ErrorText path={`options.${oi}.values.${vi}.stock`} />
                        </div>
                      ) : (
                        <div className="hidden sm:block" />
                      )}
                      <div className="pt-5">
                        <button
                          type="button"
                          className="p-2 text-destructive hover:bg-muted cursor-pointer disabled:opacity-30"
                          aria-label={`Remove value ${v.value || vi + 1}`}
                          disabled={o.values.length <= 1}
                          onClick={() => updateOption(oi, { values: o.values.filter((_, j) => j !== vi), defaultValue: o.defaultValue === v.value.trim() ? "" : o.defaultValue })}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <ErrorText path={`options.${oi}.values`} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => updateOption(oi, { values: [...o.values, { key: nk(), value: "", adjust: "0.00", stock: "0" }] })}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add value
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => set("options", form.options.filter((_, i) => i !== oi))}>
                    Remove option
                  </Button>
                </div>
              </div>
            </fieldset>
          ))}
        </section>

        <section aria-labelledby="personalization-h" className="space-y-4 border bg-white p-5">
          <h2 id="personalization-h" className="text-xl">Personalization</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              id="f-personalizable"
              className="h-4 w-4 accent-[#6e2a3a]"
              checked={form.personalizable}
              onChange={(e) => set("personalizable", e.target.checked)}
            />
            Shoppers can add personalization (a monogram, for example). These pieces are final sale.
          </label>
          {form.personalizable && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="f-personalizationLabel">Field label</Label>
                <Input {...fp("personalizationLabel")} value={form.personalizationLabel} onChange={(e) => set("personalizationLabel", e.target.value)} />
                <ErrorText path="personalizationLabel" />
              </div>
              <div>
                <Label htmlFor="f-personalizationMaxLength">Character limit (1–40)</Label>
                <Input {...fp("personalizationMaxLength")} inputMode="numeric" value={form.personalizationMaxLength} onChange={(e) => set("personalizationMaxLength", e.target.value)} />
                <ErrorText path="personalizationMaxLength" />
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="details-h" className="space-y-4 border bg-white p-5">
          <h2 id="details-h" className="text-xl">Materials, care and specifications</h2>
          <div>
            <Label htmlFor="f-materialsCare">Materials &amp; care (one item per line)</Label>
            <Textarea {...fp("materialsCare")} rows={4} value={form.materialsCare} onChange={(e) => set("materialsCare", e.target.value)} />
            <ErrorText path="materialsCare" />
          </div>
          <div>
            <Label htmlFor="f-specifications">Specifications (one per line, as “Label: value”)</Label>
            <Textarea {...fp("specifications")} rows={4} value={form.specifications} onChange={(e) => set("specifications", e.target.value)} />
            <ErrorText path="specifications" />
          </div>
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t bg-[#f4f2ee] px-4 py-3">
          <Button type="submit" disabled={saving} data-testid="save-product">
            {saving ? "Saving…" : "Save product"}
          </Button>
          <Button type="button" variant="outline" onClick={cancel} data-testid="cancel">
            Cancel
          </Button>
          {props.productId != null && (
            <Button type="button" variant="ghost" className="ml-auto text-destructive" onClick={onDelete}>
              Delete product
            </Button>
          )}
        </div>
      </form>

      <div className="mt-8">
        {props.productId == null ? (
          <section className="border bg-white p-5" data-testid="photos-after-save">
            <h2 className="text-xl">Photos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Save the product first, then you can upload photos here. A product needs at least one photo before it can be published.</p>
          </section>
        ) : (
          <PhotoManager
            productId={props.productId}
            productName={form.name || "Product"}
            initial={props.photos}
            storage={props.storage}
            onChange={(photos, unpublished) => {
              setPhotoCount(photos.length);
              if (unpublished) {
                setStatus("draft");
                setMessage({ kind: "ok", text: "You removed the last photo, so the product went back to draft. Add a photo, then publish again." });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
