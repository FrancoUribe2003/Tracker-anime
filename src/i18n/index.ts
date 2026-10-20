import { es, type Dictionary } from "./es";
import { en } from "./en";

export type Locale = "es" | "en";
export type { Dictionary };

export const LOCALES: readonly Locale[] = ["es", "en"];
export const DEFAULT_LOCALE: Locale = "es";

export function isLocale(value: unknown): value is Locale {
  return value === "es" || value === "en";
}

export function getDictionary(locale: Locale): Dictionary {
  return locale === "en" ? en : es;
}

export function t(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  );
}

export function plural(
  locale: Locale,
  count: number,
  forms: { one: string; other: string }
): string {
  return new Intl.PluralRules(locale).select(count) === "one" ? forms.one : forms.other;
}

export function formatDate(
  locale: Locale,
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(date));
}

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercent(
  locale: Locale,
  value: number,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 1 }
): string {
  return new Intl.NumberFormat(locale, { style: "percent", ...options }).format(value);
}
