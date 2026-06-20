# AI Edu Docker 部署说明

## 1. 上传部署包

把整个 `deploy-package` 目录上传到服务器，例如 `/opt/ai-edu/deploy-package`。

## 2. 配置环境变量

在服务器部署目录执行：

```bash
cp .env.example .env
```

然后编辑 `.env`，至少设置：

```env
JWT_SECRET=请替换为32位以上随机字符串
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=请替换为强密码
DEFAULT_ADMIN_DISPLAY_NAME=系统管理员
ALLOWED_ORIGINS=http://你的域名或服务器IP
```

如果要启用 Cloudflare Turnstile，再设置：

```env
TURNSTILE_SITE_KEY=你的站点Key
TURNSTILE_SECRET_KEY=你的SecretKey
```

注册开关和人机验证开关也可以登录管理员后台后在“系统管理 -> 系统设置”里调整。

## 3. 导入镜像

```bash
docker load -i ai-edu-backend.tar
docker load -i ai-edu-frontend.tar
```

## 4. 启动服务

```bash
docker compose up -d
```

默认端口：

```text
前端: 80
后端: 3001
```

如果要改端口，在 `.env` 中设置：

```env
FRONTEND_PORT=80
BACKEND_PORT=3001
```

## 5. 验证

```bash
docker compose ps
curl -f http://localhost:3001/api/health
curl -f http://localhost/api/settings/public
```

## 6. 默认管理员

如果数据库里没有任何管理员，后端首次启动会自动创建 `.env` 中的默认管理员。

创建后请尽快登录系统修改密码或创建新的管理员账号。
