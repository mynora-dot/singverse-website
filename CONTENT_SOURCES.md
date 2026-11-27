# 文档依据与验证边界

核对日期：2026-11-20（Asia/Shanghai）。本轮完整替换旧指南正文，以当前本地源码和已整理的单文件部署配置为依据。不是远端 Release 的发布证明，也不把此前 demo、设计图或历史真机记录当成本轮验收。

## 权威来源

下列路径相对总工作区 singverse-all。网站构建不依赖这些检出；只有显式运行来源检查时读取指定目录。

| 内容 | 对照来源 |
| --- | --- |
| 业务环境变量和约束 | `singverse-go-backend/internal/platform/config/config.go` |
| 计算变量、单位与范围 | `singverse-compute/singverse_compute/core/config.py` |
| 镜像架构、Python 路径、运行库 | 两个仓库的 `infra/docker/build/*.Dockerfile`、compute 锁文件和 `core/audio_runtime.py` |
| A3000 / 780M / RK3566 | Go 的 `infra/docker/a3000/`、`amd780m/`、`rk3566/` 单文件配置与 README |
| Intel | Go 的 N100 配置及 DRI/OpenVINO 运行库；去掉特定 NAS 地址、曲库绝对路径、固定 GID，按新的 root 绑定目录方式生成 |
| 单机与独立计算 | 两仓库 `infra/docker/compose/`、compute 的 `infra/docker/GPU.md` |
| ROCm 与 MDX 区别 | compute 的 `application/audio_models.py`、`application/separation_engine.py`、`infrastructure/separation_worker.py`、`infrastructure/rocm_audio.py` |
| 导航名称 | `singverse-frontend/src/admin/app/navigation.ts`，缺歌心愿归入“加歌” |
| 来源、识别与资料 | Go 的 `docs/media-library.md`、`media-scan-schedule.md`、`filename-rules.md`、`metadata-scraping.md`、`contracts/metadata/` |
| 下载与资料包 | Go 的 `docs/lx-downloads.md`、`contracts/metadata/package-v4.md` |
| 客户端、收藏、亲友、任务 | 手机/TV README，Go 的 `contracts/favorites.md`、`party-remote.md`、`tv-login-pairing.md`、`background-tasks.md` |
| 密码、MFA、恢复和备份 | Go 的 `docs/authentication.md`、`contracts/auth-login.md`、`infra/docker/OPERATIONS.md` |
| 发行及内嵌 APK | Go README、`infra/docker/PUBLISHING.md`、组件发行流程 |

源码与旧 README 冲突时优先当前实现。例如 ROCm 已使用统一系统 Python 与设备包，不照抄旧的双 GPU 虚拟环境描述；计算端是否提供 MDX/MIGraphX 以实际 provider 检测为准。

## 配置选择

生成器支持四种硬件、同机组合/仅管理端/独立计算、AMD64/ARM64 管理端、SQLite/已有 MySQL、独立版本、绑定目录、端口、资源预算、反向代理，以及可选 RK MPP。

管理端 25 项非 MySQL 配置与 MySQL 的 5 项、计算端 17 项均有解释和输出覆盖。另说明 TZ、镜像变体、NVIDIA、ROCm、VAAPI 辅助变量及 Compose 参数。56 条参数记录包含分别解释的两端共享 token 字段。

固定下载模板与页面预览共用 `compose.mjs`，不保留第二套手工硬件 YAML。用户数据全部保存在主动下载的文件或当前页面内存，不写浏览器存储、不发送请求验证 NAS、密码或镜像。

## 验证方式

- `npm run check` 运行 Astro 类型检查和生产构建，再核对代码复制、参数正文、站内链接和 Pagefind 产物。

## 本轮实际结果

2026-11-20 在本机完成：

- 16 项生成器行为测试通过；Astro 类型检查无错误、无警告，保留原有 `document.execCommand` 弃用提示。
- 生产构建和内容检查通过：22 篇指南、56 条参数记录、17 个可复制代码块、1591 条站内链接。
- 管理端源码 30 项、计算端源码 17 项参数覆盖比对通过；Docker Compose v5.5.0 成功解析 18 组配置。
- 隔离容器收到的合成测试值与原字符串一致，覆盖 `$HOME`、`${...}`、连续美元符号、引号、反斜杠和中文。
- 真实 Chrome 在 390 px 与 1536 px 下检查全部指南，生成器切换、校验、剪贴板、下载文件内容、参数搜索均通过；没有配置持久化、外部请求或脚本/CSP 错误。
- 隔离 Nginx 实例的 69 项 HTTP 检查通过，包含页面、六份 YAML 模板、搜索文件、响应头与请求限制。

静态配置或本机浏览器检查不代表镜像标签存在、GPU/NPU 模型通过、外部音乐平台可用或 NAS 部署成功。本轮未改变业务数据或部署目标主机，未发布网站或推送镜像。
