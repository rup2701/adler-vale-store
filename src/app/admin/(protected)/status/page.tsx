import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { getStoreStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Store status" };

function Row({ label, ok, children }: { label: string; ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b p-4 last:border-0">
      <span
        className={`mt-0.5 inline-block h-fit shrink-0 px-2 py-0.5 text-xs font-medium ${ok ? "bg-[#dfeee4] text-success" : "bg-[#fbeceb] text-destructive"}`}
      >
        {ok ? "OK" : "Needs attention"}
      </span>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

export default async function AdminStatusPage() {
  await requireOwner();
  const st = await getStoreStatus();
  return (
    <div>
      <h1 className="text-3xl">Store status</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">A quick check of the things the store depends on, and any problems shoppers ran into.</p>
      <ul className="border bg-white" data-testid="status-list">
        <Row label="Database" ok={st.database.ok}>{st.database.message}</Row>
        <Row label="Photo storage" ok={st.storage.ok}>{st.storage.kind}. {st.storage.message}</Row>
        <Row label="Owner sign-in" ok={st.ownerConfigured}>
          {st.ownerConfigured ? "The owner email and password are configured." : "OWNER_EMAIL or OWNER_PASSWORD_HASH is missing, so nobody can sign in."}
        </Row>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Template version {st.templateVersion} · {st.deployed ? "deployed build" : "development build"}
        {st.counts ? ` · ${st.counts.products} products · ${st.counts.orders} demo orders` : ""}
      </p>

      <section aria-labelledby="events-h" className="mt-8">
        <h2 id="events-h" className="text-xl">Recent problems</h2>
        {st.events.length === 0 ? (
          <p className="mt-2 border bg-white p-6 text-center text-muted-foreground" data-testid="no-events">
            Nothing has gone wrong recently. If a shopper&apos;s checkout fails, it will be listed here in plain words.
          </p>
        ) : (
          <ul className="mt-2 space-y-2" data-testid="events">
            {st.events.map((e) => (
              <li key={e.id} className="border bg-white p-3 text-sm">
                <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
                <p>{e.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
