export type Locale = "ko" | "en";

export const LOCALES: readonly Locale[] = ["ko", "en"] as const;
export const DEFAULT_LOCALE: Locale = "ko";

export function isLocale(value: unknown): value is Locale {
  return value === "ko" || value === "en";
}
