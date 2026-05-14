#!/bin/bash

# ========================================
#    AI 通识教育 - 一键编译脚本
# ========================================

echo "========================================"
echo "   AI 通识教育 - 一键编译脚本"
echo "========================================"
echo ""

show_menu() {
    echo "请选择操作:"
    echo "  1. 开发模式 (前端 + 后端 同时运行)"
    echo "  2. 仅编译前端 (生成 dist/)"
    echo "  3. 仅启动后端"
    echo "  4. 生产模式 (构建 + 运行后端)"
    echo "  5. 退出"
    echo ""
}

build_frontend() {
    echo ""
    echo "[2] 编译前端..."
    echo ""
    npm run build
    if [ $? -ne 0 ]; then
        echo ""
        echo "[错误] 前端编译失败!"
        return 1
    fi
    echo ""
    echo "[成功] 前端编译完成!"
    echo ""
    echo "输出目录: $(pwd)/dist"
    echo ""
    return 0
}

start_backend() {
    echo ""
    echo "[后端] 正在启动 Express 服务器..."
    echo ""
    cd backend
    npm start
}

production_mode() {
    echo ""
    echo "[4] 生产模式构建..."
    echo ""
    echo "[步骤1/2] 编译前端..."
    build_frontend
    if [ $? -ne 0 ]; then
        return 1
    fi
    echo ""
    echo "[步骤2/2] 启动后端服务器..."
    echo ""
    echo "提示: 生产模式使用 npm start (不自动重启)"
    echo ""
    start_backend
}

dev_mode() {
    echo ""
    echo "[1] 启动开发模式..."
    echo ""
    echo "提示: 将打开两个终端窗口"
    echo "  - 终端1: 前端开发服务器 (http://localhost:5173)"
    echo "  - 终端2: 后端API服务器 (http://localhost:3001)"
    echo ""

    # 启动后端
    echo "[后端] 正在启动 Express 服务器 (nodemon)..."
    cd backend && npm run dev &
    BACKEND_PID=$!

    # 等待后端启动
    sleep 2

    # 启动前端
    echo ""
    echo "[前端] 正在启动 Vite 开发服务器..."
    npm run dev

    # 清理进程
    kill $BACKEND_PID 2>/dev/null
}

# 主循环
while true; do
    show_menu
    read -p "请输入选项 (1-5): " choice

    case $choice in
        1) dev_mode ;;
        2) build_frontend; echo ""; read -p "按 Enter 键继续..." ;;
        3) start_backend ;;
        4) production_mode ;;
        5) echo ""; echo "退出脚本"; exit 0 ;;
        *) echo ""; echo "无效选项，请重新选择"; echo "" ;;
    esac
done
