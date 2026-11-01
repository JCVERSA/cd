# SwiftSlate legacy source installer compatibility shim.
# The supported distribution is now the signed-style Inno Setup executable produced by
# build_windows.ps1. It bundles Python, pywebview, and all local interface assets.

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$installer = Join-Path $root 'release\SwiftSlate-Setup-x64.exe'

if (-not (Test-Path $installer)) {
    throw @"
SwiftSlate-Setup-x64.exe has not been built in this checkout.

Build it on Windows with:
  powershell -ExecutionPolicy Bypass -File "$root\build_windows.ps1"

Then run this command again, or launch:
  $installer
"@
}

$process = Start-Process -FilePath $installer -Wait -PassThru
exit $process.ExitCode
