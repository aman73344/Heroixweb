# Fixes the real cause of the terminal problems: PowerShell's console encoding
# does not match the console code page.
#
# Symptom: commands RUN fine (correct output, exit code 0) but the IDE reports
# failure / "output could not be captured", and non-ASCII characters such as
# stars or emoji come out as mojibake ("4.8a~").
#
# Cause: the console code page is 65001 (UTF-8) but PowerShell still reports
# IBM437 for [Console]::OutputEncoding, so text written to the console is
# encoded in a code page that cannot represent the characters being sent.
# This runs in BOTH PowerShell 5.1 and 7+.
#
# Usage (from an ordinary terminal, not through an agent):
#   powershell -ExecutionPolicy Bypass -File scripts\fix-encoding.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\fix-encoding.ps1 -Persist
param(
  # Also set UTF-8 in the console registry so new terminals start correct.
  [switch]$Persist
)

$ErrorActionPreference = 'Continue'

Write-Host "BEFORE"
Write-Host "  PSVersion        : $($PSVersionTable.PSVersion)"
Write-Host "  OutputEncoding   : $([Console]::OutputEncoding.WebName)"
Write-Host "  InputEncoding    : $([Console]::InputEncoding.WebName)"

# Force UTF-8 everywhere PowerShell renders or reads text.
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[Console]::InputEncoding  = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$global:OutputEncoding = $utf8NoBom

# Switch the console itself to the UTF-8 code page so the window agrees.
try { $null = & "$env:SystemRoot\System32\chcp.com" 65001 } catch {}

Write-Host "AFTER"
Write-Host "  OutputEncoding   : $([Console]::OutputEncoding.WebName)"
Write-Host "  InputEncoding    : $([Console]::InputEncoding.WebName)"

if ($Persist) {
  try {
    # Per-console defaults apply to newly created windows.
    Set-ItemProperty 'HKCU:\Console' -Name 'CodePage' -Value '65001' -Type DWord -ErrorAction Stop
    Write-Host "  registry CodePage : 65001 (persisted for new terminals)"
  } catch {
    Write-Warning "  could not write HKCU:\Console CodePage: $($_.Exception.Message)"
  }
}

# Persist the fix for every future PowerShell session. Without this the
# encoding reverts to IBM437 the next time a terminal opens.
$profilePath = $PROFILE.CurrentUserAllHosts
$profileDir = Split-Path -Parent $profilePath

try {
  if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
  }

  $block = @'

# --- UTF-8 console (fixes mojibake and lost command output) ---
try {
  $__utf8 = New-Object System.Text.UTF8Encoding $false
  [Console]::InputEncoding  = $__utf8
  [Console]::OutputEncoding = $__utf8
  $OutputEncoding = $__utf8
  $global:OutputEncoding = $__utf8
} catch { }
'@

  $existing = if (Test-Path $profilePath) { Get-Content -Raw $profilePath } else { '' }
  if ($existing -notmatch 'OutputEncoding = \$__utf8') {
    Add-Content -Path $profilePath -Value $block -Encoding UTF8
    Write-Host "  profile           : updated $profilePath"
  } else {
    Write-Host "  profile           : already set"
  }
} catch {
  Write-Warning "  could not update profile: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Done. Open a NEW terminal for the profile change to take effect."
Write-Host "Test with:  Write-Output ([Console]::OutputEncoding.WebName)   ->  expect utf-8"
