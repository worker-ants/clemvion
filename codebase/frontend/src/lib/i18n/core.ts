import { ko } from "./dict/ko";
import { en } from "./dict/en";
import type { Dict } from "./dict/types";
import { DEFAULT_LOCALE, type Locale } from "./types";

const dictionaries: Record<Locale, Dict> = { ko, en };

// Compile-time derivation of dot-notation translation keys from the reference
// dictionary shape — e.g. `"common.save" | "auth.login.title" | ...`.
type PathInto<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends string
    ? `${K}`
    : T[K] extends object
      ? `${K}.${PathInto<T[K]>}`
      : never
  : never;

export type TranslationKey = PathInto<Dict>;

// Module-scope regex so we don't recompile on every interpolate() call.
const INTERPOLATION_RE = /\{\{\s*(\w+)\s*\}\}/g;

function resolve(dict: Dict, key: string): string | undefined {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = dict;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(INTERPOLATION_RE, (_match, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[i18n] Missing parameter "${name}" for template: ${template}`);
      }
      return "";
    }
    return String(value);
  });
}

/**
 * Translate a key for the given locale with optional `{{placeholder}}` interpolation.
 * Falls back to Korean if the key is missing in the target locale. Returns the raw key
 * (and warns in development) if the key is missing in both. Pure function — safe to call
 * from Server Components, tests, and utility modules.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  // Skip the second lookup when we already queried the fallback dictionary.
  const value =
    locale === DEFAULT_LOCALE
      ? resolve(dict, key)
      : (resolve(dict, key) ?? resolve(dictionaries[DEFAULT_LOCALE], key));
  if (value === undefined) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[i18n] Missing translation: ${key}`);
    }
    return key;
  }
  return interpolate(value, params);
}

export type TFunction = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;
