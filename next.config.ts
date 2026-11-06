import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // playwright-core lit ses fichiers (browsers.json…) dynamiquement : le traçage ne les voit pas.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/playwright-core/**/*"],
  },
  // En-têtes de sécurité sur toutes les réponses. L'application n'est jamais affichée
  // dans une page d'un autre site (un clic piégé sur « Valider » serait possible).
  // HSTS n'a d'effet qu'en HTTPS : le navigateur l'ignore sur http://localhost.
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};

export default nextConfig;
