<#
.SYNOPSIS
  YuE2 Studio installer for Windows 10/11 (x64).

.EXAMPLE
  .\install.cmd                          # auto: CUDA if an NVIDIA GPU is found, else Vulkan
  .\install.cmd -Backend vulkan          # force: cuda | vulkan | cpu
  .\install.cmd -Model q8_0              # q4_0 (default, ~2.5 GB) | q8_0 | bf16
  .\install.cmd -EnginePath C:\audio.cpp\bin\audiocpp_cli.exe -Backend cuda
  .\install.cmd -SkipModel

  Safe to re-run: finished downloads are skipped.
#>
[CmdletBinding()]
param(
    [ValidateSet('auto', 'cuda', 'vulkan', 'cpu')] [string]$Backend = 'auto',
    [string]$EnginePath = '',
    [string]$EngineVersion = 'v0.9.4',
    [ValidateSet('q4_0', 'q8_0', 'bf16')] [string]$Model = 'q4_0',
    [switch]$SkipModel
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest is very slow with the progress bar on

$EngineRepo = 'https://github.com/0xShug0/audio.cpp'
$HfRepo = 'https://huggingface.co/audio-cpp/Yue2-3B-GGUF/resolve/main'
$Root = $PSScriptRoot
$EngineDir = Join-Path $Root 'engine'
$ModelDir = Join-Path $Root 'models\Yue2-3B-GGUF'

function Step($m) { Write-Host ''; Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m) { Write-Host "  ok $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  warning: $m" -ForegroundColor Yellow }
function Die($m) { Write-Host "error: $m" -ForegroundColor Red; exit 1 }
function Have($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Fwd($p) { $p -replace '\\', '/' }   # forward slashes are safe in .env and for Node

# ------------------------------------------------------------------ prerequisites
Step 'Checking prerequisites'
if (-not (Have 'curl.exe')) { Die 'curl.exe not found (ships with Windows 10 1803+). Update Windows.' }
if (-not (Have 'tar.exe')) { Die 'tar.exe not found (ships with Windows 10 1803+). Update Windows.' }

if (-not (Have 'node')) {
    if (Have 'winget') {
        $ans = Read-Host 'Node.js not found. Install Node.js LTS with winget now? [Y/n]'
        if ($ans -eq '' -or $ans -match '^[Yy]') {
            winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
            $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
        }
    }
    if (-not (Have 'node')) { Die 'Install Node.js 22 LTS from https://nodejs.org, open a new terminal, and re-run.' }
}
$nodeVer = (node -p 'process.versions.node').Trim()
$nv = $nodeVer.Split('.') | ForEach-Object { [int]$_ }
$nodeOk = ($nv[0] -eq 20 -and $nv[1] -ge 19) -or ($nv[0] -eq 22 -and $nv[1] -ge 12) -or ($nv[0] -gt 22)
if (-not $nodeOk) { Die "Node $nodeVer is too old. Need 20.19+ or 22.12+." }
Ok "node $nodeVer"

# CUDA 13.x needs NVIDIA driver 580+; older drivers get the CUDA 12.4 build.
$cudaFlavor = $null
if (Have 'nvidia-smi') {
    try {
        $drv = (nvidia-smi --query-gpu=driver_version --format=csv,noheader | Select-Object -First 1).Trim()
        $gpu = (nvidia-smi --query-gpu=name --format=csv,noheader | Select-Object -First 1).Trim()
        $cudaFlavor = if ([double]($drv.Split('.')[0]) -ge 580) { 'cuda13.3' } else { 'cuda12.4' }
        Ok "NVIDIA $gpu, driver $drv"
    } catch { $cudaFlavor = $null }
}
if ($Backend -eq 'auto') {
    if ($EnginePath -or $cudaFlavor) { $Backend = 'cuda' } else { $Backend = 'vulkan' }
    Ok "backend auto-detected: $Backend"
}
if ($Backend -eq 'cuda' -and -not $EnginePath -and -not $cudaFlavor) {
    Die 'CUDA backend needs an NVIDIA GPU with a recent driver (nvidia-smi not found). Use -Backend vulkan.'
}
if ($Backend -eq 'cpu') { Warn 'CPU backend works but a song can take a very long time. An NVIDIA GPU (CUDA) is strongly recommended.' }

# ------------------------------------------------------------------ engine
function Get-ReleaseZip($name, $dest) {
    $dl = Join-Path $EngineDir '_downloads'
    New-Item -ItemType Directory -Force -Path $dl, $dest | Out-Null
    $marker = Join-Path $dl "$name.done"
    if (Test-Path $marker) { Ok "$name (already extracted)"; return }
    $zip = Join-Path $dl $name
    Write-Host "  downloading $name"
    curl.exe -fL --retry 3 -o $zip "$EngineRepo/releases/download/$EngineVersion/$name"
    if ($LASTEXITCODE -ne 0) { Die "download failed: $name" }
    tar.exe -xf $zip -C $dest
    if ($LASTEXITCODE -ne 0) { Expand-Archive -Path $zip -DestinationPath $dest -Force }
    New-Item -ItemType File -Force -Path $marker | Out-Null
    Remove-Item $zip -Force
}

$cli = $null
if ($EnginePath) {
    Step 'Using existing engine'
    if (-not (Test-Path $EnginePath)) { Die "$EnginePath not found" }
    $cli = (Resolve-Path $EnginePath).Path
} else {
    $flavor = if ($Backend -eq 'cuda') { $cudaFlavor } else { $Backend }
    Step "Downloading prebuilt audio.cpp $EngineVersion ($flavor)"
    $dest = Join-Path $EngineDir $flavor
    Get-ReleaseZip "audio-$EngineVersion-bin-windows-x64-$flavor.zip" $dest
    $exe = Get-ChildItem -Path $dest -Recurse -Filter 'audiocpp_cli.exe' | Select-Object -First 1
    if (-not $exe) { Die "audiocpp_cli.exe not found in the $flavor package" }
    $cli = $exe.FullName
    if ($Backend -eq 'cuda') {
        # The CUDA runtime DLLs ship separately and must sit next to the binaries.
        Get-ReleaseZip "audio-$EngineVersion-cudart-windows-x64-$flavor.zip" $exe.DirectoryName
    }
}
Ok $cli
try {
    $ver = & $cli --version 2>$null | Select-Object -First 1
    if ($LASTEXITCODE -eq 0) { Ok "engine runs: $ver" } else { Warn 'engine did not run --version cleanly (missing DLLs or GPU driver?)' }
} catch { Warn "engine failed to start: $_" }

# ------------------------------------------------------------------ model
function Get-File($url, $dest) {
    $remote = $null
    try {
        $h = curl.exe -sIL $url | Select-String -Pattern '^content-length:\s*(\d+)' -AllMatches
        if ($h) { $remote = [int64]$h[-1].Matches[0].Groups[1].Value }
    } catch {}
    if ((Test-Path $dest) -and $remote -and ((Get-Item $dest).Length -eq $remote)) {
        Ok "$(Split-Path $dest -Leaf) (already downloaded)"; return
    }
    Write-Host "  downloading $(Split-Path $dest -Leaf)"
    curl.exe -fL --retry 5 -C - -o $dest $url
    if ($LASTEXITCODE -ne 0) { Die "download failed: $url" }
}

if ($SkipModel) {
    Step 'Skipping model download (-SkipModel)'
} else {
    Step "Downloading YuE2 weights ($Model) to $ModelDir"
    New-Item -ItemType Directory -Force -Path (Join-Path $ModelDir 'sidecars') | Out-Null
    foreach ($f in 'yue2-generation-config.json', 'yue2-model-config.json', 'yue2-qwen.tiktoken', 'yue2-vae-config.json') {
        Get-File "$HfRepo/sidecars/$f" (Join-Path $ModelDir "sidecars\$f")
    }
    Get-File "$HfRepo/yue2-vae-f16.gguf" (Join-Path $ModelDir 'yue2-vae-f16.gguf')
    Get-File "$HfRepo/yue2-3b-$Model.gguf" (Join-Path $ModelDir "yue2-3b-$Model.gguf")
}

# ------------------------------------------------------------------ app
Step 'Installing and building the web app'
Push-Location (Join-Path $Root 'app')
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { Die 'npm ci failed. If better-sqlite3 failed to compile, install "Desktop development with C++" from Visual Studio Build Tools, or use Node 22 LTS (prebuilt binaries).' }
    npm run build
    if ($LASTEXITCODE -ne 0) { Die 'npm run build failed' }
} finally { Pop-Location }

# ------------------------------------------------------------------ config
$envFile = Join-Path $Root '.env'
Step "Writing $envFile"
if (Test-Path $envFile) { Copy-Item $envFile "$envFile.bak" -Force; Warn 'existing .env saved as .env.bak' }
$lines = @(
    "# Written by install.ps1 on $(Get-Date -Format yyyy-MM-dd). Real env vars override these.",
    "AUDIOCPP_CLI=$(Fwd $cli)",
    $(if ($SkipModel) { '# YUE2_MODEL_DIR=C:/path/to/Yue2-3B-GGUF' } else { "YUE2_MODEL_DIR=$(Fwd $ModelDir)" }),
    "YUE2_MODEL_GGUF=yue2-3b-$Model.gguf",
    "YUE2_BACKEND=$Backend",
    'PORT=8000'
)
# UTF-8 without BOM, so Node's .env parser reads the first key correctly.
[IO.File]::WriteAllLines($envFile, $lines, (New-Object Text.UTF8Encoding $false))
Ok 'done'

Write-Host ''
Write-Host 'YuE2 Studio is installed.' -ForegroundColor Green
Write-Host ''
Write-Host 'Start it:   start.cmd        (or: cd app; npm start)'
Write-Host 'Then open:  http://localhost:8000'
Write-Host ''
Write-Host 'Development mode with hot reload:  cd app; npm run dev   (http://localhost:5173)'
