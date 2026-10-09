# Image de production TimeSheet (Next.js en sortie standalone).
# PostgreSQL est géré à part (PROMPT.md §20) : DATABASE_URL est fourni à l'exécution.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
# Sans openssl, Prisma génère le moteur pour OpenSSL 1.1, absent de bookworm (OpenSSL 3).
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
# Chromium pour les PDF (fiche de présence, exports) : même version que playwright-core
# dans package.json, installé hors du dossier personnel pour l'utilisateur « app ».
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx --yes playwright-core@1.63.0 install --with-deps chromium && rm -rf /root/.npm
RUN groupadd --system app && useradd --system --gid app app && mkdir -p /app/storage && chown app:app /app/storage
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
USER app
EXPOSE 3000
CMD ["node", "server.js"]
