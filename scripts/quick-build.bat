@echo off
chcp 65001 >nul
echo ========================================
echo    AI 通识教育 - 快速编译
echo ========================================
echo.

cd /d %~dp0

echo [1/2] 编译前端...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [错误] 前端编译失败!
    pause
    exit /b 1
)

echo.
echo [2/2] 启动后端服务...
echo.
cd backend
call npm start
