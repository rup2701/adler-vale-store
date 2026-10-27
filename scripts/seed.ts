/**
 * Seeds the sample store: categories, brands, collections, stores, settings and 24 sample products.
 * Safe by default (edge E-024): refuses to touch a store that already has products unless you pass --confirm.
 *   npm run db:seed
 *   npm run db:seed -- --confirm      (wipes the catalog, keeps past orders)
 */
try {
  process.loadEnvFile(".env");
} catch {
  /* env may come from the host */
}

import { count } from "drizzle-orm";
import { db, pool } from "../src/db";
import * as s from "../src/db/schema";
import { slugify } from "../src/lib/slug";
import { settings } from "../src/config/settings";

const SIZES = settings.sizes as readonly string[];

type Spec = {
  name: string;
  brand: string;
  category: string;
  price: number;
  compareAt?: number;
  tagline: string;
  desc: string;
  material: string;
  colors?: string[];
  /** Per-size stock for sizes 0..10, or for shoe sizes. */
  sizeStock?: number[];
  shoeStock?: number[];
  stock?: number;
  collections: string[];
  extraOption?: { name: string; values: { value: string; adjust: number }[]; def: string };
  personalize?: { label: string; max: number };
  made: string;
};

const clothingCare = ["Dry clean or hand wash cold", "Do not tumble dry", "Cool iron if needed", "Store folded or on a padded hanger"];
const leatherCare = ["Wipe with a soft dry cloth", "Keep away from water and heat", "Store in the dust bag provided", "Condition leather twice a year"];
const jewelCare = ["Store separately in a pouch", "Avoid perfume and water", "Polish with a soft cloth"];
const scarfCare = ["Dry clean recommended", "Press on low heat, reverse side", "Store flat or rolled"];

const catalog: Spec[] = [
  { name: "Aldine Wrap Dress", brand: "Marlowe", category: "Dresses", price: 385, tagline: "A fluid crepe wrap with a defined waist", desc: "A midi wrap dress cut from weighty crepe that skims rather than clings. The tie sits at the natural waist and the sleeve ends in a softly gathered cuff.", material: "100% viscose crepe, fully lined", colors: ["Ink", "Ivory"], sizeStock: [3, 4, 5, 4, 3, 2], collections: ["New Arrivals", "Best Sellers"], made: "Portugal" },
  { name: "Soledad Silk Slip Dress", brand: "Ines Vega", category: "Dresses", price: 640, tagline: "Bias-cut silk satin with a cowl back", desc: "Cut on the bias so it moves with you, finished with narrow adjustable straps and a low cowl back. Dress it up with heels or down with a knit.", material: "100% silk satin", colors: ["Champagne", "Midnight"], sizeStock: [0, 2, 3, 0, 1, 2], collections: ["Occasion Dressing", "New Arrivals"], made: "Italy" },
  { name: "Noor Pleated Gown", brand: "Atelier Noor", category: "Dresses", price: 1280, tagline: "Hand-pleated georgette, floor length", desc: "Hundreds of fine hand-set pleats give this gown its movement. A fitted bodice and concealed side zip keep the line clean for evening.", material: "100% silk georgette, silk lining", colors: ["Garnet"], sizeStock: [1, 1, 0, 1, 0, 0], collections: ["Occasion Dressing"], made: "India" },
  { name: "Harlan Shirt Dress", brand: "Hollis Grey", category: "Dresses", price: 245, tagline: "Crisp cotton poplin with a belted waist", desc: "A modern shirt dress with a pointed collar, concealed placket and a removable self belt. Easy enough for every day, sharp enough for the office.", material: "100% organic cotton poplin", colors: ["Chalk", "Navy"], sizeStock: [4, 5, 6, 6, 4, 3], collections: ["Best Sellers"], made: "Portugal" },
  { name: "Linen Midi Dress", brand: "Fenwick", category: "Dresses", price: 190, tagline: "Washed linen with a relaxed swing", desc: "Pre-washed linen with a square neck and in-seam pockets. A warm-weather favourite that softens with every wear.", material: "100% European linen", colors: ["Sand", "Sage"], sizeStock: [0, 0, 0, 0, 0, 0], collections: ["Best Sellers"], made: "Lithuania" },

  { name: "Cove Cashmere Crewneck", brand: "Marlowe", category: "Tops", price: 320, tagline: "Featherweight two-ply cashmere", desc: "A clean crewneck knitted in fine two-ply cashmere with ribbed trims and a slightly cropped body that sits well over high-waisted pieces.", material: "100% grade-A cashmere", colors: ["Oat", "Charcoal"], sizeStock: [3, 4, 5, 5, 3, 2], collections: ["New Arrivals"], made: "Scotland" },
  { name: "Sable Silk Blouse", brand: "Hollis Grey", category: "Tops", price: 210, tagline: "Washed silk with a concealed placket", desc: "A softly draped blouse in sand-washed silk with a relaxed shoulder and covered buttons. Wear it tucked or loose.", material: "100% washed silk", colors: ["Ivory", "Black"], sizeStock: [2, 0, 3, 4, 0, 2], collections: ["Best Sellers", "New Arrivals"], made: "China" },
  { name: "Luz Bodysuit", brand: "Ines Vega", category: "Tops", price: 135, tagline: "Seamless stretch with a scooped back", desc: "A second-skin bodysuit in a smooth stretch jersey, with a low scoop back and snap closure. Layers under blazers and tailoring.", material: "78% modal, 22% elastane", colors: ["Black", "Stone"], sizeStock: [4, 5, 5, 5, 4, 3], collections: ["New Arrivals"], made: "Portugal" },
  { name: "Oxford Poplin Shirt", brand: "Fenwick", category: "Tops", price: 120, tagline: "The everyday white shirt, perfected", desc: "A boyfriend-fit shirt in a fine cotton poplin with a soft collar and curved hem. Sample is sold out in every size.", material: "100% Egyptian cotton", colors: ["White", "Pale Blue"], sizeStock: [0, 0, 0, 0, 0, 0], collections: ["Best Sellers"], made: "Portugal" },

  { name: "Satin Bias Skirt", brand: "Atelier Noor", category: "Skirts", price: 295, tagline: "Liquid satin cut on the bias", desc: "A midi skirt that falls in a long, fluid line, finished with an elasticated back waist for an easy fit.", material: "100% acetate satin, viscose lining", colors: ["Champagne", "Black"], sizeStock: [2, 0, 3, 3, 0, 1], collections: ["Occasion Dressing", "New Arrivals"], made: "Turkey" },
  { name: "Tilda Pleated Midi", brand: "Marlowe", category: "Skirts", price: 260, tagline: "Sunray pleats in a fluid twill", desc: "Sunray pleats radiate from a flat waistband and keep their shape all day. The twill has just enough weight to swing.", material: "100% recycled polyester twill", colors: ["Navy", "Camel"], sizeStock: [3, 4, 4, 4, 3, 2], collections: ["Best Sellers"], made: "Portugal" },
  { name: "Wool Pencil Skirt", brand: "Hollis Grey", category: "Skirts", price: 230, tagline: "Sharp tailoring in Italian wool", desc: "A knee-length pencil skirt with a back vent and invisible zip, tailored from a fine Italian wool crepe.", material: "96% virgin wool, 4% elastane", colors: ["Charcoal"], sizeStock: [3, 3, 4, 4, 3, 2], collections: [], made: "Italy" },

  { name: "Calla Slingback", brand: "Ines Vega", category: "Shoes", price: 495, tagline: "A kitten heel in polished calfskin", desc: "A pointed slingback on a 55 mm heel with a cushioned insole and leather sole, made by hand in small batches.", material: "Calfskin upper, leather lining and sole", colors: ["Black", "Bone"], shoeStock: [2, 3, 3, 2, 1], collections: ["Occasion Dressing", "New Arrivals"], made: "Spain" },
  { name: "Harbor Leather Loafer", brand: "Fenwick", category: "Shoes", price: 340, tagline: "A chunky loafer with a Blake-stitched sole", desc: "A polished loafer with a hand-stitched apron toe and a stacked sole that gives a little height.", material: "Full-grain leather, rubber sole", colors: ["Black", "Cognac"], shoeStock: [3, 4, 4, 3, 2], collections: ["Best Sellers"], made: "Portugal" },
  { name: "Noor Strappy Sandal", brand: "Atelier Noor", category: "Shoes", price: 425, tagline: "Metallic nappa on a slim block heel", desc: "Slim ankle straps and a covered block heel, in a soft metallic nappa that catches the light at evening events.", material: "Metallic nappa leather, leather sole", colors: ["Gold"], shoeStock: [1, 0, 2, 0, 1], collections: ["Occasion Dressing"], made: "Italy" },

  { name: "Wren Leather Tote", brand: "Marlowe", category: "Bags", price: 890, tagline: "Structured everyday tote with a suede lining", desc: "A roomy, structured tote with a zip-top, interior pocket and flat handles that sit comfortably on the shoulder. Add a monogram if you like.", material: "Vegetable-tanned leather, suede lining", colors: ["Cognac", "Black"], stock: 6, collections: ["New Arrivals", "Best Sellers"], extraOption: { name: "Finish", def: "Smooth", values: [{ value: "Smooth", adjust: 0 }, { value: "Suede", adjust: 80 }] }, personalize: { label: "Monogram", max: 3 }, made: "Italy" },
  { name: "Mini Lune Crossbody", brand: "Ines Vega", category: "Bags", price: 1150, tagline: "A sculpted half-moon in smooth leather", desc: "A small half-moon bag with a detachable chain and a leather shoulder strap, big enough for a phone, cards and keys.", material: "Smooth calfskin, gold-tone hardware", colors: ["Black", "Oxblood"], stock: 4, collections: ["Occasion Dressing"], made: "Italy" },
  { name: "Canvas Weekender", brand: "Fenwick", category: "Bags", price: 690, tagline: "Waxed canvas with leather trims", desc: "A generous overnight bag in waxed canvas with leather handles, a zipped pocket and a detachable shoulder strap.", material: "Waxed cotton canvas, leather trims", colors: ["Natural"], stock: 5, collections: ["Best Sellers"], made: "United Kingdom" },

  { name: "Vale Gold Hoops", brand: "Atelier Noor", category: "Jewelry", price: 175, tagline: "Hand-polished 18k gold vermeil", desc: "Lightweight hollow hoops, hand-polished to a soft shine. Sleeper closure, comfortable all day.", material: "18k gold vermeil on sterling silver", stock: 8, collections: ["Occasion Dressing", "Best Sellers"], extraOption: { name: "Diameter", def: "Medium", values: [{ value: "Small", adjust: -20 }, { value: "Medium", adjust: 0 }, { value: "Large", adjust: 40 }] }, made: "Italy" },
  { name: "Antique Pearl Collar", brand: "Atelier Noor", category: "Jewelry", price: 1400, tagline: "One of a kind, strung by hand", desc: "A vintage collar of freshwater pearls knotted by hand on silk thread. Only one exists.", material: "Freshwater pearls, silk thread, gold clasp", stock: 1, collections: ["Occasion Dressing"], made: "France" },

  { name: "Merino Wrap Scarf", brand: "Hollis Grey", category: "Accessories", price: 150, tagline: "Oversized brushed merino", desc: "A generous brushed merino wrap that doubles as a shawl. Add a monogram stitched in the corner.", material: "100% extra-fine merino wool", colors: ["Oat", "Slate"], stock: 9, collections: ["New Arrivals"], personalize: { label: "Monogram", max: 10 }, made: "Scotland" },
  { name: "Silk Twill Square", brand: "Marlowe", category: "Accessories", price: 95, tagline: "Hand-rolled edges, original print", desc: "A printed silk twill square with hand-rolled edges. Wear it at the neck, in the hair or on a bag handle.", material: "100% silk twill", colors: ["Dune", "Indigo"], stock: 12, collections: ["Best Sellers"], extraOption: { name: "Size", def: "Standard", values: [{ value: "Standard", adjust: 0 }, { value: "Oversized", adjust: 60 }] }, made: "France" },

  { name: "Parker Trench Coat", brand: "Fenwick", category: "Sale", price: 420, compareAt: 640, tagline: "A storm-proof classic, now reduced", desc: "A double-breasted trench in water-resistant cotton gabardine with a detachable belt and storm flap. End-of-season price.", material: "Cotton gabardine, cupro lining", colors: ["Stone", "Navy"], sizeStock: [1, 2, 3, 2, 1, 1], collections: [], made: "United Kingdom" },
  { name: "Linen Wide-Leg Trouser", brand: "Hollis Grey", category: "Sale", price: 110, compareAt: 190, tagline: "High-rise, wide leg, washed linen", desc: "A high-rise trouser with a wide, fluid leg and side pockets, in softly washed linen. End-of-season price.", material: "100% washed linen", colors: ["Sand"], sizeStock: [0, 2, 0, 3, 2, 0], collections: [], made: "Portugal" },
];

function careFor(category: string): string[] {
  if (category === "Bags" || category === "Shoes") return leatherCare;
  if (category === "Jewelry") return jewelCare;
  if (category === "Accessories") return scarfCare;
  return clothingCare;
}

function fitFor(category: string): string {
  switch (category) {
    case "Dresses": return "Midi length, true to size";
    case "Tops": return "Relaxed, true to size";
    case "Skirts": return "Mid-rise, true to size";
    case "Shoes": return "True to size; half sizes size up";
    case "Bags": return "See dimensions in description";
    case "Jewelry": return "One size";
    case "Accessories": return "One size";
    default: return "True to size";
  }
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const [{ n }] = await db.select({ n: count() }).from(s.products);
  if (n > 0 && !confirm) {
    console.error(
      `Refusing to seed: this store already has ${n} product(s). Seeding wipes the catalog (products, photos, categories, brands, collections, stores). Past orders are kept.\nRun again with --confirm if you really want to reset: npm run db:seed -- --confirm`,
    );
    process.exitCode = 1;
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(s.products);
    await tx.delete(s.categories);
    await tx.delete(s.brands);
    await tx.delete(s.collections);
    await tx.delete(s.stores);
    await tx.delete(s.siteSettings);

    const cats = await tx
      .insert(s.categories)
      .values(
        ["Dresses", "Tops", "Skirts", "Shoes", "Bags", "Jewelry", "Accessories", "Sale"].map((name, i) => ({
          name,
          slug: slugify(name),
          position: i,
        })),
      )
      .returning();
    const catId = new Map(cats.map((c) => [c.name, c.id]));

    const brandDescriptions: Record<string, string> = {
      Marlowe: "Considered everyday tailoring and knitwear, made in small runs in Portugal and Scotland.",
      "Ines Vega": "Sculpted evening pieces and leather goods by designer Ines Vega, made in Italy and Spain.",
      "Hollis Grey": "Quietly polished separates in natural fibres, designed to be worn for years.",
      "Atelier Noor": "Hand-finished occasionwear and jewelry from a small atelier with Indian and French roots.",
      Fenwick: "Heritage-minded outerwear, shirting and travel pieces with a modern line.",
    };
    const brs = await tx
      .insert(s.brands)
      .values(
        ["Marlowe", "Ines Vega", "Hollis Grey", "Atelier Noor", "Fenwick"].map((name, i) => ({
          name,
          slug: slugify(name),
          description: brandDescriptions[name],
          position: i,
        })),
      )
      .returning();
    const brandId = new Map(brs.map((b) => [b.name, b.id]));

    const cols = await tx
      .insert(s.collections)
      .values([
        { name: "New Arrivals", slug: "new-arrivals", description: "The newest pieces for the season.", showOnHome: true, homePosition: 0 },
        { name: "Occasion Dressing", slug: "occasion-dressing", description: "Dresses and finishing touches for celebrations.", showOnHome: true, homePosition: 1 },
        { name: "Best Sellers", slug: "best-sellers", description: "What our customers keep coming back for.", showOnHome: true, homePosition: 2 },
      ])
      .returning();
    const colId = new Map(cols.map((c) => [c.name, c.id]));

    await tx.insert(s.stores).values([
      { name: "Los Gatos", address: "Sample address, Los Gatos, CA", phone: "555-0100", pickup: true, pickupReady: "Usually ready in 4 hours", note: "", position: 0 },
      { name: "Santa Barbara", address: "Sample address, Montecito, CA", phone: "555-0101", pickup: true, pickupReady: "Usually ready the next day", note: "New location", position: 1 },
    ]);

    await tx.insert(s.siteSettings).values([
      { key: "announcement", value: { enabled: settings.defaults.announcementEnabled, messages: [...settings.defaults.announcementMessages] } },
      {
        key: "home",
        value: {
          heroHeadline: settings.defaults.heroHeadline,
          heroButtonLabel: settings.defaults.heroButtonLabel,
          heroButtonHref: settings.defaults.heroButtonHref,
          heroImageUrl: null,
          heroImageAlt: "",
          logoUrl: null,
        },
      },
    ]);

    for (const p of catalog) {
      const tracked = p.sizeStock ?? p.shoeStock;
      const totalStock = tracked ? tracked.reduce((a, b) => a + b, 0) : (p.stock ?? 0);
      const [row] = await tx
        .insert(s.products)
        .values({
          slug: slugify(p.name),
          name: p.name,
          tagline: p.tagline,
          brandId: brandId.get(p.brand)!,
          categoryId: catId.get(p.category)!,
          department: "women",
          description: p.desc,
          materialsCare: [p.material, ...careFor(p.category)],
          specifications: [
            { label: "Brand", value: p.brand },
            { label: "Material", value: p.material },
            { label: "Fit", value: fitFor(p.category) },
            { label: "Made in", value: p.made },
          ],
          priceCents: p.price * 100,
          compareAtCents: p.compareAt ? p.compareAt * 100 : null,
          stock: totalStock,
          status: "published",
          isSample: true,
          personalizable: !!p.personalize,
          personalizationLabel: p.personalize?.label ?? "Monogram",
          personalizationMaxLength: p.personalize?.max ?? settings.personalization.defaultMaxLength,
        })
        .returning();

      for (const c of p.collections) {
        await tx.insert(s.productCollections).values({ productId: row.id, collectionId: colId.get(c)! });
      }

      let pos = 0;
      const addOption = async (
        name: string,
        values: { value: string; adjust?: number; stock?: number }[],
        def: string | null,
        tracksStock: boolean,
      ) => {
        const [opt] = await tx
          .insert(s.productOptions)
          .values({ productId: row.id, name, required: true, defaultValue: def, tracksStock, position: pos++ })
          .returning();
        await tx.insert(s.productOptionValues).values(
          values.map((v, i) => ({
            optionId: opt.id,
            value: v.value,
            priceAdjustCents: (v.adjust ?? 0) * 100,
            stock: v.stock ?? 0,
            position: i,
          })),
        );
      };

      if (p.colors) await addOption("Color", p.colors.map((value) => ({ value })), p.colors[0], false);
      if (p.extraOption) await addOption(p.extraOption.name, p.extraOption.values, p.extraOption.def, false);
      if (p.sizeStock) await addOption("Size", SIZES.map((value, i) => ({ value, stock: p.sizeStock![i] })), null, true);
      if (p.shoeStock)
        await addOption("Size", ["6", "7", "8", "9", "10"].map((value, i) => ({ value, stock: p.shoeStock![i] })), null, true);
    }
  });

  const [{ n: after }] = await db.select({ n: count() }).from(s.products);
  console.log(`Seeded ${after} sample products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
