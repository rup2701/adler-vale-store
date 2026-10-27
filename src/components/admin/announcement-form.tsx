"use client";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAnnouncementAction } from "@/app/admin/(protected)/announcement/actions";

export function AnnouncementForm({ enabled: e0, messages: m0 }: { enabled: boolean; messages: string[] }) {
  const [enabled, setEnabled] = useState(e0);
  const [messages, setMessages] = useState(m0.join("\n"));
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <form
      className="space-y-4 border bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMsg(await saveAnnouncementAction({ enabled, messages }));
          requestAnimationFrame(() => ref.current?.focus());
        });
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role={msg && !msg.ok ? "alert" : "status"}
        data-testid="announcement-message"
        className={msg ? `border p-3 text-sm ${msg.ok ? "border-success bg-[#eef6f0]" : "border-destructive bg-[#fbeceb]"}` : "visually-hidden"}
      >
        {msg?.message}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[#6e2a3a]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} id="ann-enabled" />
        Show the announcement bar
      </label>
      <div>
        <Label htmlFor="ann-messages">Messages (one per line, up to 5)</Label>
        <Textarea id="ann-messages" rows={5} value={messages} onChange={(e) => setMessages(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">With more than one message, shoppers see them one after another.</p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save announcement"}
      </Button>
    </form>
  );
}
