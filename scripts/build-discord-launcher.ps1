$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $compiler)) {
    $compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
if (-not (Test-Path $compiler)) {
    throw "The .NET Framework C# compiler was not found."
}

$source = Join-Path $PSScriptRoot "discord-launcher\Launcher.cs"
$outputDirectory = Join-Path $repoRoot "packages\overlay\dist"
$output = Join-Path $outputDirectory "Ban-Wars-Discord-Launcher.exe"
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

& $compiler /nologo /target:winexe /optimize+ /platform:anycpu `
    /reference:System.Windows.Forms.dll `
    /reference:System.Drawing.dll `
    /reference:System.Web.Extensions.dll `
    "/out:$output" $source
if ($LASTEXITCODE -ne 0) {
    throw "Launcher compilation failed with exit code $LASTEXITCODE."
}

$launcher = Get-Item $output
if ($launcher.Length -ge 10MB) {
    throw "The launcher is $($launcher.Length) bytes, which exceeds Discord's 10 MB limit."
}
Write-Output "Created $($launcher.FullName) ($($launcher.Length) bytes)"
