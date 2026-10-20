import type { Dictionary } from "../i18n";

export function apiErrorMessage(
  code: string | undefined,
  fallback: string,
  errors: Dictionary["errors"]
): string {
  if (!code) return fallback;
  const messages = errors as Record<string, string>;
  return messages[code] ?? fallback;
}
