@echo off
chcp 65001 >nul
echo ============================================
echo   AI Video Canvas - Local Launcher
echo ============================================
echo.

set "ROOT=%~dp0"

echo [1/2] Starting backend server...
start "AI-Video-Canvas-Backend" cmd /c "cd /d "%ROOT%apps\server" && npx tsx src\index.ts"

echo [2/2] Waiting for backend to be ready...
:wait
timeout /t 1 /nobreak >nul
curl -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel% neq 0 (
    echo   Still waiting...
    goto wait
)

echo   Backend is ready!
echo.
echo Opening AI Video Canvas UI...
start "" "%ROOT%hamster AI_ui.html"

echo.
echo ============================================
echo   Backend: http://localhost:3001
echo   UI: file://hamster AI_ui.html
echo ============================================
echo.
echo Press any key to exit this window...
pause >nul
