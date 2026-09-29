# One-off diagnostic for the terminal problems: lists leaked shell/node processes
# and the console settings that break command output capture.
# Run: pwsh -File scripts/term-diag.ps1   (or: powershell -File scripts/term-diag.ps1)
param([switch]$Quiet)
$ErrorActionPreference = 'Continue'
$out = Join-Path (Split-Path -Parent $PSScriptRoot) 'term-diag-out.txt'
$lines = @()
function Try-Add([string]$label, [scriptblock]$block) {
  try { $lines += ("{0}: {1}" -f $label, (& $block)) }
  catch { $lines += ("{0}: <error: {1}>" -f $label, $_.Exception.Message) }
}


try { $lines += "=== PowerShell ===" } catch {}

Try-Add 'PSVersion'      { $PSVersionTable.PSVersion.ToString() }
Try-Add 'OutputEncoding' { [Console]::OutputEncoding.WebName }
Try-Add 'InputEncoding'  { [Console]::InputEncoding.WebName }
Try-Add 'chcp'           { (chcp) -join ' ' }
Try-Add 'ConsoleSize'    { "$([Console]::WindowWidth)x$([Console]::WindowHeight)" }

$lines += ""
$lines += "=== Console registry (HKCU:\Console) ==="
$reg = Get-ItemProperty 'HKCU:\Console' -ErrorAction SilentlyContinue
foreach ($k in @('CodePage', 'FaceName', 'VirtualTerminalLevel', 'QuickEdit', 'InsertMode', 'LineWrap')) {
  $v = $null
  if ($reg) { $v = $reg.$k }
  $lines += "$k = $v"
}

$lines += ""
$lines += "=== PowerShell profile ==="
$lines += "PROFILE path: $PROFILE"
$lines += "exists: $(Test-Path $PROFILE)"

$lines += ""
$lines += "=== PSReadLine (prompt editing - mangled commands come from here) ==="
Try-Add 'PSReadLine installed' {
  $m = Get-Module -ListAvailable -Name PSReadLine
  if ($m) { "yes, version $($m[0].Version)" } else { 'NO' }
}

$lines += ""
$lines += "=== Git line-ending config ==="
foreach ($k in @('core.autocrlf', 'core.safecrlf', 'core.eol', 'core.pager')) {
  $v = (git config --get $k 2>$null)
  $lines += "$k = $(if ($v) { $v } else { '<unset>' })"
}

$lines += ""
$lines += "=== Running shells / node (leaked processes) ==="
try {
  $procs = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -in @('powershell.exe', 'pwsh.exe', 'node.exe', 'cmd.exe') } |
    Sort-Object CreationDate)
  $lines += "total: $($procs.Count)"
  foreach ($p in $procs) {
    $age = 0
    try { $age = [int]((Get-Date) - $p.CreationDate).TotalMinutes } catch {}
    $cmd = ''
    try { $cmd = ($p.CommandLine -replace '\s+', ' ').Trim() } catch {}
    if ($cmd.Length -gt 80) { $cmd = $cmd.Substring(0, 80) + '...' }
    $lines += ("{0,-10} pid={1,-6} parent={2,-6} age={3,5}m  {4}" -f $p.Name.Replace('.exe', ''), $p.ProcessId, $p.ParentProcessId, $age, $cmd)
  }
} catch {
  $lines += "process listing failed: $($_.Exception.Message)"
}

$lines | Out-File -FilePath $out -Encoding utf8
if (-not $Quiet) { Write-Host "wrote $out ($($lines.Count) lines)" }

