# Compatibility helper for older SwiftSlate instructions.
# Provider keys and settings are now managed by the protected local dashboard.

$ErrorActionPreference = 'Stop'
$installed = Join-Path $env:LOCALAPPDATA 'Programs\SwiftSlate\SwiftSlate.exe'
$localBuild = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'build\SwiftSlate\SwiftSlate.exe'
$executable = if (Test-Path $installed) { $installed } elseif (Test-Path $localBuild) { $localBuild } else { $null }

if (-not $executable) {
    throw 'SwiftSlate.exe was not found. Install SwiftSlate-Setup-x64.exe first.'
}

Start-Process -FilePath $executable
Write-Host 'SwiftSlate is running. Double-click its tray icon to open Providers and Settings.' -ForegroundColor Green
