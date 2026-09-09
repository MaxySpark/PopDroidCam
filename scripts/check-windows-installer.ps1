$ErrorActionPreference = "Stop"

$package = Get-Content -Raw -LiteralPath "package.json" | ConvertFrom-Json
$installer = Resolve-Path -LiteralPath "release\PopDroidCam Setup $($package.version).exe"
$tempDirectory = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [System.IO.Path]::GetTempPath() }
$installDirectory = Join-Path $tempDirectory "popdroidcam-installer-test"
$shim = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\popdroidcam.cmd"

try {
    $install = Start-Process -FilePath $installer -ArgumentList "/S", "/D=$installDirectory" -Wait -PassThru
    if ($install.ExitCode -ne 0) {
        throw "Installer failed with exit code $($install.ExitCode)."
    }
    if (-not (Test-Path -LiteralPath $shim)) {
        throw "The popdroidcam command shim was not installed."
    }

    $output = & cmd.exe /d /c "`"$shim`" help"
    $outputText = $output -join "`n"
    if ($LASTEXITCODE -ne 0 -or $outputText -notmatch "Usage: popdroidcam") {
        throw "The installed popdroidcam help command failed."
    }
} finally {
    $uninstaller = Join-Path $installDirectory "Uninstall PopDroidCam.exe"
    if (Test-Path -LiteralPath $uninstaller) {
        $uninstall = Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -PassThru
        if ($uninstall.ExitCode -ne 0) {
            throw "Uninstaller failed with exit code $($uninstall.ExitCode)."
        }
    }
}

if (Test-Path -LiteralPath $shim) {
    throw "The popdroidcam command shim remained after uninstall."
}
