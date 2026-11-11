# Image de production TimeSheet (réécriture) : l'API .NET 10 sert aussi l'interface (Vite,
# fichiers statiques dans wwwroot), sur la même origine. Chromium pour les PDF (exports
# du reporting et du journal). PostgreSQL est géré à part : la chaîne de connexion est fournie à
# l'exécution. Les migrations s'appliquent au démarrage (verrou PostgreSQL).
#
#   docker build -f deploy/Dockerfile -t timesheet:<version> .

# --- Interface ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- API ---------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY backend/SharedKernel/SharedKernel.csproj backend/SharedKernel/
COPY backend/TimeSheet.Api/src/TimeSheet.Api/TimeSheet.Api.csproj backend/TimeSheet.Api/src/TimeSheet.Api/
RUN dotnet restore backend/TimeSheet.Api/src/TimeSheet.Api/TimeSheet.Api.csproj -r linux-x64
COPY backend/ backend/
RUN dotnet publish backend/TimeSheet.Api/src/TimeSheet.Api/TimeSheet.Api.csproj -c Release -r linux-x64 --self-contained false --no-restore -o /out

# --- Exécution ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS run
WORKDIR /app
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:8080 \
    STORAGE_DIR=/app/storage \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=api /out ./
COPY --from=web /web/dist ./wwwroot
# Chromium (version du paquet Microsoft.Playwright) et ses bibliothèques système, par le
# pilote livré avec la publication ; hors du dossier personnel, pour l'utilisateur « app ».
RUN ./.playwright/node/linux-x64/node ./.playwright/package/cli.js install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app && useradd --system --gid app app \
    && mkdir -p /app/storage && chown app:app /app/storage
USER app
# Santé : GET /api/health (à brancher sur la sonde de l'orchestrateur).
EXPOSE 8080
ENTRYPOINT ["dotnet", "TimeSheet.Api.dll"]
