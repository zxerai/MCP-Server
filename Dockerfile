# MCPHub v1.0.0 - 多阶段构建优化的 Dockerfile
FROM node:22-slim AS base

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    git \
    python3 \
    python3-pip \
    python3-venv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 安装 pnpm 和 uv
RUN npm install -g pnpm
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 设置工作目录
WORKDIR /app

# ================================
# 依赖安装阶段
# ================================
FROM base AS dependencies

# 复制 package 配置文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/

# 安装依赖
RUN pnpm install --frozen-lockfile

# ================================
# 构建阶段
# ================================
FROM dependencies AS builder

# 复制源代码
COPY . .

# 构建前端和后端
RUN pnpm frontend:build && pnpm backend:build

# 下载最新的服务器配置
RUN curl -s -f --connect-timeout 10 https://mcpm.sh/api/servers.json -o servers.json || \
    echo "Failed to download servers.json, using bundled version"

# ================================
# 生产运行时阶段
# ================================
FROM base AS runtime

# 设置环境变量
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ARG REQUEST_TIMEOUT=60000
ARG BASE_PATH=""
ARG READONLY=false
ARG INSTALL_EXT=false

ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    REQUEST_TIMEOUT=$REQUEST_TIMEOUT \
    BASE_PATH=$BASE_PATH \
    READONLY=$READONLY \
    NODE_ENV=production \
    PNPM_HOME=/usr/local/share/pnpm \
    PATH=$PNPM_HOME:$PATH

# 创建 pnpm 目录并安装全局 MCP 服务器
RUN mkdir -p $PNPM_HOME && \
    pnpm add -g \
    @amap/amap-maps-mcp-server \
    @playwright/mcp@latest \
    tavily-mcp@latest \
    @modelcontextprotocol/server-github \
    @modelcontextprotocol/server-slack

# 安装扩展工具（可选）
RUN if [ "$INSTALL_EXT" = "true" ]; then \
        ARCH=$(uname -m); \
        if [ "$ARCH" = "x86_64" ]; then \
            npx -y playwright install --with-deps chrome; \
        else \
            echo "Skipping Chrome installation on non-amd64 architecture: $ARCH"; \
        fi; \
    fi

# 安装 Python MCP 工具
RUN uv tool install mcp-server-fetch

# 创建非 root 用户
RUN groupadd -r mcphub && useradd -r -g mcphub mcphub

# 设置工作目录
WORKDIR /app

# 从构建阶段复制必要文件
COPY --from=builder --chown=mcphub:mcphub /app/dist ./dist
COPY --from=builder --chown=mcphub:mcphub /app/frontend/dist ./frontend/dist
COPY --from=builder --chown=mcphub:mcphub /app/package.json ./
COPY --from=builder --chown=mcphub:mcphub /app/servers.json ./
COPY --from=builder --chown=mcphub:mcphub /app/mcp_settings.json ./
COPY --from=builder --chown=mcphub:mcphub /app/locales ./locales
COPY --from=builder --chown=mcphub:mcphub /app/bin ./bin

# 安装生产依赖
RUN pnpm install --prod --frozen-lockfile

# 复制启动脚本
COPY --chown=mcphub:mcphub entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 切换到非 root 用户
USER mcphub

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 设置入口点和默认命令
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["pnpm", "start"]