@echo off
chcp 65001 >nul
echo ========================================
echo    AI 通识教育 - 全套编译脚本
echo ========================================
echo.

:menu
echo 请选择操作:
echo   1. 开发模式 (前端 + 后端 同时运行)
echo   2. 仅编译前端 (生成 dist/)
echo   3. 仅启动后端
echo   4. 生产模式 (构建 + 运行后端)
echo   5. 退出
echo.
set /p choice=请输入选项 (1-5):

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto build
if "%choice%"=="3" goto backend-only
if "%choice%"=="4" goto production
if "%choice%"=="5" goto end

:dev
echo.
echo [1] 启动开发模式...
echo.
echo 提示: 将打开两个终端窗口
echo   - 窗口1: 前端开发服务器 (http://localhost:5173)
echo   - 窗口2: 后端API服务器 (http://localhost:3001)
echo.
start "AI Edu Frontend" cmd /c "title AI Edu Frontend && cd /d %~dp0 && echo [前端] 正在启动 Vite 开发服务器... && npm run dev && pause"
timeout /t 2 >nul
start "AI Edu Backend" cmd /c "title AI Edu Backend && cd /d %~dp0backend && echo [后端] 正在启动 Express 服务器... && npm run dev && pause"
echo.
echo 正在启动服务，请稍候...
echo.
echo 访问地址:
echo   前端: http://localhost:5173
echo   后端API: http://localhost:3001
echo.
echo 按任意键打开浏览器...
pause >nul
start http://localhost:5173
goto end

:build
echo.
echo [2] 编译前端...
echo.
cd /d %~dp0
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [错误] 前端编译失败!
    pause
    goto end
)
echo.
echo [成功] 前端编译完成!
echo.
echo 输出目录: %~dp0dist
echo.
dir /b /ad "%~dp0dist" 2>nul | findstr /r "." >nul && (
    echo 编译产物:
    for /d %%i in ("%~dp0dist\*") do echo   - %%~nxi/
    for %%i in ("%~dp0dist\*") do echo   - %%~nxi
) || echo   (dist目录为空或不存在)
echo.
pause
goto end

:backend-only
echo.
echo [3] 启动后端服务器...
echo.
cd /d %~dp0backend
call npm start
goto end

:production
echo.
echo [4] 生产模式构建...
echo.
cd /d %~dp0
echo.
echo [步骤1/2] 编译前端...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [错误] 前端编译失败!
    pause
    goto end
)
echo.
echo [成功] 前端编译完成!
echo.
echo [步骤2/2] 启动后端服务器...
echo.
echo 提示: 生产模式使用 npm start (不自动重启)
echo.
cd /d %~dp0backend
call npm start
goto end

:end
echo.
echo ========================================
echo    脚本执行完毕
echo ========================================
pause
