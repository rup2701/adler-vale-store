"use client";
import { useSyncExternalStore } from "react";
import { settings } from "@/config/settings";
import { cartLineKey, type CartLine } from "@/lib/cart-types";

export type CartState = { token: string; lines: CartLine[] };

const KEY = "av_cart_v1";
const MAX = settings.orders.maxQuantityPerLine;
const EMPTY: CartState = { token: "", lines: [] };

let memory: CartState = EMPTY;
let storageOk = true;
let cache: { raw: string | null; state: CartState } = { raw: null, state: EMPTY };
const listeners = new Set<() => void>();

function newToken() {
  try {
    return crypto.randomUUID();
  } catch {
    return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function sanitize(value: unknown): CartState {
  if (!value || typeof value !== "object") return EMPTY;
  const v = value as { token?: unknown; lines?: unknown };
  const lines = Array.isArray(v.lines)
    ? (v.lines as CartLine[]).filter(
        (l) =>
          l &&
          typeof l.productId === "number" &&
          Array.isArray(l.optionValueIds) &&
          typeof l.quantity === "number" &&
          l.quantity >= 1 &&
          l.quantity <= MAX,
      )
    : [];
  return { token: typeof v.token === "string" ? v.token : "", lines };
}

function getSnapshot(): CartState {
  if (!storageOk) return memory;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    storageOk = false;
    return memory;
  }
  if (raw === cache.raw) return cache.state;
  let state = EMPTY;
  try {
    state = raw ? sanitize(JSON.parse(raw)) : EMPTY;
  } catch {
    state = EMPTY;
  }
  cache = { raw, state };
  memory = state;
  return state;
}

function emit() {
  listeners.forEach((l) => l());
}

function write(next: CartState) {
  memory = next;
  if (storageOk) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      storageOk = false;
    }
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export type AddInput = {
  productId: number;
  slug: string;
  optionValueIds: number[];
  personalization: string;
  quantity: number;
  unitPriceCents: number;
};

export type AddResult = { ok: true; lineQuantity: number } | { ok: false; reason: "max"; existing: number };

export const cartActions = {
  add(input: AddInput): AddResult {
    const state = getSnapshot();
    const key = cartLineKey(input.productId, input.optionValueIds, input.personalization);
    const current = state.lines.find((l) => l.key === key);
    const existing = current?.quantity ?? 0;
    if (existing + input.quantity > MAX) return { ok: false, reason: "max", existing };
    const token = state.token || newToken();
    const lines = current
      ? state.lines.map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + input.quantity, seenUnitPriceCents: input.unitPriceCents } : l,
        )
      : [
          ...state.lines,
          {
            key,
            productId: input.productId,
            slug: input.slug,
            optionValueIds: [...input.optionValueIds].sort((a, b) => a - b),
            personalization: input.personalization,
            quantity: input.quantity,
            seenUnitPriceCents: input.unitPriceCents,
          },
        ];
    write({ token, lines });
    return { ok: true, lineQuantity: existing + input.quantity };
  },
  setQuantity(key: string, quantity: number) {
    const state = getSnapshot();
    const q = Math.min(MAX, Math.max(1, Math.floor(quantity)));
    write({ ...state, lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: q } : l)) });
  },
  remove(key: string) {
    const state = getSnapshot();
    write({ ...state, lines: state.lines.filter((l) => l.key !== key) });
  },
  /** Remember the price the shopper has now seen, after a notice about a change was shown. */
  acknowledgePrices(prices: Record<string, number>) {
    const state = getSnapshot();
    write({
      ...state,
      lines: state.lines.map((l) => (prices[l.key] != null ? { ...l, seenUnitPriceCents: prices[l.key] } : l)),
    });
  },
  ensureToken(): string {
    const state = getSnapshot();
    if (state.token) return state.token;
    const token = newToken();
    write({ ...state, token });
    return token;
  },
  /** After an order is placed: empty the cart and start a new one-time token. */
  clearAfterOrder() {
    write({ token: newToken(), lines: [] });
  },
};

export function useCartState(): CartState {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

/** True when the browser blocks storage, so the cart only lasts for this visit. */
export function useStorageBlocked(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      getSnapshot();
      return !storageOk;
    },
    () => false,
  );
}

export function cartCount(state: CartState): number {
  return state.lines.reduce((n, l) => n + l.quantity, 0);
}
