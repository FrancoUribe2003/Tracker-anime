import { useState, useEffect, useRef } from "react";
import { authClient } from "../lib/auth-client";
import SearchBar from "./SearchBar";
import LanguageSwitch from "./LanguageSwitch";
import type { UserCounts } from "../lib/counts";
import { COUNTS_CHANGED_EVENT } from "../lib/counts-client";
import type { Dictionary, Locale } from "../i18n";

interface UserProp {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

type CountsProp = Partial<UserCounts>;

interface NavbarProps {
  user?: UserProp | null;
  currentPath?: string;
  activeNav?: "inicio" | "catalogo" | "hoy" | "top";
  counts?: CountsProp;
  locale: Locale;
  dict: Dictionary["nav"];
  statusDict: Dictionary["status"];
}

const NAV_ITEMS = [
  { labelKey: "home", href: "/", key: "inicio", countKey: null },
  { labelKey: "catalog", href: "/catalogo", key: "catalogo", countKey: null },
  { labelKey: "whatsToday", href: "/que-ver-hoy", key: "hoy", countKey: null },
  { labelKey: "top", href: "/top", key: "top", countKey: "top" },
] as const;

function badgeClass(active: boolean): string {
  return active
    ? "border-emerald/30 bg-emerald/15 text-emerald"
    : "border-white/10 bg-surface-2 text-text-muted";
}

export default function Navbar({
  user,
  currentPath = "",
  activeNav,
  counts = { completed: 0, current: 0, planning: 0, top: 0 },
  locale,
  dict,
  statusDict,
}: NavbarProps) {
  const [liveCounts, setLiveCounts] = useState<CountsProp>(counts);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [navOutline, setNavOutline] = useState("0 0 0 0 0 1000");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Dibuja el contorno alrededor del ítem de nav en hover/focus.
  function showNavOutline(index: number) {
    const nav = navRef.current;
    if (!nav) return;
    const el = nav.querySelectorAll<HTMLElement>("[data-nav-item]")[index];
    if (!el) return;
    const W = nav.clientWidth;
    const H = nav.clientHeight;
    // El rect es 1%..99% del nav, con esquinas redondeadas de radio r.
    const left0 = W * 0.01;
    const rw = W * 0.98;
    const rh = H * 0.98;
    const r = Math.min(10, rw / 2, rh / 2);
    // Perímetro real del rect (incluye los 4 arcos de las esquinas).
    const P = 2 * (rw - 2 * r) + 2 * (rh - 2 * r) + 2 * Math.PI * r;
    // Rango horizontal del ítem en coordenadas locales del rect.
    const li = Math.max(r, Math.min(rw - r, el.offsetLeft - left0));
    const ri = Math.max(r, Math.min(rw - r, el.offsetLeft + el.offsetWidth - left0));
    const on = ri - li;
    // Distancia del arranque del borde inferior (lado que va de derecha a izquierda).
    const bottomStartDistance =
      (rw - 2 * r) + (Math.PI / 2) * r + (rh - 2 * r) + (Math.PI / 2) * r + (rw - r - ri);
    const topStart = li - r;
    const gap = bottomStartDistance - (topStart + on);
    const toFrac = (v: number) => ((v / P) * 100).toFixed(3);
    setNavOutline(`0 ${toFrac(topStart)} ${toFrac(on)} ${toFrac(gap)} ${toFrac(on)} 1000`);
  }

  // Mantener los contadores sincronizados tras las mutaciones hechas desde islas React
  useEffect(() => {
    function handleCountsChange(event: Event) {
      const detail = (event as CustomEvent<CountsProp>).detail;
      if (!detail) return;
      setLiveCounts((prev) => ({ ...prev, ...detail }));
    }
    window.addEventListener(COUNTS_CHANGED_EVENT, handleCountsChange);
    return () => window.removeEventListener(COUNTS_CHANGED_EVENT, handleCountsChange);
  }, []);

  // Cerrar menús al hacer click fuera del header
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
      if (headerRef.current && !headerRef.current.contains(target)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cerrar menús con la tecla Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cerrar el menú móvil al pasar a desktop
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    function handleChange(event: MediaQueryListEvent) {
      if (event.matches) setMobileMenuOpen(false);
    }
    desktop.addEventListener("change", handleChange);
    return () => desktop.removeEventListener("change", handleChange);
  }, []);

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/login";
          },
        },
      });
    } catch {
      window.location.href = "/login";
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isLinkActive = (itemKey: string, href: string) => {
    if (activeNav) return activeNav === itemKey;
    return currentPath === href || currentPath.startsWith(href + "/");
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 w-full bg-surface/90 backdrop-blur-md border-b border-white/5 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Marca a la izquierda */}
          <div className="flex items-center gap-8">
            <a href="/" className="flex min-h-[44px] items-center group">
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold tracking-tight text-text">Record</span>
                <span className="text-base font-semibold tracking-tight text-violet">Anime</span>
              </div>
            </a>

            {/* Navegación Desktop */}
            <nav
              ref={navRef}
              onMouseLeave={() => setNavOutline("0 0 0 0 0 1000")}
              className="relative hidden items-center gap-1 lg:flex"
            >
              {NAV_ITEMS.map((item, index) => {
                const active = isLinkActive(item.key, item.href);
                const count = item.countKey ? liveCounts[item.countKey] ?? 0 : 0;

                return (
                  <a
                    key={item.href}
                    href={item.href}
                    data-nav-item
                    onMouseEnter={() => showNavOutline(index)}
                    onFocus={() => showNavOutline(index)}
                    className={`relative z-[1] inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "border border-white/5 bg-surface-2/60 text-text"
                        : "text-text-muted hover:bg-surface-2/30 hover:text-text"
                    }`}
                  >
                    <span>{dict[item.labelKey]}</span>
                    {item.countKey && count > 0 && (
                      <span
                        className={`inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-[11px] font-semibold tracking-tight ${badgeClass(
                          active
                        )}`}
                      >
                        {count}
                      </span>
                    )}
                  </a>
                );
              })}
              <svg className="nav-outline-svg" aria-hidden="true">
                <rect
                  className="nav-outline-rect"
                  x="1%"
                  y="1%"
                  width="98%"
                  height="98%"
                  rx="10"
                  pathLength={100}
                  style={{ strokeDasharray: navOutline }}
                />
              </svg>
            </nav>
          </div>

          {/* Barra de búsqueda */}
          <div className="mx-2 flex min-w-0 flex-1 items-center justify-end gap-1 sm:mx-4 sm:justify-center">
            <div className="shrink-0 lg:hidden">
              <LanguageSwitch locale={locale} label={dict.language} />
            </div>
            <div className="w-auto min-w-0 sm:w-full sm:max-w-md">
              <SearchBar locale={locale} dict={dict} statusDict={statusDict} />
            </div>
          </div>

          {/* Menú de usuario y móvil a la derecha */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:block">
              <LanguageSwitch locale={locale} label={dict.language} />
            </div>
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-transparent p-1.5 text-left transition hover:border-white/5 hover:bg-surface-2/50 focus:outline-none focus:ring-2 focus:ring-violet sm:w-56"
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="menu"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-surface-2 text-xs font-semibold uppercase text-violet">
                    {user.name ? user.name.slice(0, 2) : "U"}
                  </div>
                  <div className="hidden min-w-0 text-left sm:block sm:flex-1">
                    <p className="truncate text-xs font-medium leading-tight text-text">
                      {user.name || dict.user}
                    </p>
                    <p className="truncate text-[11px] leading-tight text-text-dim">
                      {user.email}
                    </p>
                  </div>
                  <svg
                    className={`hidden h-3.5 w-3.5 text-text-muted transition-transform duration-200 sm:block ${
                      userDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown del usuario */}
                {userDropdownOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-56 max-w-[calc(100vw_-_2rem)] rounded-xl border border-white/5 bg-surface py-1.5 shadow-2xl">
                    <div className="border-b border-white/5 px-4 py-2 sm:hidden">
                      <p className="truncate text-xs font-medium text-text">{user.name}</p>
                      <p className="truncate text-[11px] text-text-dim">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={isLoggingOut}
                      className="logout-btn"
                    >
                      <span className="logout-content">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>{isLoggingOut ? dict.loggingOut : dict.logout}</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <a
                  href="/login"
                  className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-xs font-medium text-text-muted transition hover:text-text"
                >
                  {dict.login}
                </a>
                <a
                  href="/registro"
                  className="inline-flex min-h-[44px] items-center rounded-lg bg-violet px-3.5 text-xs font-medium text-white shadow-md shadow-violet/20 transition hover:bg-violet/90"
                >
                  {dict.register}
                </a>
              </div>
            )}

            {/* Botón Hamburger Mobile */}
            <div className="flex items-center lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-transparent text-text-muted transition hover:border-white/5 hover:bg-surface-2 hover:text-text focus:outline-none focus:ring-2 focus:ring-violet"
                aria-label={mobileMenuOpen ? dict.closeMenu : dict.openMenu}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Menú colapsable Mobile */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="animate-fade-in space-y-1 border-t border-white/5 bg-surface px-4 pt-2 lg:hidden"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isLinkActive(item.key, item.href);
            const count = item.countKey ? liveCounts[item.countKey] ?? 0 : 0;

            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex min-h-[44px] items-center justify-between rounded-lg px-3 text-sm font-medium transition-colors ${
                  active
                    ? "border border-white/5 bg-surface-2/80 text-text"
                    : "text-text-muted hover:bg-surface-2/30 hover:text-text"
                }`}
              >
                <span>{dict[item.labelKey]}</span>
                {item.countKey && count > 0 && (
                  <span
                    className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass(
                      active
                    )}`}
                  >
                    {count}
                  </span>
                )}
              </a>
            );
          })}

          <div className="mt-2 border-t border-white/5 pt-3">
            <LanguageSwitch locale={locale} label={dict.language} />
          </div>

          {user && (
            <div className="border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="logout-btn"
              >
                <span className="logout-content">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>{isLoggingOut ? dict.loggingOut : dict.logout}</span>
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
