# MCP Server v1.0.0 - 多阶段构建优化的 Dockerfile
# 生产环境构建，支持多架构和性能优化

# ================================
# 基础阶段
# ================================
FROM node:22-slim AS base

# 设置环境变量
ENV NODE_ENV=production \
    PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH \
    DEBIAN_FRONTEND=noninteractive

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    git \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# 安装 pnpm 和 uv
RUN npm install -g pnpm@latest
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 设置工作目录
WORKDIR /app

# ================================
# 依赖安装阶段
# ================================
FROM base AS dependencies

# 复制 package 配置文件（monorepo 结构）
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/

# 设置 pnpm 配置
RUN pnpm config set store-dir /app/.pnpm-store

# 安装依赖
RUN pnpm install --frozen-lockfile --prod=false

# ================================
# 构建阶段
# ================================
FROM dependencies AS builder

# 复制源代码
COPY . .

# 设置构建环境变量
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048"

# 构建前端和后端
RUN pnpm frontend:build && pnpm backend:build

# 下载最新的服务器配置
RUN curl -s -f --connect-timeout 10 --retry 3 \
    https://mcpm.sh/api/servers.json -o servers.json || \
    echo "Failed to download servers.json, using bundled version"

# 优化构建产物
RUN find ./dist -name "*.js" -exec sh -c 'gzip -9 -c "$1" > "$1.gz"' _ {} \;
RUN find ./frontend/dist -name "*.js" -o -name "*.css" | xargs -I {} sh -c 'gzip -9 -c "$1" > "$1.gz"' _ {}

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
ARG NODE_ENV=production

ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    REQUEST_TIMEOUT=$REQUEST_TIMEOUT \
    BASE_PATH=$BASE_PATH \
    READONLY=$READONLY \
    NODE_ENV=$NODE_ENV \
    PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH \
    NODE_OPTIONS="--max-old-space-size=1024 --optimize-for-size"

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

# 创建非 root 用户和组
RUN groupadd -r mcpserver && \
    useradd -r -g mcpserver -s /bin/bash -d /app mcpserver

# 设置工作目录
WORKDIR /app

# 从构建阶段复制必要文件
COPY --from=builder --chown=mcpserver:mcpserver /app/dist ./dist
COPY --from=builder --chown=mcpserver:mcpserver /app/frontend/dist ./frontend/dist
COPY --from=builder --chown=mcpserver:mcpserver /app/package.json ./
COPY --from=builder --chown=mcpserver:mcpserver /app/servers.json ./
COPY --from=builder --chown=mcpserver:mcpserver /app/mcp_settings.json ./
COPY --from=builder --chown=mcpserver:mcpserver /app/locales ./locales
COPY --from=builder --chown=mcpserver:mcpserver /app/bin ./bin

# 安装生产依赖
RUN pnpm install --prod --frozen-lockfile

# 复制启动脚本
COPY --chown=mcpserver:mcpserver entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 创建必要的目录
RUN mkdir -p /app/logs /app/tmp /app/cache && \
    chown -R mcpserver:mcpserver /app/logs /app/tmp /app/cache

# 切换到非 root 用户
USER mcpserver

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 设置入口点和默认命令
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["pnpm", "start"]

# 元数据标签
LABEL maintainer="MCP Server Team" \
      version="1.0.0" \
      description="MCP Server - Model Context Protocol Server Dashboard" \
      org.opencontainers.image.title="MCP Server" \
      org.opencontainers.image.description="Model Context Protocol Server Dashboard" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="MCP Server Project"