# Kills the leaked `-noexit` PowerShell shells that pile up and make the terminal
# hang / swallow command output. Skips the shell that runs this script, its
# parent, and anything younger than $MinAgeMinutes so a live session is never
# killed by accident.
#
# Run:  powershell -ExecutionPolicy Bypass -File scripts\cleanup-shells.ps1
#       powershell -ExecutionPolicy Bypass -File scripts\cleanup-shells.ps1 -WhatIf
param(
  [int]$MinAgeMinutes = 10,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Continue'
$self = $PID
$parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$self" -ErrorAction SilentlyContinue).ParentProcessId

# Only these exact shapes are leaked tool shells. A normal user-launched console
# has no -NoExit/-noexit and is never touched.
$targets = @(
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.ProcessId -ne $self -and
      $_.ProcessId -ne $parentPid -and
      $_.CommandLine -match '(-noexit|-NoExit)' -and
      $_.CommandLine -match '(chcp|try \{)' -and
      $_.CommandLine -notmatch 'cleanup-shells' -and
      ((Get-Date) - $_.CreationDate).TotalMinutes -gt $MinAgeMinutes
    }
)

if ($targets.Count -eq 0) {
  Write-Host "No leaked shells to clean (nothing older than ${MinAgeMinutes}m)."
  exit 0
}

Write-Host "Found $($targets.Count) leaked shell(s) older than ${MinAgeMinutes}m:"
foreach ($t in $targets) {
  $age = [int]((Get-Date) - $t.CreationDate).TotalMinutes
  Write-Host ("  pid={0,-6} age={1,5}m" -f $t.ProcessId, $age)
}

if ($WhatIf) {
  Write-Host "`n-WhatIf: nothing was killed. Re-run without -WhatIf to clean up."
  exit 0
}

$killed = 0
foreach ($t in $targets) {
  try {
    Stop-Process -Id $t.ProcessId -Force -ErrorAction Stop
    $killed++
  } catch {
    Write-Warning "could not stop pid $($t.ProcessId): $($_.Exception.Message)"
  }
}

Write-Host "`nStopped $killed of $($targets.Count) leaked shell(s). The terminal should behave normally now."
Write-Host "Tip: a fresh VS Code window re-spawns the shell; the leaks come from tool sessions that were never closed."
