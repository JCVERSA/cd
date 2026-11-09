[CmdletBinding()]
param(
    [switch]$SkipDependencies,
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not $SkipTests) {
    & python -m unittest discover -s tests -v
    if ($LASTEXITCODE -ne 0) { throw 'Python tests failed.' }
}

Push-Location (Join-Path $root 'ui')
try {
    if (-not $SkipDependencies) { & npm ci }
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Frontend type checking failed.' }
    if (-not $SkipTests) {
        & npm test
        if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed.' }
    }
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
}
finally {
    Pop-Location
}

if (-not $SkipDependencies) {
    & python -m pip install --disable-pip-version-check --require-hashes -r requirements-build-lock.txt
    if ($LASTEXITCODE -ne 0) { throw 'Python build dependency installation failed.' }
}

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build, release
& python -m PyInstaller --clean --noconfirm --distpath build --workpath .pyinstaller SwiftSlate.spec
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller build failed.' }

$selfTestLog = Join-Path $env:TEMP 'SwiftSlate-self-test.log'
Remove-Item -Force -ErrorAction SilentlyContinue $selfTestLog
$smoke = Start-Process -FilePath (Join-Path $root 'build\SwiftSlate\SwiftSlate.exe') -ArgumentList '--self-test' -PassThru
if (-not $smoke.WaitForExit(60000)) {
    $smoke.Kill()
    throw 'Packaged SwiftSlate self-test did not exit within 60 seconds.'
}
if ($smoke.ExitCode -ne 0) {
    $detail = Get-Content $selfTestLog -Raw -ErrorAction SilentlyContinue
    throw "Packaged SwiftSlate self-test failed with exit code $($smoke.ExitCode): $detail"
}

$bootstrapper = Join-Path $root 'packaging\MicrosoftEdgeWebview2Setup.exe'
if (-not (Test-Path $bootstrapper)) {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $bootstrapper
}
$signature = Get-AuthenticodeSignature -FilePath $bootstrapper
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft') {
    throw 'The downloaded WebView2 bootstrapper does not have a valid Microsoft signature.'
}

$isccCandidates = @(@(
    $env:ISCC_PATH,
    (Join-Path $env:ProgramFiles 'Inno Setup 7\ISCC.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 7\ISCC.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 7\ISCC.exe')
) | Where-Object { $_ -and (Test-Path $_) })
if ($isccCandidates.Count -eq 0) {
    throw 'Inno Setup 7.1.1 or newer is required (ISCC.exe was not found).'
}

& $isccCandidates[0] (Join-Path $root 'packaging\SwiftSlate.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup compilation failed.' }

$installer = Join-Path $root 'release\SwiftSlate-Setup-x64.exe'
if (-not (Test-Path $installer)) { throw 'The expected installer was not produced.' }
$hash = (Get-FileHash -Algorithm SHA256 -Path $installer).Hash.ToLowerInvariant()
"$hash  SwiftSlate-Setup-x64.exe" | Set-Content -Encoding ascii (Join-Path $root 'release\SwiftSlate-Setup-x64.exe.sha256')
Write-Host "Built $installer" -ForegroundColor Green
Write-Host "SHA-256: $hash" -ForegroundColor Green
