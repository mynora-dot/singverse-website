---
title: "备份、升级与维护"
description: "让数据、密钥、附件和组件版本一起维护。先确认部署身份与恢复路径，再升级服务、分发客户端或切换计算方式。"
slug: "docs/operations"
verifiedAt: "2026-11-15"
group: "系统管理"
---

## 先记清自己的部署身份 {#inventory}

维护前记录实际使用的项目名、配置文件组合、绑定 IP、端口、镜像版本、数据位置和外部媒体挂载。正式项目默认为 `singverse-go-app`，实际卷名带项目名前缀。

正式镜像路线使用命名卷，本地源码联调使用 `data/docker/` 目录。两种方式的数据位置不同，切换命令不能自动迁移数据。后续操作沿用最初的完整配置组合。

## 停机备份清单 {#backup}

| 内容 | 为什么要备份 |
| --- | --- |
| 业务数据库 | 账号、曲库资料、来源、收藏、歌单、历史、反馈、任务与配置 |
| 匹配主密钥 / secrets | 恢复 MFA、WebDAV、AI、音源与连接凭据 |
| 持久资料目录 | 正式封面、歌词、受管上传与共享资料附件 |
| 独立兼容版本与音频成品 | 不是普通临时缓存，按实际需求保留 |
| 下载卷或 NAS 下载目录 | 已发布的真实歌曲及附件 |
| 节点认证、硬件与模型设置 | 计算身份及本机可用配置；compute cache 卷不全是可丢弃文件 |
| 部署配置与版本清单 | 恢复相同镜像、Compose 组合、环境和挂载 |
| 外部媒体与手机作品 | 分别由 NAS/WebDAV 备份和手机导出，不在业务库里 |

## 如何做一次可恢复的备份 {#procedure}

1. 使用当前完整 Compose 组合停止业务，等待进程退出；SQLite 不能把正在写入的单个文件直接当完整备份。
2. 用 Docker/NAS 卷备份或相应数据库一致性工具备份数据与匹配密钥，保留文件权限。
3. 单独保护环境文件和版本记录，不把密钥或真实部署配置提交 Git。
4. 在隔离项目与新卷中恢复，核对登录、来源、附件、播放、收藏及计算连接。
5. 确认可恢复后再安排正式切换，不能覆盖正在运行的数据库。

停止用 `down` 可保留卷；`down -v` 会删除命名卷，不用于常规维护。不要把清理缓存当作清理业务 data 或 compute 整个设置卷。

## 升级服务与网页 {#upgrade}

1. 核对目标版本与配套组件，先完成停机备份。
2. 源码路线更新完整源码并按原组合构建；镜像路线固定新版本或摘要后拉取。
3. 保留项目名、卷、密钥、外部挂载、环境文件和覆盖配置，使用原完整组合启动。
4. Go 启动应用未部署的增量迁移，迁移失败先保留日志处理，不能清库“修复”。
5. 验证管理登录、来源读取、正式附件、亲友邀请、真实播放和需要的计算任务。

本官网是独立的内容站点。更新 `singverse-website` 不会替换 Go 内置的管理网页、H5、APK 或已运行的 NAS。

## 通过 Actions 发布到两个镜像仓库 {#image-publishing}

Go 仓库的 `platform-release` 发布 `singverse`；compute 仓库的 `singverse-compute-images` 发布 `singverse-compute` 的各运行库。每次正式发布都向 GHCR、Docker Hub 两个目的地推送已验收的同一批 OCI 产物。

发布者先提交并推送源码和工作流，在对应仓库的 Releases 页面发布指向该提交的正式 Release，例如 `v1.2.3`。工作流只响应正式 `release.published`，跳过草稿和 Pre-release；普通 push、PR、单独推送 tag 不发布，也没有 Run workflow 入口。版本从标签注入，不维护源码 VERSION 文件。

| Actions Variable | 填写内容 | 留空时 |
| --- | --- | --- |
| `GHCR_NAMESPACE` | 小写 GHCR 用户或组织名 | 当前仓库 owner 的小写名称 |
| `DOCKERHUB_NAMESPACE` | 小写 Docker Hub 用户或组织名 | 必填 |

Docker Hub 使用 `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`，保存在 Actions Secrets。GHCR 默认使用工作流令牌；跨组织发布可配置有正式包与构建缓存包写入权限的 `GHCR_USERNAME` / `GHCR_TOKEN`。Go 读取私有前端、手机、TV Release 时，还需要仅对组件仓库授权 Contents: read 的 `CROSS_REPO_READ_TOKEN`。

两个目的地配置齐全后才进入发布。固定标签已有不同内容时会失败，全部固定版本成功后才更新主服务的 `latest` 或计算端的 `latest-<runtime>`，例如 `latest-cuda`。compute 每版只提供 CUDA、ROCm、OpenVINO、RKNN 各一个版本标签和一个 latest 标签，CPU 自动降级包含在镜像内；Mac 使用同一 Release 的原生安装包。

重试直接复用 Release 中的组件锁与 OCI 归档，不重复上传 OCI 到 Actions artifacts。构建层另存于各项目独立的 GHCR `*-buildcache` 包，不增加正式镜像标签；这些缓存不承担正式产物恢复，缓存缺失仍可重新构建。每个 job 都使用独立 runner，各项目之间不共享磁盘。部署端按实际目的地设置 [`IMAGE_PREFIX`](/docs/getting-started.html#image-registry)。

发布工作流成功与实际部署是两步操作；仍需拉取镜像并更新 NAS。完整配置、凭据权限与重试说明见 Go 仓库 `infra/docker/PUBLISHING.md` 和 compute 仓库 `infra/docker/README.md`。

## 客户端安装包与配套发布 {#clients}

手机和电视更新包来自 NAS 当前镜像内的只读发行文件。发布了新 APK 后，还需把通过校验的发行包重新装入 Go 平台镜像并升级 NAS，设备下载页才会出现新版本。

构建发行组合通常先准备手机、TV、完整前端静态包，再打包 Go。协议上线是另一件事：本轮公平队列与亲友遥控 v2 需要按 Go → TV → H5 顺序启用。两种顺序分别描述产物准备和运行协议升级。

客户端覆盖安装需版本与长期签名兼容；Debug 和 Release 不能互相覆盖。原生 Go 可用 `SINGVERSE_CLIENT_RELEASE_DIRECTORY` 指向包含 mobile、tv 的发行目录。

## 升级失败如何回退 {#rollback}

保留错误日志、数据卷与升级前备份。旧镜像不一定能读取新迁移后的数据库，回退需要恢复匹配版本的数据、密钥和持久附件，再使用相应版本启动。

不要仅把镜像标签调旧就假定安全回退，也不要把失败容器与业务卷一起删除。旧 Java 部署的数据库不能直接当作 Go 业务库复用；历史卷应独立保留并按实际迁移方案处理。

## 日常检查与问题记录 {#checks}

- 确认服务健康、管理员登录、客户端下载和邀请入口。
- 观察磁盘空闲、缓存预算、下载目录、持久附件和离线成品的实际占用。
- 检查任务中心排队原因、失败批次及来源定时扫描结果。
- 定期用目标电视试播本地、WebDAV、原伴和兼容素材。
- 发生问题记录日期时间、版本、操作、任务编号和错误状态；隐藏令牌、密钥与真实媒体路径。

```sh
# 本地源码组合：在 singverse-go-backend 仓库执行
make docker-local-status
make docker-local-logs

# 查看当前部署的既有只读检查入口
make docker-check
```

检查命令的认证条件以当前仓库说明为准；不要在共享命令历史直接填写密码。真实 MySQL、GPU、微信和硬件设备检查需在对应环境完成。

## 升级后快速验收 {#verification}

1. 手机浏览器从 LAN 地址打开下载页，核对可用版本与二维码地址。
2. 后台查看来源、歌曲、封面、收藏及历史，确认没有连到空的新数据卷。
3. 电视登录并播一首，手机点歌、暂停和切歌，核对执行反馈。
4. 使用计算节点时试跑探测与兼容任务，验证双向回源。
5. 手机回听原有作品，确认覆盖安装保留本机数据。
6. 完成后再结束维护，保留升级前备份和本次版本记录。
