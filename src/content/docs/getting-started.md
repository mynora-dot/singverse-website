---
title: "部署与首次登录"
description: "直接使用 Docker Hub 镜像，一份 YAML 完成部署，不需要 .env、命名卷或手动 chown。"
slug: "docs/getting-started"
verifiedAt: "2026-11-20"
group: "部署"
---

## 准备主机 {#requirements}

准备可运行 Docker Engine 和 Compose 的 Linux 主机。管理端支持 AMD64、ARM64；计算镜像按硬件选择。宿主必须先提供对应驱动和设备，容器不能代替安装 GPU/NPU 驱动。

| 预设 | 架构 | 计算镜像后缀 | 默认业务端口 |
| --- | --- | --- | --- |
| NVIDIA A3000 | AMD64 | `-cuda` | 18080 |
| AMD Radeon 780M | AMD64 | `-rocm` | 18080 |
| Intel N100 / 核显 | AMD64 | `-openvino` | 18080 |
| RK3566 测试 | ARM64 | `-rknn` | 18081 |

硬件前置检查、内存预算和验证步骤见[硬件指南](/docs/hardware.html)。只部署管理端时可不映射设备，之后再添加计算服务。

## 生成单文件配置 {#docker-release}

打开 [Compose 生成器](/docs/compose.html)，依次选择服务组合、硬件、镜像版本、入口、数据目录。默认 SQLite，无需额外数据库。需要 MySQL 时选择“连接已有 MySQL”并填写真实连接参数。

下载文件为 `docker-compose.yaml`，放进固定部署目录。所有运行参数直接写在文件里；默认使用 `./singverse-data:/data` 这样的目录绑定，以及容器 `user: "0:0"`。不要求宿主 UID 为 10001，也没有权限初始化容器。

宿主新文件通常归 root。若需要普通用户直接读写所有文件，需要另外按实际 UID/GID 准备目录，不能靠删除 `user` 达到这一点：删除后仍会沿用镜像默认用户。

## 直接下载固定模板 {#templates}

不使用 JavaScript 或只需要默认配置，可以保存以下文件并改名为 `docker-compose.yaml`。这些文件与生成器使用同一配置逻辑生成。

- [A3000 默认配置](/deploy/a3000.yaml)
- [780M 默认配置](/deploy/amd780m.yaml)
- [Intel 核显默认配置](/deploy/intel.yaml)
- [RK3566 测试配置](/deploy/rk3566.yaml)
- [仅管理端 AMD64](/deploy/app-amd64.yaml)
- [仅管理端 ARM64](/deploy/app-arm64.yaml)

## 确认镜像与版本 {#image-registry}

默认主镜像为 `docker.io/mynora/singverse:latest`，计算镜像为 `docker.io/mynora/singverse-compute:latest-运行库`。如果发布到其他空间，在生成器改“镜像仓库 / 空间”。私有镜像先在主机执行 `docker login docker.io`，不要把登录凭据写进配置。

Go 与 compute 独立发版，可以使用不同版本。正式运行建议分别选择实际发布的固定版本；Release 的 `v1.2.3` 对应镜像标签 `1.2.3`。`latest` 会随发布变化，文档不会代替拉取检查远端标签。ARM64 管理端不能与仅有 AMD64 的 CUDA/ROCm/OpenVINO 变体混用硬件透传。

## 启动 {#start}

在 YAML 所在目录执行：

```sh
docker compose -f docker-compose.yaml config --quiet
docker compose -f docker-compose.yaml pull
docker compose -f docker-compose.yaml up -d --no-build --wait --wait-timeout 180
docker compose -f docker-compose.yaml ps
```

`config` 检查格式；`pull` 检查镜像是否能获取；`up --wait` 等待服务健康。失败时查看日志，不用重复删除数据目录来排障：

```sh
docker compose -f docker-compose.yaml logs --tail=100 singverse-go-backend
docker compose -f docker-compose.yaml logs --tail=100 singverse-compute
```

仅管理端配置不包含第二个服务。计算端失败时管理页面仍可启动，兼容播放和模型任务则需要先排除计算故障。

## 首次登录 {#first-login}

打开 `http://主机局域网IP:18080/admin/`；RK 测试默认用 18081。新数据库的初始账号密码为 `admin/admin`，已有数据库保持原账号。登录后到“设置 → 账号与安全”修改密码，按需启用 TOTP 二次验证。

同机计算在“设置 → 计算服务”选择自动连接。计算端自动创建 token，Go 从同一个绑定目录只读获取。已有数据库保存的手动连接或禁用状态可能覆盖自动配置，需要在页面检查。

## 手机和电视如何访问 {#lan}

默认 `ports.host_ip` 为 `0.0.0.0`，允许通过宿主实际地址访问。手机和电视填写 `http://NAS局域网IP:端口`，不要填写 `0.0.0.0`、`localhost` 或 `singverse-go-backend`。后两种地址不代表另一台设备上的 NAS。

打开同一根地址的 `/downloads/` 安装 APK。若选择 `127.0.0.1` 监听，其他设备无法直连；需要改绑定地址或提供可达的反向代理。HTTPS 的来源与代理配置见[参数手册](/docs/parameters.html#singverse-public-origin)。

## 加入本地曲库或 WebDAV {#media-mount}

默认把文件旁的 `singverse-media` 只读挂到 `/media`。已有曲库可在生成器填写真实宿主目录，必须已经存在；管理端添加来源时填写容器内 `/media`，不是宿主 `/volume1/...` 路径。

WebDAV 地址、账号和密码在“加歌 → 歌曲来源”填写，无需把远端地址写成 Docker 挂载。先测试连接和小范围扫描，参见[曲库指南](/docs/library.html)。

## 自动发现与手动连接 {#discovery}

端口映射不自动发布 `_singverse._tcp` mDNS。Linux 宿主使用已有 Avahi 服务时可发布业务端口：

```sh
avahi-publish-service "SingVerse NAS" _singverse._tcp 18080 api=1 scheme=http
```

使用实际业务端口并保持发布进程运行。mDNS 无法跨某些 VLAN 或访客 Wi-Fi，手动填写可达地址也能使用。

## 已有部署与源码用户 {#local-releases}

本页是预构建镜像路线。仅下载网站或修改网站文件不会产生新的业务镜像、前端或 APK。源码构建、本地联调与原生运行另见[开发与发行](/docs/development.html)。

旧命名卷不会自动搬进新绑定目录。替换前先停旧服务并备份，成套迁移数据、主密钥、节点 token、模型与设置；不要让两套项目同时写同一 SQLite。具体步骤见[备份与升级](/docs/operations.html)。
