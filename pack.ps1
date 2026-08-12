Write-Host "Building frontend assets..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit $LASTEXITCODE
}

Write-Host "Creating deployment package..." -ForegroundColor Cyan
if (Test-Path watchparty-deploy.zip) {
    Remove-Item watchparty-deploy.zip -Force
}

Compress-Archive -Path dist, server.js, package.json, package-lock.json, firebase-service-account.json -DestinationPath watchparty-deploy.zip -Force
Write-Host "Successfully packaged to watchparty-deploy.zip!" -ForegroundColor Green
