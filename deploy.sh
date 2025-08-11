#!/bin/bash

# MCP Server v1.0.0 快速部署脚本
# 支持生产环境和开发环境部署

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_NAME="MCP Server"
VERSION="1.0.0"
DEFAULT_ENV="production"

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

# 显示帮助信息
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV       部署环境 (production|development|all) [默认: $DEFAULT_ENV]"
    echo "  -p, --profile PROFILE  Docker Compose profile (nginx|redis|postgres|monitoring)"
    echo "  -f, --force         强制重新构建"
    echo "  -c, --clean         清理旧容器和镜像"
    echo "  -l, --logs          显示日志"
    echo "  -s, --status        显示服务状态"
    echo "  -h, --help          显示此帮助信息"
    echo ""
    echo "Examples:"
    echo "  $0                    # 生产环境部署"
    echo "  $0 -e development    # 开发环境部署"
    echo "  $0 -e all            # 所有环境部署"
    echo "  $0 -p nginx          # 部署包含Nginx"
    echo "  $0 -p monitoring     # 部署包含监控"
    echo "  $0 -f                # 强制重新构建"
    echo "  $0 -c                # 清理环境"
    echo "  $0 -l                # 显示日志"
    echo "  $0 -s                # 显示状态"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 检查环境文件
check_env_file() {
    if [ ! -f ".env" ]; then
        log_warning "未找到 .env 文件，使用默认配置"
        if [ -f "env.example" ]; then
            log_info "复制 env.example 为 .env"
            cp env.example .env
        fi
    fi
}

# 清理环境
clean_environment() {
    log_info "清理环境..."
    
    # 停止并删除容器
    docker-compose down --remove-orphans
    
    # 删除旧镜像
    docker image prune -f
    
    # 删除未使用的卷
    docker volume prune -f
    
    # 删除未使用的网络
    docker network prune -f
    
    log_success "环境清理完成"
}

# 构建镜像
build_images() {
    local env=$1
    local force=$2
    
    log_info "构建 $env 环境镜像..."
    
    if [ "$env" = "production" ]; then
        if [ "$force" = "true" ]; then
            docker-compose build --no-cache
        else
            docker-compose build
        fi
    elif [ "$env" = "development" ]; then
        if [ "$force" = "true" ]; then
            docker-compose -f docker-compose.dev.yml build --no-cache
        else
            docker-compose -f docker-compose.dev.yml build
        fi
    fi
    
    log_success "$env 环境镜像构建完成"
}

# 启动服务
start_services() {
    local env=$1
    local profile=$2
    
    log_info "启动 $env 环境服务..."
    
    if [ "$env" = "production" ]; then
        if [ -n "$profile" ]; then
            docker-compose --profile $profile up -d
        else
            docker-compose up -d
        fi
    elif [ "$env" = "development" ]; then
        if [ -n "$profile" ]; then
            docker-compose -f docker-compose.dev.yml --profile $profile up -d
        else
            docker-compose -f docker-compose.dev.yml up -d
        fi
    fi
    
    log_success "$env 环境服务启动完成"
}

# 等待服务就绪
wait_for_services() {
    local env=$1
    
    log_info "等待服务就绪..."
    
    if [ "$env" = "production" ]; then
        # 等待主服务就绪
        timeout=60
        while [ $timeout -gt 0 ]; do
            if curl -f http://localhost:3000/api/health &> /dev/null; then
                log_success "主服务就绪"
                break
            fi
            sleep 2
            timeout=$((timeout - 2))
        done
        
        if [ $timeout -le 0 ]; then
            log_warning "主服务启动超时，请检查日志"
        fi
    fi
}

# 显示服务状态
show_status() {
    local env=$1
    
    log_info "显示 $env 环境服务状态..."
    
    if [ "$env" = "production" ]; then
        docker-compose ps
    elif [ "$env" = "development" ]; then
        docker-compose -f docker-compose.dev.yml ps
    fi
}

# 显示日志
show_logs() {
    local env=$1
    local service=$2
    
    log_info "显示 $env 环境日志..."
    
    if [ "$env" = "production" ]; then
        if [ -n "$service" ]; then
            docker-compose logs -f $service
        else
            docker-compose logs -f
        fi
    elif [ "$env" = "development" ]; then
        if [ -n "$service" ]; then
            docker-compose -f docker-compose.dev.yml logs -f $service
        else
            docker-compose -f docker-compose.dev.yml logs -f
        fi
    fi
}

# 主部署函数
deploy() {
    local env=$1
    local profile=$2
    local force=$3
    
    log_info "开始部署 $PROJECT_NAME v$VERSION ($env 环境)"
    
    # 检查依赖
    check_dependencies
    
    # 检查环境文件
    check_env_file
    
    # 清理环境（如果需要）
    if [ "$force" = "true" ]; then
        clean_environment
    fi
    
    # 构建镜像
    build_images $env $force
    
    # 启动服务
    start_services $env $profile
    
    # 等待服务就绪
    wait_for_services $env
    
    # 显示状态
    show_status $env
    
    log_success "$PROJECT_NAME v$VERSION 部署完成！"
    
    # 显示访问信息
    if [ "$env" = "production" ]; then
        echo ""
        echo "访问地址:"
        echo "  - 主应用: http://localhost:3000"
        if [ "$profile" = "nginx" ] || [ "$profile" = "all" ]; then
            echo "  - Nginx: http://localhost:80"
        fi
        if [ "$profile" = "monitoring" ] || [ "$profile" = "all" ]; then
            echo "  - Prometheus: http://localhost:9090"
            echo "  - Grafana: http://localhost:3001"
        fi
    elif [ "$env" = "development" ]; then
        echo ""
        echo "访问地址:"
        echo "  - 后端: http://localhost:3000"
        echo "  - 前端: http://localhost:5173"
        echo "  - 调试: http://localhost:9229"
    fi
}

# 主函数
main() {
    local env=$DEFAULT_ENV
    local profile=""
    local force=false
    local clean=false
    local logs=false
    local status=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)
                env="$2"
                shift 2
                ;;
            -p|--profile)
                profile="$2"
                shift 2
                ;;
            -f|--force)
                force=true
                shift
                ;;
            -c|--clean)
                clean=true
                shift
                ;;
            -l|--logs)
                logs=true
                shift
                ;;
            -s|--status)
                status=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 执行操作
    if [ "$clean" = "true" ]; then
        clean_environment
        exit 0
    fi
    
    if [ "$status" = "true" ]; then
        show_status $env
        exit 0
    fi
    
    if [ "$logs" = "true" ]; then
        show_logs $env
        exit 0
    fi
    
    # 部署
    if [ "$env" = "all" ]; then
        deploy "production" $profile $force
        deploy "development" $profile $force
    else
        deploy $env $profile $force
    fi
}

# 捕获信号
trap 'log_info "部署被中断"; exit 1' INT TERM

# 运行主函数
main "$@"
