import type { MouseEvent } from "react";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  /** Ruta a la que ir si no se puede usar el historial del navegador. */
  fallback: string;
  /** Si se provee, reemplaza el comportamiento por defecto (historial/fallback). */
  onNavigate?: () => void;
  label?: string;
  className?: string;
}

export default function BackButton({
  fallback,
  onNavigate,
  label = "Volver",
  className = "",
}: BackButtonProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onNavigate) {
      event.preventDefault();
      onNavigate();
      return;
    }

    let sameOriginReferrer = false;
    try {
      sameOriginReferrer =
        Boolean(document.referrer) &&
        new URL(document.referrer).origin === window.location.origin;
    } catch {
      sameOriginReferrer = false;
    }

    if (sameOriginReferrer && window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
  };

  return (
    <a
      href={fallback}
      onClick={handleClick}
      aria-label={label}
      className={`btn-back self-start focus:outline-none focus:ring-2 focus:ring-violet ${className}`}
    >
      <span className="arrow" aria-hidden="true">
        <ArrowLeft className="h-4 w-4 shrink-0" />
      </span>
      <span>{label}</span>
    </a>
  );
}
