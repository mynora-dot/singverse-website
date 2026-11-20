---
title: "硬件与模型部署"
description: "分别核对视频转码、音频推理、宿主设备和模型文件，按真实试跑结果启用加速。"
slug: "docs/hardware"
verifiedAt: "2026-11-20"
group: "部署"
---

## 四种镜像怎么选 {#choose}

| 硬件 | 运行库 | 视频默认 | 音频路径 | 首先检查 |
| --- | --- | --- | --- | --- |
| A3000 / NVIDIA | CUDA | NVENC | CUDA / 独立 CPU 降级 | NVIDIA 驱动、Container Toolkit |
| 780M / AMD | ROCm | VAAPI | htdemucs 的 Torch/HIP | amdgpu、KFD、DRI、gfx1103 运行库 |
| N100 / Intel 核显 | OpenVINO | QSV | OpenVINO / 独立 CPU 降级 | DRI render 节点、Intel 驱动 |
| RK3566 | RKNN | auto；MPP 可选 | 固定目标的 RKNN 模型 | BSP、RKNPU、运行库、设备树 |

四种镜像都带独立 CPU 降级环境，不另发布 CPU 镜像。视频可用、音频运行库可加载、模型试跑成功是三个不同检查。后台已经保存的硬件选择会覆盖环境默认；切换硬件后选择“跟随部署”并重新试跑。

## NVIDIA A3000 {#nvidia}

宿主 `nvidia-smi` 应能列出目标显卡，还需安装并配置 NVIDIA Container Toolkit。生成器使用 GPU reservation 选卡，默认宿主 GPU 0；多卡时填写正确编号或 UUID，容器内 CUDA 逻辑编号保持 0。

```sh
nvidia-smi -L
docker compose -f docker-compose.yaml exec -T singverse-compute nvidia-smi
docker compose -f docker-compose.yaml exec -T singverse-compute /usr/lib/jellyfin-ffmpeg/ffmpeg -hide_banner -loglevel error -f lavfi -i color=s=1280x720:r=25:d=1 -vf format=nv12 -c:v h264_nvenc -frames:v 10 -f null -
```

这条短命令检查 H.264 编码。随后在管理端检查真实素材的解码、转码和音频模型；不要只凭 `nvidia-smi` 或编码器名称授予完整能力。

## AMD Radeon 780M {#amd}

宿主需要 `amdgpu`/KFD 驱动和兼容固件，计算端映射 `/dev/kfd`、`/dev/dri`。默认 VAAPI 设备 `/dev/dri/renderD128`，厂商应为 `0x1002`，驱动为 `amdgpu`。多卡时分别核对 DRM 节点与 `HIP_VISIBLE_DEVICES`，两套编号没有一一对应关系。

```sh
ls -l /dev/kfd /dev/dri
cat /sys/class/drm/renderD128/device/vendor
readlink -f /sys/class/drm/renderD128/device/driver
docker compose -f docker-compose.yaml exec -T singverse-compute /usr/lib/jellyfin-ffmpeg/ffmpeg -hide_banner -loglevel error -vaapi_device /dev/dri/renderD128 -f lavfi -i color=s=1280x720:r=25:d=1 -vf format=nv12,hwupload -c:v h264_vaapi -frames:v 10 -f null -
```

当前 ROCm 镜像在系统 Python 中安装固定 Torch/HIP 与原生 `gfx1103` 设备包。不要设置 `HSA_OVERRIDE_GFX_VERSION` 伪装架构；此配置不能修复不兼容的宿主固件。

**htdemucs 的 ROCm 与 MDX“干净档”的 MIGraphX 是不同推理路径。** 当前 Dockerfile 的 Torch/HIP 安装不能证明 MDX provider 已存在。后台未检测到 MIGraphX 时，干净档只能在独立 CPU 已试跑且降级策略允许时使用 CPU；不能写成“780M 加速成功”。

## Intel N100 / 核显 {#intel}

使用 `latest-openvino`，映射 `/dev/dri`，默认 QSV 视频和 `renderD128`。确认该节点属于 Intel；多显卡主机修改生成器中的 render 路径。这里沿用新的 root + 绑定目录方式，无需照抄旧 N100 样例的固定 GID 或 NAS 私有路径。

```sh
ls -l /dev/dri
cat /sys/class/drm/renderD128/device/vendor
readlink -f /sys/class/drm/renderD128/device/driver
```

Intel 厂商标识应为 `0x8086`。后台分别执行视频试跑和 OpenVINO 模型试跑；QSV 通过不能代替模型加载与实际推理验证。

## RK3566 测试 {#rk3566}

默认项目 `singverse-rk3566-test`、端口 18081、ARM64。预算按约 4 GiB 板端设置，2 GiB 主机需重新评估。默认 NPU 映射来自已记录的一种板端布局：card0、renderD128，并将同一 renderD128 映射为容器 renderD129 别名供 Lite2 使用。其他 BSP 必须核对。

```sh
uname -m
ls -l /dev/dri/card0 /dev/dri/renderD128 /usr/lib/librknnrt.so
readlink -f /sys/class/drm/card0/device/driver
readlink -f /sys/class/drm/renderD128/device/driver
tr '\0' '\n' < /sys/firmware/devicetree/base/compatible
```

NPU 节点驱动应为 `rknpu`。宿主提供与镜像 Lite2 2.3.2、BSP 匹配的 ARM64 `librknnrt.so` 和真实设备树。生成器的文件挂载禁止自动创建不存在路径；不要把缺失库建成同名目录。部分 BSP 受设备树访问与容器隔离影响，应先看日志定位，生成器不自动关闭安全隔离。

模型不随镜像提供，需要在数据根目录下手工放置：

```text
singverse-audio-models/
  uvr-mdxnet-9482-rknn/
    manifest.json
    uvr.rknn
  uvr-mdxnet-9482/
    UVR_MDXNET_9482.onnx
```

RKNN 模型必须针对 `rk3566` 转换并通过清单校验，不能复制 rk3588/rk3568 模型冒充。干净档还要求固定 MDX ONNX 基准模型，可通过后台下载支持的 ONNX 模型；RKNN 转换目录需手工准备。

```sh
docker compose -f docker-compose.yaml exec -T singverse-compute python -c 'from rknnlite.api import RKNNLite; print("Lite2 import OK")'
docker compose -f docker-compose.yaml exec -T singverse-compute python -c 'from singverse_compute.infrastructure.rknn_audio import Forward; r=Forward("/var/lib/singverse-models/uvr-mdxnet-9482-rknn"); r.close(); print("NPU init OK")'
```

默认不映射 MPP，视频 auto 根据试跑资格和 CPU 降级策略选择。需要 MPP 时，先确认 `/dev/mpp_service`、`/dev/rga`、`/dev/dma_heap` 存在，再在生成器启用并试跑 `rkmpp`。NPU 音频通过不代表视频硬件已经可用。

## 资源预算与试跑 {#resources}

| 预设 | 管理端内存 | 计算端内存 | 音频进程预算 | 媒体进程预算 |
| --- | --- | --- | --- | --- |
| A3000 / 780M | 2 GiB | 6 GiB | 4 GiB | 1 GiB |
| Intel | 1 GiB | 4 GiB | 2 GiB | 1 GiB |
| RK3566 | 768 MiB | 2 GiB | 1280 MiB | 512 MiB |

这些是配置初值，不是硬件最低规格保证。宿主还需留出系统和核显共享内存；提高并发时同时核对资源预算。模型、驱动、运行库或镜像变化后重新试跑；短任务通过后再做完整歌曲和长时间播放验收。

## Apple Silicon {#macos}

Mac 使用 compute Release 的原生 ARM64 安装包，通过 `Install.command`、`Start.command` 配置原生节点。MPS/MLX/VideoToolbox 依赖原生系统，Linux Docker 容器无法提供。Go 容器可以连接宿主节点，但节点回调必须访问 Go 已发布的业务入口，详情见[计算服务](/docs/compute.html#remote)。
