---
title: "备份、升级与恢复"
description: "围绕单文件绑定目录部署，保存可恢复的数据、主密钥与版本记录。"
slug: "docs/operations"
verifiedAt: "2026-11-20"
group: "运维"
---

## 记下部署身份 {#inventory}

保存实际使用的 YAML、项目名、绝对部署目录、两个镜像的版本或 digest、宿主端口和额外曲库路径。生成器默认名是新部署起点；升级时保留原项目身份，不因换镜像仓库而新建项目。

## 备份哪些目录 {#backup}

| 默认目录 | 内容与恢复要求 |
| --- | --- |
| singverse-data | SQLite、元数据、封面和衍生文件 |
| singverse-secrets | 与数据库配套的加密主密钥，必须一起恢复 |
| singverse-compute-auth | 计算 token，同机两服务保持一致 |
| singverse-transcode-cache | 计算缓存，同时含硬件/模型选择和试跑记录 |
| singverse-audio-models | 已准备的固定模型与 RKNN 转换文件 |
| singverse-media | 默认本地原片；使用外部目录时另行备份实际路径 |
| singverse-downloads | 下载的真实歌曲，不能按临时缓存清理 |

使用 MySQL 时另外执行数据库的一致性备份，仍要保存 Go 的文件与主密钥。WebDAV 原片由对应存储系统备份；NAS 中保存的加密凭据依赖主密钥。

## 一次可恢复的停机备份 {#procedure}

```sh
docker compose -f docker-compose.yaml stop
```

确认服务退出后，使用 NAS 备份工具把 YAML 与上述目录复制到独立位置，保留隐藏文件、权限和文件内容。不要把正在写入的 SQLite 文件简单复制当成完整备份。备份结束可用原配置启动：

```sh
docker compose -f docker-compose.yaml up -d --no-build --wait --wait-timeout 180
```

在另一份数据副本、独立项目名及端口中演练恢复，检查账号登录、密钥解密、原片读取和计算连接。恢复验证实例不能同时写生产 SQLite。

## 升级镜像 {#upgrade}

先完成备份并记录旧版本，在 YAML 中分别修改 Go 和 compute 的 `image` 为目标已发布版本。然后执行：

```sh
docker compose -f docker-compose.yaml pull
docker compose -f docker-compose.yaml up -d --no-build --wait --wait-timeout 180
docker compose -f docker-compose.yaml ps
docker compose -f docker-compose.yaml logs --tail=100
```

检查登录、下载页、少量真实播放和计算任务。单纯 `restart` 不会读取新环境变量或换镜像。切换 Docker Hub/GHCR 时也保留数据目录、项目名与版本，先核对实际镜像摘要。

## 从命名卷或其他配置迁移 {#migration}

先用原配置停止旧部署并备份，确认实际 Docker 卷名和容器挂载。将 data、secrets、token、设置、模型、下载等内容分别迁入新绑定目录，再用新 YAML 启动。改成 `./singverse-data:/data` 不会自动复制命名卷内容；空目录可能表现为全新安装。

不要边运行旧实例边迁移 SQLite。保留旧卷直到新实例完整验收，原始媒体默认只读。旧 Java 数据库与 Go 数据库不能直接互换；没有明确迁移路径时使用独立新库。

## 回退 {#rollback}

新版本可能执行数据库迁移，旧镜像未必能读新结构。需要回退时停止新服务，恢复匹配的旧数据库、主密钥和相关文件，再使用记录的旧镜像。保留失败日志和原备份，不用删库重置掩盖升级问题。

## 客户端与网站的更新 {#clients}

管理网页与 APK 随 Go 镜像提供，升级网站不会更新它们。新 APK 需要进入新的业务镜像，客户端从 NAS `/downloads/` 获取或检查更新。覆盖安装需要正确包名、递增版本和相同长期签名；手机本地作品升级前自行导出。

发布者的组件与镜像流程见[开发与发行](/docs/development.html#publishing)。部署者不需要构建前端或设置 Actions Secrets。

## 停止与日常检查 {#checks}

```sh
docker compose -f docker-compose.yaml down
```

`down` 保留绑定目录。不要另外删除数据目录或主密钥。排障记录镜像标签、实际架构、失败步骤、时间和脱敏日志；计算故障额外记录驱动、设备路径和所选模型，见[常见问题](/docs/faq.html)。
