# AGENT_LOG: Alder & Vale

A designer boutique (Los Gatos, Santa Barbara) built on Next.js 16, Postgres (drizzle), Tailwind, with a photo storage adapter (local disk in development, Vercel Blob when deployed).

## What I built and where

- **Settings and look**: `src/config/settings.ts` holds every store constant (name, accent `#6e2a3a` bordeaux, shipping $15 flat and free over $500, tax estimate 8.75%, max 10 per line, 5 MB photo limit, sizes 0 to 10, sign-in lockout 5 attempts / 15 minutes). Editorial look, full-width layout, image-first cards, narrow reading column (`src/app/globals.css`).
- **Database**: `src/db/schema.ts`, migrations in `drizzle/`. Tables include products, product_options and product_option_values (per-size stock), brands, categories (with aliases), collections and product_collections, stores, orders and order_items (copies of name, options and price), email_signups, site_settings, login_attempts, owner_sessions, system_events.
- **Seed**: `scripts/seed.ts` loads the 24 sample products with the 5 fictional brands, 8 categories, 3 collections, 2 stores and the default announcement and hero text. It refuses to run on a store that already has products unless `--confirm` is passed. `scripts/hash-password.ts` makes the owner password hash.
- **Shopper side** (`src/app/(shop)`, `src/components/shop|cart|checkout|site`): centered wordmark header, Women/Men switch, search, bag count, uppercase menu with the categories, Designers and Sale, mobile menu behind a button, announcement bar, home (hero, brands strip, collection sections, email signup, footer), shop and category pages with filters and sort, brand and collection pages, product page in the order the brief gives, cart (browser storage, in-memory fallback, two-tab sync), checkout with Ship or Pickup (store choice shows its ready time, no shipping charge), confirmation page with a short code such as `AV-XXXXXX`, returns, help, contact, about, gift cards, friendly error page.
- **Checkout**: `src/lib/checkout.ts` is one transaction. The server prices every line itself, re-checks availability and per-size stock, uses a one-time token per cart so repeats return the same order, and records failures in `system_events`.
- **Owner area** (`src/app/admin`): sign-in from environment configuration (`OWNER_EMAIL`, `OWNER_PASSWORD_HASH`) with a lockout; products (brand, category, collections, options, per-size stock, photos with order, alt text and cover, publish and unpublish, delete); categories; brands; collections; stores and pickup; announcement bar; home page (hero image, headline and button, logo, which collections show and their order); email signups list; store status page (database, photo storage, recent checkout failures).
- **Photos**: `src/lib/storage.ts` (adapter), `src/lib/images.ts` (type and size checks, a web copy at most 1600 px wide and a thumbnail, original kept). Deployed builds with no `BLOB_READ_WRITE_TOKEN` refuse to start (`src/instrumentation.ts`).
- **Tests** (`e2e/`, Playwright against the production build): `journey.spec.ts`, `storefront.spec.ts` (brief and layout checks), `edges-shopper.spec.ts` (one check per shopper-side edge), `edges-owner.spec.ts` (one check per owner and operations edge), `owner-area.spec.ts` (one check per owner area the brief lists), `helpers.ts`.

## Beyond the specs

Each of these came from the brief, not from the specs.

- **Brands**: a brand table, a home strip linking to each brand's page, a Designers page (`/brands`), a brand field on every product, owner area to add, edit, reorder and delete. A brand with products cannot be deleted; the message gives the count. Check: `owner-area.spec.ts` (brands) and `storefront.spec.ts` (designers page).
- **Collections**: products can be in several collections. Collection pages, home sections for those marked show-on-home (title, description, first six products), owner area for them and a Home page screen for which show and in what order. A collection with no published products is skipped on home. Checks: `owner-area.spec.ts` (collections, home page).
- **Stores and pickup**: two stores from the brief in the footer and Contact; a Ship or Pickup choice at checkout; pickup availability per store on the product page with the store's ready time; the order keeps a copy of the store name and ready time. Owner can add, edit, switch pickup off and delete stores. Checks: `storefront.spec.ts` (pickup), `owner-area.spec.ts` (stores).
- **Per-size stock**: sizes 0, 2, 4, 6, 8, 10 each have their own stock. Sold-out sizes are shown struck through and cannot be chosen. The product total is the sum of the sizes. A purchase lowers only its size. At least four products have some sizes sold out and two are sold out in every size. Checks: `storefront.spec.ts`, `edges-shopper.spec.ts` (E-002, E-023b), `owner-area.spec.ts`.
- **Announcement bar**: owner-editable messages (up to 5, one per line), an on/off switch, a "next" button to step through them. Check: `storefront.spec.ts`, `owner-area.spec.ts`.
- **Email signup**: one field and a button on the home page; the address is stored, the shopper sees a thank-you, nothing is sent; the owner sees the list. Checks: `storefront.spec.ts`, `owner-area.spec.ts`.
- **Header and home layout** as described in the brief (centered wordmark, Women/Men switch on the left, search and bag on the right, mobile menu, hero then brands then collections then signup then footer). The Women/Men switch only filters by a `department` field on each product (Men is empty). Checks in `storefront.spec.ts`.
- **Hero and logo upload**: neutral placeholder until the owner uploads an image; no photo is fetched or invented. Check: `owner-area.spec.ts` (home page).
- **Sample labelling**: seeded products show a "Sample" label in the owner area. Check: `owner-area.spec.ts` (sign-in test).
- **Draft preview**: a draft product shows the owner a "Draft preview" banner; shoppers get a not-found page that explains. Check: `owner-area.spec.ts`.
- **Sign-in keeps the email** after a failed attempt (found while writing the sign-in test; see Mistakes).

## Decisions on ambiguous points

- The specs describe a handmade-goods store and a "sold out switch with no stock numbers" (E-023). The brief asks for per-size stock, so stock is counted, and E-023 is handled: two shoppers buying the last piece, exactly one succeeds and the other is told (tested).
- Accent colour: deep bordeaux `#6e2a3a`, 9.9:1 contrast on white.
- Order reference: `AV-` plus 6 characters from an alphabet without look-alikes (no 0, O, 1, I, L). No lookup page, no email.
- Shipping: $15 flat, free when the subtotal is over $500. Tax 8.75%. Both labelled as estimates.
- Code `SAMPLE10` in the announcement bar is only text. There is no discount code feature (the brief does not ask for one).
- Owner sign-in rate limit is by the first `x-forwarded-for` address (or `local`); the tests give each test its own address.
- E-012, E-017, E-034: the cart page refreshes prices when it loads and shows a notice; checkout re-prices on the server and asks the shopper to review and place the order again.
- E-019 and E-025 (owner alert): the owner decision options are email, text or dashboard. Email is out of scope, so failures are shown on the owner's Store status page ("Recent problems"). Not chosen by an owner; this is the default I picked.
- E-026 to E-028 (orders list, emails, refunds) are marked open in the specs and need owner decisions; there is no order list, no email and no cancel tool. The confirmation page says so and the returns page says how to ask for a refund.
- The owner sees drafts at `/products/<slug>`; everyone else gets 404 with an explanation.
- In e2e tests the "contact has no form" check ignores the header search form (the header search is required by the brief).

## Not verified

- **The first session's notes were lost.** An earlier session built the schema, seed, shopper side, owner area and `journey.spec.ts`, `storefront.spec.ts` and `edges-shopper.spec.ts` before it was cut off. I resumed from the files and the git history only. Parts of this log (what exists, where, and the decisions above) are reconstructed from reading the code and not from memory of making it. Anything I describe as an earlier decision may be my reading of the code.
- The earlier session's two uncommitted files (`storefront.spec.ts`, `edges-shopper.spec.ts`) and a small `buy-box.tsx` change were found uncommitted. I ran them and they pass, but I did not review every assertion line by line.
- Vercel Blob upload and Neon were not run: no token or deployment was available. The Blob adapter code is untested. E-031 is checked through the startup refusal and the storage adapter and status message, not through the owner screen in a deployed build (a deployed build without storage cannot start, so that screen is never reached).
- E-025: the friendly error page is checked by starting a second copy of the store with an unreachable database. The owner's status check is checked by calling it with an unreachable database. A real Neon outage was not tried.
- E-024: only the refusal is tested. I did not run `npm run db:seed -- --confirm` against the test database, to avoid wiping it during the run. The seeded data was created by the first session.
- E-018 is checked by sending the same token three times (two at once). A real double click in a browser is not tested.
- No screen reader testing. Keyboard path and focus visibility have one check. Colour contrast was computed for the accent, not audited everywhere.
- Only Chrome (Playwright "Desktop Chrome") was used.
- The owner pages were checked at desktop width only.

## Unclear, missing or misleading in the specs

- `edges.json` mostly describes a handmade store (glaze, engraving, "email the studio"). I mapped "personalization" to the monogram option on a bag and a scarf and kept the wording about the studio on the returns page.
- E-023 says the store keeps no stock numbers; the brief asks for per-size stock. The brief wins.
- E-026 to E-028 are `open` and ask the owner to decide, but there is nobody to ask. I built nothing for them.
- `SPEC_GAPS.md` item 4 points to a `personalization` section of the brief that does not exist in this brief.
- Several edge entries have `tested: "no"` or `"partial"` even though a check is now there; the specs are read-only so they were not updated.
- It is not stated whether the owner may see drafts at the public address. I allowed it (with a banner).

## Mistakes made and fixed

- Each e2e spec file closed the shared database pool in `afterAll`. Playwright runs the files in one worker and the module is shared, so the next file failed with "Cannot use a pool after calling end". I removed the `pool.end()` calls.
- The Help page check looked for a heading named "Care" and matched two headings (the section and an FAQ question). I made the locator exact. The page was right, the check was not specific enough.
- "Contact has no form" counted the header search form. I limited the check to everything outside the header.
- A product test looked for the word "Relaxed" and matched a card in "You may also like". I narrowed it to the specification value.
- My first draft test for unpublished products used the owner's browser, which correctly shows a draft preview. I changed it to check as an anonymous visitor.
- Real bug found by the sign-in test: after a failed sign-in the email field was cleared (React resets form fields after a form action), so the owner had to retype it. The action now returns the email and the form keeps it.
- Leftover helper scripts `e2e/storefront.spec.ts.patch.js` and `e2e/owner-area.fix.js` were used for one-off edits. I could not delete files with my tools, so they now contain only a comment and can be deleted.

## Final results

Commands run in the last pass, in the app folder:

- `npx tsc --noEmit` printed nothing and exited 0.
- `npm run build` finished: "Compiled successfully", all routes listed (home, shop, products, cart, checkout, order, brands, collections, admin pages and API routes), exit 0.
- `npx playwright test --reporter=dot` printed `79 passed (1.5m)`. The `[checkout] failed ... simulated database failure` lines in its output come from the E-019 check, which makes order saving fail on purpose.

One check per edge in `specs/edges.json` (E-001 to E-036) is in `e2e/`:
E-001 to E-018, E-020 to E-023, E-033 in `edges-shopper.spec.ts`; E-019, E-024, E-025, E-029 to E-032, E-034, E-035, E-036 in `edges-owner.spec.ts`; E-026, E-027 and E-028 only check what exists (the confirmation says nothing ships and no email is sent; the returns page says how to ask for a refund), because the specs leave those features open.
