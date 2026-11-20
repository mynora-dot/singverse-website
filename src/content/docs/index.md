---
title: "使用文档"
description: "从现有镜像部署到家庭开唱：先生成配置，再建立曲库、连接客户端和安排备份。"
slug: "docs/index"
verifiedAt: "2026-11-20"
group: "入门"
---

## 从这里开始 {#start}

SingVerse 由一个业务管理端和可选的计算端组成。管理端负责账号、曲库、收藏、歌单和设备连接；计算端承担媒体探测、兼容转码、音轨识别和模型处理。手机、电视与亲友页面连接同一业务服务。

1. [生成 Docker Compose](/docs/compose.html)：按硬件、目录和资源预算下载单文件配置。
2. [部署与首次登录](/docs/getting-started.html)：启动、改密、验证另一台设备可访问。
3. [添加歌曲来源](/docs/library.html)：使用本地目录或 WebDAV，从小目录开始扫描。
4. [连接电视](/docs/tv.html)或[手机](/docs/mobile.html)，实际播放一首歌。
5. [备份与升级](/docs/operations.html)：保存数据库、主密钥、计算认证和持久目录。

## 选择你的部署 {#architecture}

| 场景 | 部署内容 | 下一步 |
| --- | --- | --- |
| 只管理曲库，暂不做转码 | 仅管理端 | 需要计算时再连接节点 |
| 一台 Linux NAS 完成全部工作 | 管理端 + 同机计算 | 按 NVIDIA、AMD、Intel、Rockchip 选择镜像 |
| NAS 与计算机器分开 | 管理端 + 独立计算节点 | 在后台配对并确认双向回调 |
| Apple Silicon Mac 提供计算 | 管理端 + Mac 原生 compute | 使用原生发行包，Docker 无法提供 Apple GPU |

主镜像内含 `/admin/`、`/party/` 和 `/downloads/`，无需另部署前端容器。官网是独立的公开帮助站，不能登录你的 NAS 或读取曲库。

## 按工作找到入口 {#navigation}

| 管理端位置 | 用途 | 指南 |
| --- | --- | --- |
| 加歌 → 歌曲来源 | 本地/WebDAV、扫描、文件名识别 | [来源](/docs/library.html)、[识别方案](/docs/filename.html) |
| 加歌 → 下载歌曲 / 缺歌心愿 | 自备音源下载、处理家庭缺歌反馈 | [下载](/docs/resources.html)、[播放与反馈](/docs/activity.html) |
| 整理 → 歌曲信息 / 原唱与伴奏 | 元数据审核、音轨标记、生成伴奏 | [资料](/docs/metadata.html)、[音频](/docs/audio.html) |
| 曲库 → 歌曲 / 歌手 / 歌单 / 收藏 | 查找和组织歌曲 | [收藏与歌单](/docs/collections.html) |
| 客厅 → 播放与热门 / 电视首页 / 客户端下载 | 家庭播放与设备体验 | [电视](/docs/tv.html) |
| 设置 → 计算服务 / 存储与缓存 | 节点、模型、缓存策略 | [计算](/docs/compute.html)、[系统设置](/docs/advanced.html) |
| 设置 → 账号与安全 | 密码、MFA、会话恢复 | [安全](/docs/security.html) |
| 任务中心 | 查看批次、阶段和失败原因 | [任务](/docs/tasks.html) |

## 先验收一首歌 {#first-song}

用一首你有权使用的素材确认：来源读取正常 → 标题歌手正确 → 能直放 → 原唱/伴奏试听正确 → 需要时再测试兼容转码与模型。这个小流程通过后再扩大扫描范围，避免批量放大路径、识别或驱动错误。

## 文档依据 {#principles}

本轮内容依据 2026-11-20 工作区的 Go 配置、compute 运行库、客户端契约和现有硬件 Compose 重写。文档里的硬件预设是配置起点，实际能力取决于所拉取镜像、宿主驱动和真实素材试跑。不会把演示图、历史实验结果或镜像构建成功当作所有设备都已验收。
