#!/bin/bash

# MCP Server v1.0.0 启动脚本
# 生产环境优化配置

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必要的环境变量
check_environment() {
    log_info "Checking environment configuration..."
    
    # 设置默认值
    export NPM_REGISTRY=${NPM_REGISTRY:-https://registry.npmjs.org/}
    export REQUEST_TIMEOUT=${REQUEST_TIMEOUT:-60000}
    export BASE_PATH=${BASE_PATH:-}
    export READONLY=${READONLY:-false}
    export TZ=${TZ:-Asia/Shanghai}
    
    log_success "Environment variables configured"
}

# 配置 NPM
configure_npm() {
    log_info "Configuring NPM registry: ${NPM_REGISTRY}"
    
    # 设置 NPM 配置
    npm config set registry "$NPM_REGISTRY"
    npm config set fetch-retries 3
    npm config set fetch-retry-mintimeout 5000
    npm config set fetch-retry-maxtimeout 60000
    
    # 配置代理
    if [ -n "$HTTP_PROXY" ]; then
        log_info "Setting HTTP proxy: ${HTTP_PROXY}"
        npm config set proxy "$HTTP_PROXY"
        export HTTP_PROXY="$HTTP_PROXY"
    fi

    if [ -n "$HTTPS_PROXY" ]; then
        log_info "Setting HTTPS proxy: ${HTTPS_PROXY}"
        npm config set https-proxy "$HTTPS_PROXY"
        export HTTPS_PROXY="$HTTPS_PROXY"
    fi
    
    log_success "NPM configuration completed"
}

# 配置 pnpm
configure_pnpm() {
    log_info "Configuring pnpm..."
    
    # 设置 pnpm 配置
    pnpm config set store-dir /app/.pnpm-store
    pnpm config set registry "$NPM_REGISTRY"
    
    if [ -n "$HTTP_PROXY" ]; then
        pnpm config set proxy "$HTTP_PROXY"
    fi
    
    if [ -n "$HTTPS_PROXY" ]; then
        pnpm config set https-proxy "$HTTPS_PROXY"
    fi
    
    log_success "pnpm configuration completed"
}

# 检查依赖
check_dependencies() {
    log_info "Checking dependencies..."
    
    if [ ! -d "node_modules" ] || [ ! -f "package.json" ]; then
        log_warning "Dependencies not found, installing..."
        pnpm install --prod --frozen-lockfile
    fi
    
    log_success "Dependencies check completed"
}

# 创建必要目录
create_directories() {
    log_info "Creating necessary directories..."
    
    mkdir -p /app/logs /app/tmp /app/cache /app/.pnpm-store
    
    # 设置权限
    chown -R mcpserver:mcpserver /app/logs /app/tmp /app/cache /app/.pnpm-store
    
    log_success "Directories created and permissions set"
}

# 健康检查
health_check() {
    log_info "Performing health check..."
    
    # 检查端口是否被占用
    if netstat -tuln | grep -q ":3000 "; then
        log_error "Port 3000 is already in use"
        exit 1
    fi
    
    log_success "Health check passed"
}

# 显示配置信息
show_config() {
    log_info "Configuration summary:"
    echo "  - NPM Registry: $NPM_REGISTRY"
    echo "  - Request Timeout: $REQUEST_TIMEOUT ms"
    echo "  - Base Path: ${BASE_PATH:-/}"
    echo "  - Readonly Mode: $READONLY"
    echo "  - Timezone: $TZ"
    echo "  - HTTP Proxy: ${HTTP_PROXY:-none}"
    echo "  - HTTPS Proxy: ${HTTPS_PROXY:-none}"
    echo "  - Node Environment: $NODE_ENV"
}

# 主函数
main() {
    log_info "Starting MCP Server v1.0.0..."
    
    # 检查环境
    check_environment
    
    # 配置 NPM
    configure_npm
    
    # 配置 pnpm
    configure_pnpm
    
    # 检查依赖
    check_dependencies
    
    # 创建目录
    create_directories
    
    # 健康检查
    health_check
    
    # 显示配置
    show_config
    
    log_success "MCP Server startup configuration completed"
    log_info "Using REQUEST_TIMEOUT: $REQUEST_TIMEOUT"
    
    # 执行传入的命令
    exec "$@"
}

# 捕获信号
trap 'log_info "Received signal, shutting down..."; exit 0' SIGTERM SIGINT

# 运行主函数
main "$@"
