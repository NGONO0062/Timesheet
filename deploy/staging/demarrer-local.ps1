# Lance TimeSheet sur ce poste, avec l'image de production (docs/staging.md).
# Docker Desktop doit être ouvert. Depuis la racine du projet :
#   powershell -ExecutionPolicy Bypass -File deploy\staging\demarrer-local.ps1
# Ajouter -Demo pour charger les données de démonstration (base vide seulement).
param([switch]$Demo)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot
$compose = @("compose", "-f", "compose.yml", "-f", "compose.local.yml")
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Une commande docker qui échoue arrête le script (PowerShell ne le fait pas seul).
function Docker-Step {
  docker @compose @args
  if ($LASTEXITCODE -ne 0) { throw "Échec de : docker compose $($args -join ' '). Docker Desktop est-il ouvert ? Reste-t-il de la place sur le disque ?" }
}

function Secret([int]$bytes) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return ($b | ForEach-Object { $_.ToString("x2") }) -join ""
}

# Première fois : réglages créés avec des secrets tirés au hasard.
if (-not (Test-Path ".env")) {
  $lines = @(
    'DOMAIN="localhost"',
    "POSTGRES_PASSWORD=`"$(Secret 24)`"",
    "TASKS_SECRET=`"$(Secret 32)`"",
    'SMTP_HOST="mailpit"',
    'SMTP_PORT="1025"',
    'SMTP_USER=""',
    'SMTP_PASSWORD=""',
    'SMTP_FROM="TimeSheet <timesheet@exemple.com>"',
    'ASPNETCORE_ENVIRONMENT="Production"',
    'DEMO_PROFILES="false"',
    'TIMESHEET_NOW=""',
    "SEED_PASSWORD=`"$(Secret 8)`""
  )
  [System.IO.File]::WriteAllText("$PSScriptRoot\.env", ($lines -join "`n") + "`n", $utf8)
  Write-Host "Réglages créés : deploy\staging\.env"
}

# Données de démonstration : environnement « Staging » (la production refuse les comptes
# fictifs), horloge du 19 mars 2026 et profils sur l'écran de connexion.
if ($Demo) {
  $text = [System.IO.File]::ReadAllText("$PSScriptRoot\.env")
  $text = $text -replace '(?m)^DEMO_PROFILES=.*$', 'DEMO_PROFILES="true"' -replace '(?m)^TIMESHEET_NOW=.*$', 'TIMESHEET_NOW="2026-03-19T09:42:00Z"' -replace '(?m)^ASPNETCORE_ENVIRONMENT=.*$', 'ASPNETCORE_ENVIRONMENT="Staging"'
  [System.IO.File]::WriteAllText("$PSScriptRoot\.env", $text, $utf8)
}

Write-Host "Construction de l'application (longue la première fois)..."
Docker-Step build app
Write-Host "Base de données..."
Docker-Step up -d db mailpit
# « --seed » applique les migrations puis charge la démonstration ; sinon, les migrations
# s'appliquent au démarrage de l'application.
if ($Demo) { Docker-Step run --rm app --seed }
Docker-Step up -d app taches

Write-Host ""
Write-Host "TimeSheet : http://localhost:3000"
Write-Host "E-mails envoyés par l'application : http://localhost:8025"
Write-Host "Premier compte (base vide) : docker compose -f deploy\staging\compose.yml -f deploy\staging\compose.local.yml run --rm app --admin-plateforme adresse `"Prénom`" `"Nom`""
Write-Host "Arrêter : docker compose -f deploy\staging\compose.yml -f deploy\staging\compose.local.yml stop"
