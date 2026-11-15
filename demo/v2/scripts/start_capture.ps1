param([int]$Port=8010)
$ErrorActionPreference='Stop'
Set-Location (Join-Path $PSScriptRoot '../../..')
$capturePath=Join-Path (Get-Location) ('demo/v2/assets/runtime/capture-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $capturePath | Out-Null
$env:DATABASE_URL='sqlite:///'+$capturePath.Replace('\','/')+'/capture.db'
$env:PROTOCOL_STORAGE_DIR=Join-Path $capturePath 'protocols'
$capturePython=(Resolve-Path 'backend/var/venv312/Scripts/python.exe').Path
& $capturePython -m alembic -c backend/alembic.ini upgrade head
if($LASTEXITCODE -ne 0){throw 'Capture migration failed'}
& $capturePython -m backend.app.seed --dataset px104-15
if($LASTEXITCODE -ne 0){throw 'Capture seed failed'}
& $capturePython -m tools.add_demo_patients
if($LASTEXITCODE -ne 0){throw 'Capture import failed'}
$env:CAPTURE_API='http://127.0.0.1:'+$Port
$env:PLAYWRIGHT_BROWSERS_PATH=Join-Path (Get-Location) 'demo/assets/playwright'
$captureProcess=Start-Process -FilePath $capturePython -ArgumentList '-m','uvicorn','backend.app.main:app','--host','127.0.0.1','--port',$Port,'--workers','1' -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $capturePath 'api.stdout.log') -RedirectStandardError (Join-Path $capturePath 'api.stderr.log')
Write-Output "New isolated capture API: $env:CAPTURE_API; PID $($captureProcess.Id). Verify health before recording. Shared database preserved."
