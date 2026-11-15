---
title: "计算节点与兼容播放"
description: "用可选节点承担探测、转码和音轨处理。先打通认证与双向回源，再按真实素材验证模型、硬件和播放兼容性。"
slug: "docs/compute"
verifiedAt: "2026-11-15"
group: "系统管理"
---

## 先判断是否需要节点 {#need}

计算节点是可选 Python 服务，负责媒体探测、内嵌信息读取、兼容转码、音轨识别和伴奏分离。Go 保留业务、数据库、鉴权与最终结果，所有客户端仍只连接 Go。

| 使用场景 | 节点需求 |
| --- | --- |
| 文件名扫描、曲库查询、收藏、歌单、点歌 | 不依赖计算节点 |
| 目标设备能直放的媒体 | 通常可直接播放，无需临时转码 |
| 媒体技术探测、标签读取、自动音轨分析 | 需要可用节点 |
| 实时兼容转码与新离线兼容版本 | 需要可用节点及可写衍生目录 |
| 读取已有可用缓存或离线兼容文件 | 不因节点离线就自动失效 |
| AI 伴奏分离 | 还需要合适运行库、模型与设备 |

## 选择自动、独立或暂不使用 {#connection}

1. 进入“设置 → 计算与模型”，选择自动识别、独立部署或暂不使用。
2. 自动识别读取部署提供的连接；独立部署填 Go 可达的节点地址与认证，或在受限局域网发现并配对。
3. 设置计算节点可以访问的 Go 回源地址，不能只验证 Go 能访问节点。
4. 执行连接测试，确认身份、内部认证及回源链路，再保存。
5. 使用少量真实素材试跑探测、转码或伴奏任务，确认实际功能。

健康页正常只说明进程存活，模型就绪、硬件可用与素材试跑是不同结论。切换节点不会把旧任务不加核对地转发给新节点。

## 同机 Compose 的可选节点 {#same-stack}

正式发行部署默认只启动 Go。同一组合需同时启用 profile 并填写内部节点地址，再沿用原配置启动：

```sh
# singverse-go-backend/.env
COMPOSE_PROFILES=compute
COMPUTE_NODE_URL=http://singverse-compute:8090
COMPUTE_RUNTIME=base
```

本地 `make docker-local-up` 会从所选源码构建 Go 和 compute，和正式镜像路线不同。不要只看宿主 18090 端口，就把容器内部应使用的服务名地址换成 localhost。

## 选择计算镜像、仓库与版本 {#image-version}

计算镜像独立发布到 GHCR、Docker Hub 和阿里云 ACR，地址为 `<IMAGE_PREFIX>/singverse-compute:<COMPUTE_VERSION>-<COMPUTE_RUNTIME>`。例如版本 `1.2.3` 配合 `base` 得到标签 `1.2.3-base`；示例版本需替换为目标空间实际发布的版本。

`IMAGE_PREFIX` 按[镜像仓库说明](/docs/getting-started.html#image-registry)设置为域名与命名空间，`COMPUTE_VERSION` 单独固定计算端版本，`SINGVERSE_VERSION` 只控制 Go。正式部署建议固定已验收版本；`latest-base` 等标签会随后续成功发布更新。

| 运行库 | 镜像架构 |
| --- | --- |
| `base`、`cpu`、`uvr` | linux/amd64 与 linux/arm64 |
| `cuda`、`rocm`、`rocm-native`、`openvino` | linux/amd64 |
| `rknn` | linux/arm64 |

同机组合共用主服务的镜像前缀，独立节点在自己的部署配置中选择前缀。镜像空间由[发布 Actions 参数](/docs/operations.html#image-publishing)指定，不决定 Compose 项目名；独立节点继续使用原项目名（默认 `singverse-compute-node`）以保留原卷。镜像运行库仍需匹配宿主驱动、设备映射与模型。

## 独立节点与双向回源 {#callback}

独立节点默认只监听 `127.0.0.1:18090`；跨主机时需绑定受限 LAN 地址。Go → compute 用于任务与结果，compute → Go 用于带授权的媒体读取，两条链路都必须可达。

```sh
# Go 服务的回源根地址示例：换成计算主机可达的地址
SINGVERSE_CALLBACK_ORIGIN=http://192.168.1.100:18080
```

计算节点不需要挂载相同媒体路径，也不持有 WebDAV 密码；Go 保留原件访问和路径校验，节点凭受限任务读取。发现、配对、凭据恢复需在当前受限网络内完成。

## 直放、实时转码与离线版本 {#compatibility}

| 模式 | 何时使用 | 保存与依赖 |
| --- | --- | --- |
| 原片直放 | 设备支持容器、音视频编码和输出方式 | Go 代理原媒体；WebDAV 可按需缓存原字节块 |
| 实时兼容播放 | 设备无法解码，需要转换当前媒体 | 由节点输出兼容资源，成功成品可接收到 NAS 缓存 |
| 离线兼容版本 | 经常使用不兼容素材，希望提前准备 | 任务完成后由 Go 持久保存，独立于可淘汰缓存 |

电视先尝试本机解码；符合解码类错误时，同次演唱最多自动请求一次兼容资源，常见输出为 H.264/AAC-LC。网络、鉴权和音频路由故障不会被一律当作转码问题。

兼容资源按素材指纹、画质、编码、音轨、字幕和终端能力隔离。切原伴与定位可能需要重新协商，仍应保留原媒体时间轴和暂停状态。

## 视频加速与音频推理分开配置 {#hardware}

视频转码后端与伴奏推理运行库不是同一件事。Docker 音频运行库可选 base、cpu、uvr、cuda、rocm、rocm-native、openvino、rknn；实际架构与模型需按运行库核对。

| 硬件方向 | 需要核对 |
| --- | --- |
| NVIDIA | 宿主驱动、Container Toolkit、设备映射、视频编码器与音频 CUDA 环境 |
| Intel / AMD DRI | render 设备、组权限，QSV/VAAPI 视频能力与音频运行库分别测试 |
| Rockchip | 匹配 BSP，MPP/RGA 视频与 RKNN 音频不是同一种设备映射 |
| Apple Silicon | 原生节点的 VideoToolbox/Metal/MPS，Docker Desktop 不直接提供这些能力 |
| CPU | 软件能力及内存预算，速度不保证达到实时 |

保存硬件选择前需通过实际短样本编码。已检测 GPU、支持编码器、硬解、零拷贝、HDR 映射和当前素材成功是不同级别证据，不能相互替代。

## 模型、试跑与并发 {#models}

镜像不包含模型权重，管理员按固定清单下载或受控导入，再试跑并选择。音频模型与输出配方以节点真实能力为准，旧版高级路线可能需要额外运行库。

转码默认总并发 1，可配置 1～16；上限不是推荐并发。先用自己的分辨率、编码、码率、字幕和音轨试跑，再逐步增加。实时请求会优先于离线处理，离线任务可能被重排。

## Mac 原生节点与 Docker 业务 {#macos}

在 compute 仓库先准备虚拟环境与固定媒体工具；在 Go 仓库 `.env.local` 设置 `SINGVERSE_MACOS_CALLBACK_ORIGIN` 为 Mac 可达的 Go 地址，再执行 `make docker-macos-up`。

该组合让 Go 通过 `host.docker.internal:18090` 访问原生节点，节点由用户 launchd 管理。后续沿用同一组合维护；Docker compute 与原生节点占用相同端口，切换前先停止当前节点。

## 节点离线和播放失败 {#failure}

1. 检查 Go 服务本身与原媒体可读性，排除把路径或 WebDAV 错误当作 GPU 问题。
2. 分别测试节点连接和回源，回源失败重点看容器 localhost、绑定 IP、端口、防火墙与代理。
3. 核对模型、运行库、设备权限和真实任务错误；健康正常不等于模型已就绪。
4. 节点重启后，实时播放需要重建；离线队列按持久任务核对重试，不发布半成品。
5. 已有缓存仍可管理，普通点歌和可直放播放继续使用。没有可用转换能力时，先准备目标设备可播放的媒体。

继续阅读：[原唱与伴奏](/docs/audio.html)、[缓存与容量](/docs/advanced.html#cache)、[排障](/docs/faq.html)。
