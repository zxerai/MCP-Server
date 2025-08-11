# MCPHub v1.0.0 Docker 部署指南

MCPHub 提供了完整的 Docker 容器化部署方案，支持生产环境和开发环境的快速部署。

## 📦 部署文件说明

### 核心文件
- `Dockerfile` - 生产环境多阶段构建
- `Dockerfile.dev` - 开发环境构建
- `docker-compose.yml` - 生产环境编排
- `docker-compose.dev.yml` - 开发环境编排
- `.dockerignore` - Docker 构建忽略文件
- `nginx.conf` - Nginx 反向代理配置
- `.env.example` - 环境变量配置示例

## 🚀 快速开始

### 1. 准备环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量（根据需要修改）
vim .env
```

### 2. 生产环境部署

#### 基础部署
```bash
# 构建并启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f mcphub
```

#### 带 Nginx 反向代理
```bash
# 启用 Nginx 配置
docker-compose --profile nginx up -d

# 访问应用
curl http://localhost
```

#### 完整部署（包含 Redis 和 PostgreSQL）
```bash
# 启动所有服务
docker-compose --profile nginx --profile redis --profile postgres up -d
```

### 3. 开发环境部署

```bash
# 使用开发环境配置
docker-compose -f docker-compose.dev.yml up -d

# 访问应用
# 后端: http://localhost:3000
# 前端: http://localhost:5173
```

## 🔧 配置选项

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MCPHUB_PORT` | `3000` | MCPHub 服务端口 |
| `FRONTEND_PORT` | `5173` | 前端开发服务器端口 |
| `BASE_PATH` | `` | 基础路径（用于反向代理） |
| `READONLY` | `false` | 只读模式 |
| `REQUEST_TIMEOUT` | `60000` | 请求超时时间（毫秒） |
| `HTTP_PROXY` | `` | HTTP 代理 |
| `HTTPS_PROXY` | `` | HTTPS 代理 |
| `INSTALL_EXT` | `false` | 是否安装扩展工具 |

### Docker Compose 配置文件

#### 生产环境 (`docker-compose.yml`)
- **mcphub**: 主应用服务
- **nginx**: 反向代理（可选）
- **redis**: 缓存服务（可选）
- **postgres**: 数据库服务（可选）

#### 开发环境 (`docker-compose.dev.yml`)
- 支持热重载
- 挂载源代码目录
- 同时启动前后端服务

## 🏗️ 构建选项

### 构建参数

```bash
# 自定义构建参数
docker build \
  --build-arg HTTP_PROXY=http://proxy.company.com:8080 \
  --build-arg INSTALL_EXT=true \
  -t mcphub:custom .
```

### 多架构构建

```bash
# 构建 ARM64 架构
docker buildx build --platform linux/arm64 -t mcphub:arm64 .

# 构建多架构镜像
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t mcphub:multiarch .
```

## 📊 监控和维护

### 健康检查

```bash
# 检查服务健康状态
docker-compose exec mcphub curl -f http://localhost:3000/api/health

# 查看健康检查日志
docker inspect mcphub | jq '.[0].State.Health'
```

### 日志管理

```bash
# 查看实时日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f mcphub

# 限制日志输出行数
docker-compose logs --tail=100 mcphub
```

### 数据备份

```bash
# 备份配置文件
docker cp mcphub:/app/mcp_settings.json ./backup/

# 备份数据库（如果使用 PostgreSQL）
docker-compose exec postgres pg_dump -U mcphub mcphub > backup.sql
```

## 🔒 安全配置

### SSL/TLS 配置

1. 准备 SSL 证书：
```bash
mkdir -p ssl
# 将证书文件放入 ssl 目录
# cert.pem - 证书文件
# key.pem - 私钥文件
```

2. 启用 HTTPS：
```bash
# 编辑 nginx.conf，取消注释 HTTPS 服务器配置
# 设置环境变量
export SSL_CERT_DIR=./ssl
export NGINX_SSL_PORT=443

# 重启服务
docker-compose --profile nginx up -d
```

### 网络安全

```bash
# 创建自定义网络
docker network create mcphub_secure --driver bridge

# 使用自定义网络
docker-compose --profile nginx up -d
```

## 🚨 故障排除

### 常见问题

#### 1. 端口冲突
```bash
# 检查端口占用
netstat -tlnp | grep :3000

# 修改端口
export MCPHUB_PORT=3001
docker-compose up -d
```

#### 2. 内存不足
```bash
# 检查容器资源使用
docker stats mcphub

# 调整内存限制（在 docker-compose.yml 中）
deploy:
  resources:
    limits:
      memory: 2G
```

#### 3. 网络连接问题
```bash
# 检查网络连接
docker-compose exec mcphub curl -I http://localhost:3000

# 重建网络
docker-compose down
docker network prune
docker-compose up -d
```

### 调试模式

```bash
# 以调试模式运行
docker-compose -f docker-compose.dev.yml up

# 进入容器调试
docker-compose exec mcphub sh

# 查看环境变量
docker-compose exec mcphub env
```

## 📈 性能优化

### 容器优化

1. **多阶段构建**: 减小镜像大小
2. **依赖缓存**: 利用 Docker 层缓存
3. **资源限制**: 合理设置内存和 CPU 限制

### 网络优化

1. **Nginx 缓存**: 启用静态文件缓存
2. **Gzip 压缩**: 减少传输数据量
3. **Keep-Alive**: 复用连接

### 存储优化

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的卷
docker volume prune

# 查看磁盘使用情况
docker system df
```

## 🔄 更新部署

### 滚动更新

```bash
# 拉取最新镜像
docker-compose pull

# 重新启动服务
docker-compose up -d

# 验证更新
docker-compose exec mcphub curl -s http://localhost:3000/api/health
```

### 版本回滚

```bash
# 使用特定版本
docker-compose down
docker tag mcphub:1.0.0 mcphub:latest
docker-compose up -d
```

## 📝 最佳实践

1. **环境隔离**: 生产、测试、开发环境分离
2. **配置外化**: 使用环境变量和配置文件
3. **日志管理**: 配置日志轮转和收集
4. **监控告警**: 设置健康检查和监控
5. **备份策略**: 定期备份配置和数据
6. **安全更新**: 及时更新基础镜像和依赖

## 🆘 支持

如果遇到问题，请：

1. 查看日志：`docker-compose logs -f`
2. 检查健康状态：`docker-compose ps`
3. 验证配置：`docker-compose config`
4. 提交 Issue：[GitHub Issues](https://github.com/zxerai/MCP-Server/issues)

---

更多信息请参考：
- [MCPHub 官方文档](https://mcphub.sh)
- [Docker 官方文档](https://docs.docker.com)
- [Docker Compose 参考](https://docs.docker.com/compose/)
