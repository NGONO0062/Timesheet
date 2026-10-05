// Contrôle optimiste (PROMPT.md §7, guide d'authentification de Next 16) : sans
// cookie de session, retour à la connexion. Les vrais contrôles sont faits côté
// serveur, par la couche de données, à chaque requête.
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/connexion", "/mot-de-passe-oublie", "/api/auth", "/design"];
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (SESSION_COOKIES.some((c) => request.cookies.has(c))) return NextResponse.next();
  return NextResponse.redirect(new URL("/connexion", request.url));
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
