@echo off
title FlashVision Firebase Reauthorization and Deploy
echo ======================================================================
echo   FlashVision ERP - Firebase Live Hosting Deployer
echo ======================================================================
echo.
cd /d "%~dp0"
echo [1/3] Reauthorizing Firebase with your Google Account...
echo (A browser window will open. Please select your Google account and click Allow)
echo.
call firebase login --reauth
echo.
echo [2/3] Compiling production build (npm run build)...
echo.
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed! Aborting deployment.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo [3/3] Deploying latest build to https://flashvision-erp.web.app...
echo.
call firebase deploy --only hosting
echo.
echo ======================================================================
echo   DEPLOYMENT FINISHED!
echo   Latest live app: https://flashvision-erp.web.app
echo ======================================================================
pause
