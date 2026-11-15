---
title: "部署与首次登录"
description: "先选发行镜像、源码联调或原生运行，再让手机和电视访问同一 NAS。部署完成后，用少量真实歌曲走通从扫描到播放的完整流程。"
slug: "docs/getting-started"
verifiedAt: "2026-11-15"
group: "入门"
---

## 先选对部署方式 {#choose}

| 方式 | 适合谁 | 你需要准备 |
| --- | --- | --- |
| 已发布镜像 | 长期使用，已有可用发行版 | Docker / Compose、镜像版本、持久卷与网络 |
| 正式源码构建 | 需要自行组装发行镜像 | Go 仓库及固定前端发行包、有效客户端发行包、签名校验工具 |
| 本地源码联调 | 同时修改多个仓库 | 相邻前端与 compute 源码、绝对路径、独立本地运行数据 |
| 原生 Go | 自行管理进程、数据库与反向代理 | 仓库工具链、完整前端产物、显式环境变量 |

## 环境要求 {#requirements}

- Docker 需要 Engine 与 Compose；本地源码联调还需要支持 BuildKit 命名上下文。CPU 架构、磁盘和内存按所选镜像、曲库与计算能力核对。
- 默认数据库为 SQLite，可显式选择 MySQL；MySQL 失败不会静默回退。
- 计算节点可选，用于媒体探测、转码、音轨分析和伴奏分离。
- 手机和电视需要与 NAS 处于同一可互访的私有网络，或能访问你配置的域名。

| 部署方式 | 默认管理入口 | 说明 |
| --- | --- | --- |
| Docker | `http://127.0.0.1:18080/admin/` | HTTP 端口由 `SINGVERSE_HTTP_PORT` 控制，默认 18080 |
| 原生 Go | `http://127.0.0.1:8080/` | 默认只监听回环，不自动加载 `.env` |

## 正式发行包部署 {#docker-release}

在 `singverse-go-backend` 仓库根目录执行。源码构建会先准备并校验手机和电视发行包，因此打包机需要 Android SDK 的 `apksigner` 和 `aapt`。如果项目已经发布镜像，可以直接拉取。

```sh
cp -n .env.example .env
# 按部署需要修改 .env，已有 .env 不会被覆盖
make docker-build docker-up

# 或使用已发布镜像
make docker-pull docker-image-up

# 停止并保留命名卷
make docker-down
```

:::caution
默认只启动 Go。计算节点需要通过 Compose profile 显式启用，或在管理端配置独立节点。首次正式发布需按手机、TV、前端、Go 的顺序准备组件。
:::

## 从 GHCR、Docker Hub 或阿里云拉取镜像 {#image-registry}

发布工作流将同一批已验收镜像推送到 GitHub Container Registry（GHCR）、Docker Hub 和阿里云 ACR。实际项目空间由发布者的 GitHub Actions 参数决定；部署前取得这次发布的仓库地址与版本，再设置 `IMAGE_PREFIX`。以下均为地址格式，尖括号内容需替换。

| 镜像仓库 | IMAGE_PREFIX 格式 | 空间来自发布参数 |
| --- | --- | --- |
| GitHub GHCR | `ghcr.io/<用户或组织>` | `ghcr_namespace` |
| Docker Hub | `docker.io/<用户或组织>` | `dockerhub_namespace` |
| 阿里云 ACR | `<ACR Registry 域名>/<命名空间>` | `acr_registry` 与 `acr_namespace` |

前缀不含 `https://`、镜像名、版本标签或末尾斜杠。Go 镜像为 `<IMAGE_PREFIX>/singverse:<版本>`，计算镜像为 `<IMAGE_PREFIX>/singverse-compute:<版本>-<运行库>`。GitHub Release 使用 `v1.2.3` 形式，镜像版本使用 `1.2.3`，不带开头的 `v`。

```sh
# .env：替换为空间中实际已发布的地址和版本；这里的版本仅作示例
IMAGE_PREFIX=ghcr.io/your-org
SINGVERSE_VERSION=1.2.3
COMPUTE_VERSION=1.2.3
COMPUTE_RUNTIME=base

# 保存 .env 后，在 Go 仓库根目录拉取并启动
make docker-pull docker-image-up
```

主服务与计算节点独立发版，`SINGVERSE_VERSION` 和 `COMPUTE_VERSION` 不必相同。同一 Compose 组合共用一个 `IMAGE_PREFIX`；启用计算节点时，该空间必须同时有目标版本的两个镜像。私有仓库先用有拉取权限的账号执行 `docker login <仓库域名>`。

镜像命名空间决定从哪里拉取；Compose 项目名决定本机容器与命名卷归属。切换镜像源时保留既有项目名（默认 `singverse-go-app`）和数据卷。发布者的参数与权限配置见[三仓库镜像发布](/docs/operations.html#image-publishing)。

## 本地源码联调 {#docker-local}

适合开发者从相邻仓库源码构建前端、Go 和计算节点。先填写前端与 compute 仓库的绝对路径。

```sh
cp -n .env.local.example .env.local
# 编辑 .env.local：
# SINGVERSE_FRONTEND_PROJECT=/absolute/path/to/singverse-frontend
# SINGVERSE_COMPUTE_PROJECT=/absolute/path/to/singverse-compute
make docker-local-up
make docker-local-status
make docker-local-logs

# 停止服务，保留本地数据
make docker-local-down
```

运行数据位于仓库的 `data/docker/`，包括数据库、主密钥、节点认证、模型、媒体和下载目录。本地联调会构建并启动 Go 与 compute，正式发行组合默认只启动 Go；二者不要混用数据位置。

## 让源码联调也能分发 APK {#local-releases}

本地联调不默认依赖已发布客户端。若下载页提示缺包，先在各 Android 仓库生成有效的 APK、`release.json` 和 `SHA256SUMS`，再在 Go 仓库执行：

```sh
make docker-local-releases \
  MOBILE_RELEASE_DIR=/absolute/path/to/mobile/build/mobile-release \
  TV_RELEASE_DIR=/absolute/path/to/tv/app/build/tv-release
make docker-local-up
```

准备命令校验真实签名、包名、版本、ABI、最低系统和摘要；需要可用的 `apksigner` 与 `aapt`。完成后重新构建组合，安装包才进入当前 NAS 下载页。临时 Debug 签名不能覆盖已安装的正式包。

## 原生运行 {#native}

原生 Go 适合已经准备好工具链和前端 dist 的环境。生产原生运行默认监听 `127.0.0.1:8080`，不会自动加载 `.env`，需要显式导出环境变量。

```sh
make go-tools-setup dbmate-setup
make go-backend-build
make go-backend-run
```

首次拆分尚未发布前端时，可显式传入完整前端 dist：

```sh
make go-backend-build FRONTEND_DIST=/absolute/path/to/frontend/dist
```

## 首次登录与改密 {#first-login}

1. 打开管理入口 `/` 或 `/admin/`。
2. 使用首次账号 `admin` / `admin` 登录。
3. 登录后立即修改密码，并按需配置 TOTP 二次验证。
4. 在“设置 → 账号与安全”管理会话和恢复方式。

:::caution
不要把初始密码用于长期运行。忘记密码时，需要在部署主机生成 15 分钟一次性重置码；重置会撤销所有会话并保留 MFA。
:::

## 让手机和电视访问 {#lan}

Docker 默认只绑定 `127.0.0.1`，其他设备无法访问。局域网使用时，把 `.env` 或 `.env.local` 中的 `SINGVERSE_HTTP_BIND` 改为本机当前局域网 IP，再重新部署。

```sh
# .env 或 .env.local
SINGVERSE_HTTP_BIND=192.168.1.100
SINGVERSE_HTTP_PORT=18080
```

然后在手机或电视浏览器打开 `http://192.168.1.100:18080/downloads/`。二维码会编码当前 NAS 地址，因此请始终用其他设备可达的 IP 或域名打开下载页。机器切换网络后，需要同步更新绑定 IP。

## 挂载歌曲目录 {#media-mount}

Docker 中的本地目录指容器内路径。宿主 NAS 的歌曲目录必须先只读挂载，管理端才能选择。默认 Compose 不挂载任意宿主目录。

```sh
# compose.media.yaml（本地文件，不要提交真实路径）
services:
  singverse-go-backend:
    volumes:
      - /your/nas/karaoke:/media/karaoke:ro
```

```sh
docker compose --project-directory . \
  -f infra/docker/compose/compose.yaml \
  -f compose.media.yaml up -d --build --wait
```

随后在“加歌 → 歌曲来源”添加本地目录，填写 `/media/karaoke`。WebDAV-only 部署不需要挂载本地媒体目录。

## 局域网发现 {#discovery}

手机和电视查找 `_singverse._tcp` mDNS 服务。Docker 端口映射只提供 HTTP 入口，不会自动发布发现记录。

### macOS Docker Desktop

```sh
make lan-discovery
# 自定义容器名
make lan-discovery DISCOVERY_CONTAINER=<Go 容器名>
```

命令需要保持运行，Ctrl-C 停止，Mac 重启后重新运行。它会验证容器实际发布的 HTTP 入口后再广播。

### Linux NAS

```sh
avahi-publish-service "SingVerse NAS" _singverse._tcp 18080 api=1 scheme=http
```

保持进程运行，或使用宿主机已有的 Avahi 服务配置。原生 Go 可显式设置 `SINGVERSE_TV_DISCOVERY_ADDRESS` 和 `SINGVERSE_TV_DISCOVERY_PORT`。没有发布 mDNS 时，手动填写地址始终可用。

## 安全与备份 {#security}

- 局域网 HTTP 可用于私有网络；跨网或公网访问建议配置 HTTPS 反向代理，并正确设置 `SINGVERSE_PUBLIC_ORIGIN` 与可信代理。
- 数据库、主密钥和节点认证文件必须配套备份。主密钥缺失或不匹配会导致受保护凭据无法恢复。
- 停止服务后再备份数据卷或 `data/docker/`，不要只备份数据库而遗漏主密钥。
- 原始媒体保持只读；备份策略由你的 NAS 负责。

:::note
更完整的备份、升级和旧部署切换说明见后端仓库 `infra/docker/OPERATIONS.md`。本页只覆盖首次部署所需的最小路径。
:::

## 地址与端口速查 {#ports}

| 地址 / 配置 | 含义 | 常见误区 |
| --- | --- | --- |
| `127.0.0.1:18080` | Docker 默认宿主业务入口 | 只允许部署主机本身访问 |
| `NAS-LAN-IP:18080` | 手机、电视和亲友实际访问入口 | 需设置绑定 IP、防火墙与路由 |
| `127.0.0.1:8080` | 原生 Go 默认入口 | 原生不自动加载 .env |
| `singverse-compute:8090` | 同一 Compose 网络内的计算服务 | 不是手机或浏览器连接地址 |
| `127.0.0.1:18090` | 默认宿主侧计算节点检查入口 | 健康不代表模型与双向回源已通过 |
| `_singverse._tcp` | 手机与电视寻找 NAS 的发现记录 | 端口映射不自动发布 mDNS |

## 部署后完成一次小范围验收 {#first-library}

1. 管理端能登录，已经修改初始密码，账号与时间状态正常。
2. 从另一台设备打开下载页，二维码不是 localhost，安装包按准备情况真实显示。
3. 添加一个小目录或 WebDAV 子目录，保存并扫描，确认文件数与歌曲数。
4. 核对一首歌的资料和原伴，先在目标客户端直放。
5. 需要转码时测试计算节点及回源，再试播放兼容素材。
6. 电视邀请亲友，测试点歌、队列与暂停，确认实际执行。
7. 确认所有数据落在预期位置，安排数据库、主密钥和持久附件配套备份。

找不到 NAS 先手动输入地址，发现只是便利入口。可用前不要扩大到整库、批量生成或大量下载，以免把网络、挂载与整理问题混在一起。

## 下一步配置 {#next}

[添加歌曲来源](/docs/library.html) → [设置文件名识别](/docs/filename.html) → [核对资料](/docs/metadata.html) → [连接电视](/docs/tv.html)。长期维护参考 [备份、升级与维护](/docs/operations.html)；登录恢复参考 [账号安全](/docs/security.html)。
