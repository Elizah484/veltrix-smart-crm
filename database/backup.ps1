<#
  Veltrix backup (Windows + XAMPP).
  Creates backups\veltrix-YYYYMMDD-HHMM.sql in the project root using mysqldump.

  Run from the project root in PowerShell:
    powershell -ExecutionPolicy Bypass -File database\backup.ps1
  If MySQL does not use port 3306 or XAMPP is installed elsewhere:
    powershell -ExecutionPolicy Bypass -File database\backup.ps1 -Port 3307 -XamppPath "D:\xampp"
#>
param(
  [string]$XamppPath = "C:\xampp",
  [int]$Port = 3306,
  [string]$User = "root",
  [string]$Password = "",
  [string]$Database = "veltrix_db"
)

$dump = Join-Path $XamppPath "mysql\bin\mysqldump.exe"
if (-not (Test-Path $dump)) {
  Write-Host "Cannot find $dump" -ForegroundColor Red
  Write-Host "Use -XamppPath to point at your XAMPP folder, for example: -XamppPath `"D:\xampp`""
  exit 1
}

$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root "backups"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$file = Join-Path $dir ("veltrix-" + (Get-Date -Format "yyyyMMdd-HHmm") + ".sql")

$args = @("--host=127.0.0.1", "--port=$Port", "--user=$User", "--single-transaction", "--routines", "--triggers", "--default-character-set=utf8mb4", "--result-file=$file")
if ($Password -ne "") { $args += "--password=$Password" }
$args += $Database

& $dump @args
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $file) -or (Get-Item $file).Length -eq 0) {
  Write-Host "Backup failed. Is MySQL running in XAMPP, and is the port ($Port) right?" -ForegroundColor Red
  if (Test-Path $file) { Remove-Item $file }
  exit 1
}
Write-Host "Backup saved: $file" -ForegroundColor Green
Write-Host "Backups contain customer data. Keep them somewhere safe and never commit them to Git."
