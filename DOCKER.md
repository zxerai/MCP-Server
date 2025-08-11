# MCP Server v1.0.0 Docker 部署指南

## 概述

MCP Server 提供了完整的 Docker 部署解决方案，支持生产环境和开发环境，包含监控、数据库、缓存等可选服务。

## 快速开始

### 1. 环境准备

确保系统已安装：
- Docker 20.10+
- Docker Compose 2.0+

### 2. 克隆项目

```bash
git clone https://github.com/zxerai/MCP-Server.git
cd MCP-Server
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp env.example .env

# 根据需要修改 .env 文件
nano .env
```

### 4. 快速部署

```bash
# 使用部署脚本
chmod +x deploy.sh
./deploy.sh

# 或手动部署
docker-compose up -d
```

## 部署模式

### 生产环境部署

```bash
# 基础部署（仅主应用）
docker-compose up -d

# 包含 Nginx 反向代理
docker-compose --profile nginx up -d

# 包含数据库和缓存
docker-compose --profile postgres --profile redis up -d

# 包含完整监控
docker-compose --profile monitoring up -d

# 完整部署（所有服务）
docker-compose --profile nginx --profile postgres --profile redis --profile monitoring up -d
```

### 开发环境部署

```bash
# 开发环境（支持热重载）
docker-compose -f docker-compose.dev.yml up -d

# 包含开发数据库
docker-compose -f docker-compose.dev.yml --profile postgres up -d

# 包含开发监控
docker-compose -f docker-compose.dev.yml --profile monitoring up -d
```

## 服务配置

### 核心服务

| 服务 | 端口 | 描述 | 必需 |
|------|------|------|------|
| mcpserver | 3000 | 主应用服务 | ✅ |
| nginx | 80/443 | 反向代理 | ❌ |
| redis | 6379 | 缓存服务 | ❌ |
| postgres | 5432 | 数据库服务 | ❌ |

### 监控服务

| 服务 | 端口 | 描述 | 必需 |
|------|------|------|------|
| prometheus | 9090 | 指标收集 | ❌ |
| grafana | 3001 | 可视化面板 | ❌ |

### 开发服务

| 服务 | 端口 | 描述 | 必需 |
|------|------|------|------|
| mcpserver-dev | 3000, 5173, 9229 | 开发环境 | ❌ |
| postgres-dev | 5433 | 开发数据库 | ❌ |
| redis-dev | 6380 | 开发缓存 | ❌ |

## 环境变量配置

### 基础配置

```bash
# 应用配置
NODE_ENV=production
MCPSERVER_PORT=3000
BASE_PATH=
READONLY=false
REQUEST_TIMEOUT=60000

# 时区
TZ=Asia/Shanghai
```

### 代理配置

```bash
# 代理设置
HTTP_PROXY=
HTTPS_PROXY=
NPM_REGISTRY=https://registry.npmjs.org/
```

### 服务端口

```bash
# Nginx
NGINX_PORT=80
NGINX_SSL_PORT=443

# Redis
REDIS_PORT=6379
REDIS_PASSWORD=mcpserver123

# PostgreSQL
POSTGRES_PORT=5432
POSTGRES_DB=mcpserver
POSTGRES_USER=mcpserver
POSTGRES_PASSWORD=mcpserver123

# 监控
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_PASSWORD=admin123
```

## 部署脚本使用

### 基本用法

```bash
# 生产环境部署
./deploy.sh

# 开发环境部署
./deploy.sh -e development

# 强制重新构建
./deploy.sh -f

# 清理环境
./deploy.sh -c

# 显示状态
./deploy.sh -s

# 显示日志
./deploy.sh -l
```

### 高级用法

```bash
# 部署包含 Nginx
./deploy.sh -p nginx

# 部署包含监控
./deploy.sh -p monitoring

# 部署所有环境
./deploy.sh -e all

# 组合使用
./deploy.sh -e production -p nginx -f
```

## 监控配置

### Prometheus 配置

Prometheus 配置文件位于 `monitoring/prometheus.yml`，包含：

- 应用指标收集
- Nginx 状态监控
- Redis 性能指标
- PostgreSQL 数据库指标
- 系统资源监控

### Grafana 配置

Grafana 自动配置：

- 数据源：Prometheus
- 仪表板：MCP Server 监控面板
- 用户：admin / admin123

## 性能优化

### 资源限制

```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '0.5'
    reservations:
      memory: 512M
      cpus: '0.25'
```

### 缓存策略

- 静态文件：1年缓存
- API 响应：根据内容类型
- 数据库查询：Redis 缓存

### 网络优化

- Keep-alive 连接
- 连接池管理
- 负载均衡

## 安全配置

### 容器安全

```yaml
security_opt:
  - no-new-privileges:true
read_only: true  # Nginx
tmpfs:
  - /tmp:noexec,nosuid,size=100m
```

### 网络安全

- 内部网络隔离
- 端口限制
- 访问控制

### 数据安全

- 非 root 用户运行
- 文件权限控制
- 敏感信息加密

## 日志管理

### 日志配置

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 日志位置

- 应用日志：`/app/logs`
- Nginx 日志：`/var/log/nginx`
- 系统日志：PostgreSQL 表

## 备份和恢复

### 数据备份

```bash
# 数据库备份
docker exec mcpserver_postgres pg_dump -U mcpserver mcpserver > backup.sql

# 配置文件备份
docker cp mcpserver:/app/mcp_settings.json ./backup/
docker cp mcpserver:/app/servers.json ./backup/
```

### 数据恢复

```bash
# 数据库恢复
docker exec -i mcpserver_postgres psql -U mcpserver mcpserver < backup.sql

# 配置文件恢复
docker cp ./backup/mcp_settings.json mcpserver:/app/
docker cp ./backup/servers.json mcpserver:/app/
```

## 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   netstat -tuln | grep :3000
   
   # 修改端口
   export MCPSERVER_PORT=3001
   ```

2. **权限问题**
   ```bash
   # 修复文件权限
   sudo chown -R $USER:$USER .
   chmod +x deploy.sh
   ```

3. **内存不足**
   ```bash
   # 增加 Docker 内存限制
   # 或减少服务资源限制
   ```

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f mcpserver

# 查看错误日志
docker-compose logs --tail=100 | grep ERROR
```

### 健康检查

```bash
# 检查服务状态
docker-compose ps

# 检查健康状态
curl http://localhost:3000/api/health

# 检查 Nginx 状态
curl http://localhost/health
```

## 扩展部署

### 集群部署

```bash
# 创建 Swarm 集群
docker swarm init

# 部署到集群
docker stack deploy -c docker-compose.yml mcpserver
```

### 多环境部署

```bash
# 生产环境
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 测试环境
docker-compose -f docker-compose.yml -f docker-compose.test.yml up -d
```

### 自定义镜像

```bash
# 构建自定义镜像
docker build -t mcpserver:custom .

# 使用自定义镜像
docker-compose up -d
```

## 维护和更新

### 定期维护

```bash
# 清理未使用的资源
docker system prune -f

# 更新镜像
docker-compose pull
docker-compose up -d

# 备份数据
./deploy.sh -c
```

### 版本升级

```bash
# 停止服务
docker-compose down

# 拉取新版本
git pull origin main

# 重新部署
./deploy.sh -f
```

## 支持和反馈

如果在部署过程中遇到问题，请：

1. 查看 [GitHub Issues](https://github.com/zxerai/MCP-Server/issues)
2. 检查日志文件
3. 提交详细的错误报告

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE) 文件。
