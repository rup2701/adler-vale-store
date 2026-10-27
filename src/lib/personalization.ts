/** Letters, numbers, spaces and & . , ' - only. */
const ALLOWED = /^[\p{L}\p{N} &.,'\-]*$/u;

/** Trim and collapse whitespace. An empty result means "no personalization". */
export function normalizePersonalization(input: string | null | undefined): string {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

export type PersonalizationCheck = { ok: true; value: string } | { ok: false; message: string };

export function checkPersonalization(
  input: string | null | undefined,
  maxLength: number,
  label = "Personalization",
): PersonalizationCheck {
  const value = normalizePersonalization(input);
  if (value.length > maxLength) {
    return { ok: false, message: `${label} can be at most ${maxLength} characters. You have ${value.length}.` };
  }
  if (!ALLOWED.test(value)) {
    return {
      ok: false,
      message: `${label} can use letters, numbers, spaces and & . , ' - only. Please remove other characters.`,
    };
  }
  return { ok: true, value };
}
