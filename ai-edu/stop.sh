#!/bin/bash

# AI通识教育 - 一键停止脚本

echo "🛑 停止 AI 通识教育平台..."

# 读取保存的进程ID
if [ -f /tmp/ai-edu-backend.pid ]; then
    BACKEND_PID=$(cat /tmp/ai-edu-backend.pid)
    kill $BACKEND_PID 2>/dev/null && echo "✅ 后端已停止" || echo "⚠️ 后端进程不存在"
    rm -f /tmp/ai-edu-backend.pid
fi

if [ -f /tmp/ai-edu-frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/ai-edu-frontend.pid)
    kill $FRONTEND_PID 2>/dev/null && echo "✅ 前端已停止" || echo "⚠️ 前端进程不存在"
    rm -f /tmp/ai-edu-frontend.pid
fi

# 清理残留进程
pkill -f "vite" 2>/dev/null && echo "✅ Vite进程已清理" || true
pkill -f "node.*backend" 2>/dev/null && echo "✅ Backend进程已清理" || true

echo "👋 已完成停止"