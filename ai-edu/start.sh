#!/bin/bash

# AI通识教育 - 一键启动脚本
# 启动后端 (3001) 和前端 (5173)

set -e

echo "🚀 启动 AI 通识教育平台..."

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 清理已有进程
cleanup() {
    echo "🧹 清理已有进程..."
    if [ -f /tmp/ai-edu-backend.pid ]; then
        kill "$(cat /tmp/ai-edu-backend.pid)" 2>/dev/null || true
        rm -f /tmp/ai-edu-backend.pid
    fi
    if [ -f /tmp/ai-edu-frontend.pid ]; then
        kill "$(cat /tmp/ai-edu-frontend.pid)" 2>/dev/null || true
        rm -f /tmp/ai-edu-frontend.pid
    fi
    pkill -f "vite.*5173" 2>/dev/null || true
    pkill -f "node server.js" 2>/dev/null || true
    sleep 1
}

wait_for_url() {
    local url="$1"
    local attempts="$2"
    local delay="$3"

    for ((i = 1; i <= attempts; i++)); do
        if curl -fsS "$url" >/dev/null 2>&1; then
            return 0
        fi
        sleep "$delay"
    done

    return 1
}

# 先清理已有进程
cleanup

# 启动后端
echo "📦 启动后端服务 (http://localhost:3001)..."
cd "$SCRIPT_DIR/backend"
PORT=3001 node server.js > backend.log 2>&1 &
BACKEND_PID=$!

# 等待后端启动
if wait_for_url "http://localhost:3001/api/health" 15 1; then
    echo "✅ 后端已启动 (PID: $BACKEND_PID)"
else
    echo "❌ 后端启动失败，查看 backend/backend.log"
    exit 1
fi

# 启动前端
echo "🎨 启动前端服务 (http://localhost:5173)..."
cd "$SCRIPT_DIR"
PORT=5173 npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!

sleep 3

if wait_for_url "http://localhost:5173" 15 1; then
    echo "✅ 前端已启动 (PID: $FRONTEND_PID)"
else
    echo "❌ 前端启动失败"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 AI 通识教育平台已启动!"
echo ""
echo "  🌐 前端: http://localhost:5173"
echo "  🔧 后端: http://localhost:3001"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 保存进程ID
echo $BACKEND_PID > /tmp/ai-edu-backend.pid
echo $FRONTEND_PID > /tmp/ai-edu-frontend.pid

# 等待 Ctrl+C
trap "echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f /tmp/ai-edu-*.pid; exit" INT TERM

wait
