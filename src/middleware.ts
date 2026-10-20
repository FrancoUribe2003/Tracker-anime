import { defineMiddleware } from "astro:middleware";
import { auth } from "./lib/auth";
import { isLocale, type Locale } from "./i18n";

const PUBLIC_ROUTES = ["/login", "/registro"];
const PUBLIC_API_ROUTES = ["/api/locale"];
const STATIC_ASSET_REGEX = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2|ttf|eot)$/;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://s4.anilist.co https://img.youtube.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

function detectLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  if (acceptLanguage?.trim().toLowerCase().startsWith("en")) return "en";
  return "es";
}

function withSecurityHeaders(response: Response): Response {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  context.locals.locale = detectLocale(
    context.cookies.get("lang")?.value,
    context.request.headers.get("accept-language")
  );

  if (
    pathname.startsWith("/_astro") ||
    pathname.startsWith("/_image") ||
    pathname.startsWith("/favicon") ||
    STATIC_ASSET_REGEX.test(pathname)
  ) {
    return withSecurityHeaders(await next());
  }

  const isAuthRoute = pathname.startsWith("/api/auth");
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  if (isAuthRoute) {
    return withSecurityHeaders(await next());
  }

  if (PUBLIC_API_ROUTES.includes(pathname)) {
    context.locals.user = null;
    context.locals.session = null;
    return withSecurityHeaders(await next());
  }

  const cookieHeader = context.request.headers.get("cookie") || "";
  const hasSessionCookie =
    cookieHeader.includes("better-auth.session_token") ||
    cookieHeader.includes("better-auth.session_data") ||
    cookieHeader.includes("session_token");

  if (isPublicRoute && !hasSessionCookie) {
    context.locals.user = null;
    context.locals.session = null;
    return withSecurityHeaders(await next());
  }

  if (!isPublicRoute && !hasSessionCookie) {
    context.locals.user = null;
    context.locals.session = null;
    return withSecurityHeaders(context.redirect("/login"));
  }

  const sessionData = await auth.api.getSession({
    headers: context.request.headers,
  });

  context.locals.user = sessionData?.user ?? null;
  context.locals.session = sessionData?.session ?? null;

  if (context.locals.user && isPublicRoute) {
    return withSecurityHeaders(context.redirect("/"));
  }

  if (!context.locals.user && !isPublicRoute) {
    return withSecurityHeaders(context.redirect("/login"));
  }

  const response = await next();

  const isApiRequest = pathname.startsWith("/api");
  if (!isApiRequest || context.request.method === "GET") {
    response.headers.set("Cache-Control", "private, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return withSecurityHeaders(response);
});
