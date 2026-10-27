"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ActionResult = { ok: boolean; message: string };
export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "checkbox";
  maxLength?: number;
  help?: string;
  placeholder?: string;
};
export type ListItem = { id: number; title: string; meta?: string; values: Record<string, string>; deleteNote?: string };
type Values = Record<string, string>;

function readValues(form: HTMLFormElement, fields: FieldDef[]): Values {
  const out: Values = {};
  for (const f of fields) {
    const el = form.elements.namedItem(f.name) as HTMLInputElement | HTMLTextAreaElement | null;
    out[f.name] = el ? (f.type === "checkbox" ? ((el as HTMLInputElement).checked ? "true" : "false") : el.value) : "";
  }
  return out;
}

/** One reusable manager for simple owner lists: add, edit in place, reorder and delete, with a plain-words result message. */
export function ListManager(props: {
  noun: string;
  nounPlural: string;
  fields: FieldDef[];
  items: ListItem[];
  addAction: (values: Values) => Promise<ActionResult>;
  updateAction: (id: number, values: Values) => Promise<ActionResult>;
  moveAction?: (id: number, dir: "up" | "down") => Promise<ActionResult>;
  deleteAction: (id: number) => Promise<ActionResult>;
  emptyText: string;
  intro?: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const addRef = useRef<HTMLFormElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);

  function run(fn: () => Promise<ActionResult>, after?: (r: ActionResult) => void) {
    start(async () => {
      const r = await fn();
      setMsg(r);
      after?.(r);
      router.refresh();
      requestAnimationFrame(() => msgRef.current?.focus());
    });
  }

  function renderField(f: FieldDef, idp: string, value?: string) {
    const id = `${idp}-${f.name}`;
    if (f.type === "checkbox") {
      return (
        <label key={f.name} className="flex items-center gap-2 text-sm">
          <input id={id} name={f.name} type="checkbox" defaultChecked={value === "true"} className="h-4 w-4 accent-[#6e2a3a]" />
          {f.label}
        </label>
      );
    }
    return (
      <div key={f.name}>
        <Label htmlFor={id}>{f.label}</Label>
        {f.type === "textarea" ? (
          <Textarea id={id} name={f.name} defaultValue={value ?? ""} maxLength={f.maxLength} rows={3} placeholder={f.placeholder} />
        ) : (
          <Input id={id} name={f.name} defaultValue={value ?? ""} maxLength={f.maxLength} placeholder={f.placeholder} />
        )}
        {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {props.intro && <p className="text-sm text-muted-foreground">{props.intro}</p>}
      <div
        ref={msgRef}
        tabIndex={-1}
        role={msg && !msg.ok ? "alert" : "status"}
        aria-live="polite"
        data-testid="list-message"
        className={msg ? `border p-3 text-sm ${msg.ok ? "border-success bg-[#eef6f0]" : "border-destructive bg-[#fbeceb]"}` : "visually-hidden"}
      >
        {msg?.message}
      </div>

      <section aria-labelledby="add-heading" className="border bg-white p-5">
        <h2 id="add-heading" className="text-xl">Add a {props.noun}</h2>
        <form
          ref={addRef}
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            run(() => props.addAction(readValues(form, props.fields)), (r) => r.ok && form.reset());
          }}
        >
          {props.fields.map((f) => renderField(f, "add"))}
          <Button type="submit" disabled={pending} data-testid="add-submit">
            Add {props.noun}
          </Button>
        </form>
      </section>

      {props.items.length === 0 ? (
        <p className="border bg-white p-8 text-center text-muted-foreground" data-testid="list-empty">{props.emptyText}</p>
      ) : (
        <ul className="space-y-3" data-testid="list-items">
          {props.items.map((it, idx) => (
            <li key={`${it.id}-${JSON.stringify(it.values)}`} className="border bg-white p-4" data-testid="list-item">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-sans font-medium">{it.title}</h3>
                  {it.meta && <p className="text-sm text-muted-foreground" data-testid="item-meta">{it.meta}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {props.moveAction && (
                    <>
                      <button
                        type="button"
                        className="p-2 hover:bg-muted disabled:opacity-30 cursor-pointer"
                        aria-label={`Move ${it.title} up`}
                        disabled={idx === 0 || pending}
                        onClick={() => run(() => props.moveAction!(it.id, "up"))}
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="p-2 hover:bg-muted disabled:opacity-30 cursor-pointer"
                        aria-label={`Move ${it.title} down`}
                        disabled={idx === props.items.length - 1 || pending}
                        onClick={() => run(() => props.moveAction!(it.id, "down"))}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  run(() => props.updateAction(it.id, readValues(form, props.fields)));
                }}
              >
                {props.fields.map((f) => renderField(f, `item-${it.id}`, it.values[f.name]))}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" disabled={pending} data-testid="item-save">
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                    disabled={pending}
                    data-testid="item-delete"
                    onClick={() => {
                      if (window.confirm(`Delete “${it.title}”?${it.deleteNote ? " " + it.deleteNote : ""}`)) run(() => props.deleteAction(it.id));
                    }}
                  >
                    Delete<span className="visually-hidden"> {it.title}</span>
                  </Button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
