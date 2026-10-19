import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

export function useToast(duration = 3000) {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback(
    (next: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setMessage(next);
      timeoutRef.current = setTimeout(() => setMessage(null), duration);
    },
    [duration]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { message, showToast };
}

export function Toast({ message }: { message: string | null }) {
  if (!message || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed bottom-6 left-4 right-4 z-[80] flex items-center gap-2 rounded-xl border border-violet/30 bg-surface px-4 py-2.5 text-xs font-medium text-text shadow-2xl backdrop-blur-md sm:left-auto sm:right-6">
      <Check className="h-4 w-4 shrink-0 text-emerald" aria-hidden="true" />
      <span className="min-w-0">{message}</span>
    </div>,
    document.body
  );
}
