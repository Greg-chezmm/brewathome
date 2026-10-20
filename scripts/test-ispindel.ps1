# Test de l'Edge Function ispindel - BrewAtHome
# Usage : .\test-ispindel.ps1 -Token "<api_token_du_device>"
# Prerequis : supabase start + supabase functions serve ispindel --no-verify-jwt
#             (SANS --env-file pointant vers le projet distant)

param(
    [Parameter(Mandatory=$true)]
    [string]$Token,
    [string]$BaseUrl = "http://127.0.0.1:54321/functions/v1/ispindel"
)

$tmpDir = Join-Path $env:TEMP "ispindel-tests"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

function Post-Case {
    param(
        [string]$Label,
        [string]$Json,
        [string]$Url
    )
    $file = Join-Path $tmpDir "case.json"
    [System.IO.File]::WriteAllText($file, $Json, [System.Text.Encoding]::UTF8)

    Write-Host "`n--- $Label ---" -ForegroundColor Cyan
    curl.exe -s -w " -> HTTP %{http_code}`n" -X POST $Url -H "Content-Type: application/json" --data-binary "@$file"
}

$urlWithToken = "$BaseUrl`?token=$Token"

# --- Cas nominaux ---
Post-Case "1. SG avec unite explicite (attendu: gravity 1.05)" `
    '{"name":"iSpindel","angle":45.2,"temperature":20.5,"temp_units":"C","battery":4.0,"gravity":1.050,"gravity_unit":"G"}' `
    $urlWithToken

Post-Case "2. Plato avec unite explicite (attendu: gravity 1.050 en base, 1.0505 calcule puis arrondi par numeric(5,3))" `
    '{"temperature":20.5,"gravity":12.5,"gravity_unit":"P"}' `
    $urlWithToken

Post-Case "3. SG sans unite, heuristique < 2 (attendu: gravity 1.05)" `
    '{"temperature":20.5,"gravity":1.050}' `
    $urlWithToken

Post-Case "4. Plato sans unite, heuristique >= 2 (attendu: gravity 1.050 en base, 1.0505 calcule puis arrondi par numeric(5,3))" `
    '{"temperature":20.5,"gravity":12.5}' `
    $urlWithToken

Post-Case "5. Gravite a 0, non calibre (attendu: gravity NULL, HTTP 200)" `
    '{"temperature":20.5,"gravity":0,"gravity_unit":"P"}' `
    $urlWithToken

Post-Case "6. Gravite en chaine (attendu: gravity NULL, HTTP 200)" `
    '{"temperature":20.5,"gravity":"1.05","gravity_unit":"G"}' `
    $urlWithToken

Post-Case "7. Temperature en F (attendu: temperature_c = 20.0)" `
    '{"temperature":68,"temp_units":"F","gravity":1.050,"gravity_unit":"G"}' `
    $urlWithToken

# --- Payloads malformes (attendu: HTTP 400 pour les 4) ---
Post-Case "8. Pas du JSON (attendu: 400, Invalid JSON body)" `
    'pas du json' `
    $urlWithToken

Post-Case "9. JSON null (attendu: 400, JSON body must be an object)" `
    'null' `
    $urlWithToken

Post-Case "10. JSON tableau (attendu: 400, JSON body must be an object)" `
    '[1,2,3]' `
    $urlWithToken

Post-Case "11. JSON nombre (attendu: 400, JSON body must be an object)" `
    '42' `
    $urlWithToken

# --- Authentification et methode ---
Write-Host "`n--- 12. Token manquant (attendu: 401, Missing token) ---" -ForegroundColor Cyan
curl.exe -s -w " -> HTTP %{http_code}`n" -X POST $BaseUrl -d '{}'

Write-Host "`n--- 13. Token inconnu (attendu: 401, Unknown device token) ---" -ForegroundColor Cyan
curl.exe -s -w " -> HTTP %{http_code}`n" -X POST "$BaseUrl`?token=mauvais" -d '{}'

Write-Host "`n--- 14. Methode GET (attendu: 405) ---" -ForegroundColor Cyan
curl.exe -s -w " -> HTTP %{http_code}`n" $urlWithToken

Write-Host "`n`nTests termines. Verifie en base avec :" -ForegroundColor Yellow
Write-Host "select recorded_at, gravity, temperature_c, battery_percent, raw_angle"
Write-Host "from fermentation_readings order by recorded_at desc limit 14;"
Write-Host "(remplace recorded_at par le nom exact de la colonne, d'apres src/lib/db/schema.ts)"
