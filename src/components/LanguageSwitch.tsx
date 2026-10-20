import { useState } from "react";
import { Globe } from "lucide-react";
import type { Locale } from "../i18n";

interface LanguageSwitchProps {
  locale: Locale;
  label: string;
}

export default function LanguageSwitch({ locale, label }: LanguageSwitchProps) {
  const [pending, setPending] = useState<Locale | null>(null);

  async function select(next: Locale) {
    if (next === locale || pending !== null) return;
    setPending(next);
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      if (!response.ok) throw new Error("locale_update_failed");
      window.location.reload();
    } catch {
      setPending(null);
    }
  }

  return (
    <label className={`lang-switch${pending !== null ? " is-pending" : ""}`} aria-label={label}>
      <input
        type="checkbox"
        role="switch"
        checked={locale === "en"}
        onChange={(event) => void select(event.target.checked ? "en" : "es")}
        disabled={pending !== null}
        aria-label={label}
      />
      <span className="lang-slider">
        <span className="lang-title">{locale === "es" ? "Español" : "English"}</span>
        <span className="lang-ball" aria-hidden="true">
          <Globe className="lang-icon" />
        </span>
      </span>
    </label>
  );
}
