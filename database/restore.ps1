<#
  Veltrix restore (Windows + XAMPP). REPLACES the current contents of veltrix_db.

  Run from the project root in PowerShell:
    powershell -ExecutionPolicy Bypass -File database\restore.ps1 -File backups\veltrix-20261014-0930.sql
  Options: -Port 3307  -XamppPath "D:\xampp"
#>
param(
  [Parameter(Mandatory = $true)][string]$File,
  [string]$XamppPath = "C:\xampp",
  [int]$Port = 3306,
  [string]$User = "root",
  [string]$Password = "",
  [string]$Database = "veltrix_db"
)

$mysql = Join-Path $XamppPath "mysql\bin\mysql.exe"
if (-not (Test-Path $mysql)) { Write-Host "Cannot find $mysql. Use -XamppPath." -ForegroundColor Red; exit 1 }
if (-not (Test-Path $File)) { Write-Host "Backup file not found: $File" -ForegroundColor Red; exit 1 }

Write-Host "This will ERASE the current data in '$Database' and replace it with:" -ForegroundColor Yellow
Write-Host "  $File"
$answer = Read-Host "Type RESTORE to continue"
if ($answer -ne "RESTORE") { Write-Host "Cancelled. Nothing was changed."; exit 0 }

$full = (Resolve-Path $File).Path
$passArg = ""
if ($Password -ne "") { $passArg = "--password=$Password" }

# PowerShell cannot use '<' to feed a file, so cmd.exe does it
$cmd = "`"$mysql`" --host=127.0.0.1 --port=$Port --user=$User $passArg --default-character-set=utf8mb4 -e `"DROP DATABASE IF EXISTS $Database; CREATE DATABASE $Database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`""
cmd /c $cmd
if ($LASTEXITCODE -ne 0) { Write-Host "Could not reset the database. Is MySQL running on port $Port?" -ForegroundColor Red; exit 1 }

$cmd2 = "`"$mysql`" --host=127.0.0.1 --port=$Port --user=$User $passArg --default-character-set=utf8mb4 $Database < `"$full`""
cmd /c $cmd2
if ($LASTEXITCODE -ne 0) { Write-Host "Restore failed. The database may be empty; import schema.sql and try again." -ForegroundColor Red; exit 1 }
Write-Host "Restore finished." -ForegroundColor Green
