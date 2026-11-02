import type { MouseEvent } from "react";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  /** Ruta de destino del enlace. */
  fallback: string;
  /** Si se provee, reemplaza la navegación al destino. */
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
