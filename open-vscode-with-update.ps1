# 每次打开 VSCode 前自动更新 Claude Code
Write-Host "Checking Claude Code updates..." -ForegroundColor Cyan
winget upgrade Anthropic.ClaudeCode --accept-package-agreements --silent 2>&1 | Out-Null

$exitCode = $LASTEXITCODE
if ($exitCode -eq 0) {
    Write-Host "Claude Code is up to date." -ForegroundColor Green
} else {
    Write-Host "Update check done (exit code: $exitCode)." -ForegroundColor Yellow
}

# 启动 VSCode 并打开当前项目
code "c:\Users\ZhuanZ\Desktop\board"
