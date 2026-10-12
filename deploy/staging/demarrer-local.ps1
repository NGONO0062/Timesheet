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
    "AUTH_SECRET=`"$(Secret 32)`"",
    "TASKS_SECRET=`"$(Secret 32)`"",
    'SMTP_HOST="mailpit"',
    'SMTP_PORT="1025"',
    'SMTP_USER=""',
    'SMTP_PASSWORD=""',
    'SMTP_FROM="TimeSheet <timesheet@exemple.com>"',
    'DEMO_PROFILES="false"',
    'TIMESHEET_NOW=""',
    "SEED_PASSWORD=`"$(Secret 8)`""
  )
  [System.IO.File]::WriteAllText("$PSScriptRoot\.env", ($lines -join "`n") + "`n", $utf8)
  Write-Host "Réglages créés : deploy\staging\.env"
}

# Données de démonstration : horloge du 19 mars 2026 et profils sur l'écran de connexion.
if ($Demo) {
  $text = [System.IO.File]::ReadAllText("$PSScriptRoot\.env")
  $text = $text -replace '(?m)^DEMO_PROFILES=.*$', 'DEMO_PROFILES="true"' -replace '(?m)^TIMESHEET_NOW=.*$', 'TIMESHEET_NOW="2026-03-19T09:42:00Z"'
  [System.IO.File]::WriteAllText("$PSScriptRoot\.env", $text, $utf8)
}

Write-Host "Construction de l'application (longue la première fois)..."
Docker-Step --profile outils build
Write-Host "Base de données..."
Docker-Step up -d db mailpit
Docker-Step run --rm outils npx prisma migrate deploy
if ($Demo) { Docker-Step run --rm outils npx prisma db seed }
Docker-Step up -d app taches

Write-Host ""
Write-Host "TimeSheet : http://localhost:3000"
Write-Host "E-mails envoyés par l'application : http://localhost:8025"
Write-Host "Arrêter : docker compose -f deploy\staging\compose.yml -f deploy\staging\compose.local.yml stop"
