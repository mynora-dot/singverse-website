# 内容依据与核对记录

日期：2026-11-15，Asia/Shanghai。以下路径相对总工作区 `singverse-all`，基于本地源码工作区，不能当作远程 Release 的功能清单。

## 来源优先级

1. 管理端实际导航 `singverse-frontend/src/admin/app/navigation.ts`。
2. Go 当前权威契约与实现，配套 Vue、Flutter、TV 的当前页面和能力。
3. 各仓库 README 与维护文档。
4. 设计目录中的生产实现和验证记录，仅用于补充实现经过与验证边界，不把原型或样例数据当作正式产品数据。

涉及新增亲友协议时，以当前 `contracts/party-remote.md` 及实际 Go/Vue/TV 为准；较早的收藏、活动或设计说明可能仍描述旧的亲友权限。官网明确区分当前工作区和实际部署版本。

## 页面对应资料

| 页面 | 主要依据 |
| --- | --- |
| 文档首页、产品首页 | 五个业务仓库 README、管理导航、架构与当前功能实现 |
| 部署与首次登录 | `singverse-go-backend/README.md`、`.env.example`、`infra/docker/README.md`、`infra/docker/OPERATIONS.md`、`infra/docker/PUBLISHING.md`、`infra/docker/compose/compose.yaml` |
| 歌曲来源与曲库 | `singverse-go-backend/docs/media-library.md`、`docs/media-scan-schedule.md`、前端歌曲来源与歌曲管理模块 |
| 文件名识别 | `singverse-go-backend/docs/filename-rules.md`、前端来源内方案/格式工作台、前端 README |
| 歌曲信息与审核 | `singverse-go-backend/docs/metadata-scraping.md`、`docs/single-song-review.md`、`docs/batch-metadata-workbench.md`、`contracts/metadata/` |
| 原唱、伴奏与歌词 | 前端 `src/admin/modules/audio-processing/`、`AudioRolesPanel.vue` 与分离组件、TV/手机播放实现、`contracts/party-remote.md` |
| 下载歌曲与资料包 | `singverse-go-backend/docs/lx-downloads.md`、`docs/media-library.md`、`contracts/metadata/package-v4.md`、前端来源导入流程 |
| 家庭收藏与歌单 | `singverse-go-backend/contracts/favorites.md`、`contracts/party-remote.md`、`docs/playlists.md`、三端共享收藏实现 |
| 电视端 | `singverse-tv/README.md`、`singverse-go-backend/contracts/tv-login-pairing.md`、`contracts/party-remote.md`、TV 播放与队列实现 |
| 手机练唱与录音 | `singverse-mobile/README.md`、`singverse-go-backend/contracts/mobile-karaoke.md`、`contracts/tv-login-pairing.md`、手机播放器与作品实现 |
| 亲友点歌与公平轮唱 | `singverse-go-backend/contracts/party-remote.md`、`singverse-frontend/src/party/`、Go 公平队列与 TV 实现、`docs/亲友点歌H5重设计-20261115/production/` |
| 播放与热门、缺歌心愿 | `singverse-go-backend/contracts/song-activity.md`、`contracts/party-remote.md`、当前管理导航与反馈页面 |
| 任务中心 | `singverse-go-backend/contracts/background-tasks.md` 与前端任务模块 |
| 计算节点与兼容播放 | `singverse-go-backend/docs/compute-architecture.md`、`docs/transcoding.md`、`infra/docker/GPU.md`、`singverse-compute/infra/docker/README.md`、`infra/docker/compose/compose.compute.yaml`、`.github/workflows/singverse-compute-images.yml` |
| 存储、外观与 AI 设置 | `singverse-go-backend/contracts/song-cache.md`、`docs/ai-settings.md`、`docs/transcoding.md`、前端缓存与电视首页页面 |
| 账号、安全与隐私 | `singverse-go-backend/contracts/auth-login.md`、`docs/authentication.md`、`contracts/tv-login-pairing.md`、各能力的数据边界 |
| 备份、升级与维护 | `singverse-go-backend/infra/docker/OPERATIONS.md`、`infra/docker/PUBLISHING.md`、`.github/workflows/platform-release.yml`、`infra/docker/release.py`、compute 镜像工作流与发布脚本、客户端发行与更新契约、亲友协议发布顺序 |
| 常见问题、下载说明 | 对应专题来源及当前下载表单行为 |

## 已纠正的旧说明

- 亲友 H5 已有按人公平轮唱、唯一下一首优先位、公平打乱、进度遥控、互动、家庭收藏和缺歌反馈。
- 新版有效参与者均可遥控；普通亲友撤自己的歌，主持可撤所有人的待唱，电视保留锁队、清空、散场与授权管理。
- 新版空闲时首首入队自动开唱；手动停止保持停止，明确开始后继续，Go 统一推进自然结束和切歌。
- 原伴标记保存与电视应用分开反馈；保存成功不能被写成电视必然已切换。
- 播放与热门、缺歌心愿使用当前“客厅”导航；歌单使用当前“曲库 → 歌单”。
- 手机录唱草稿不等于已保存作品；作品本机保存，不因 NAS 共享收藏而自动上传。
- 下载卷保存真实歌曲，不能与可重建的临时缓存混为一类；compute 缓存卷也含硬件/模型设置。
- AI 助手仅有展示入口，对话和工具能力尚未开放。
- 正式组件产物准备顺序与运行协议升级顺序分别说明，不把二者混淆。
- 镜像可发布到 GHCR、Docker Hub、阿里云 ACR，空间由 Actions 输入参数或仓库 Variables 选择；官网不固定组织名，也不把配置完成写成远程发布已完成。
- 部署 `IMAGE_PREFIX` 表示仓库域名与命名空间；它与 Compose 项目名、数据卷归属不同。Go 与 compute 各用独立版本，镜像标签不带 Release 标签开头的 `v`。

## 本地验证范围

2026-11-15 将官网从 Vite 多页面迁移到 Astro 7.4.12 + Starlight 0.43.1，指南改为 Markdown。首页与下载说明保留原有产品视觉和交互；生产使用一个 Nginx 静态容器，当前没有动态业务接口、数据库或常驻 Node 服务。后续动态功能的扩展边界见 README。

- 迁移前后逐篇比较 18 篇指南的正文，忽略框架新增的目录、锚点辅助标签和提示标题后，文字一致。
- 20 段命令示例的 Markdown 源文与复制按钮内容逐段一致，保留注释；不使用代码组件默认的注释剥离行为。
- `npm run check` 通过 Astro 类型检查、生产构建、安全头生成和内容检查：22 个 HTML 文件（含 404 与一个文档首页兼容副本）、18 篇指南、176 个旧章节锚点、20 个代码块、1,534 处站内资源/链接。
- Pagefind 索引实际包含 20 个公开页面，排除 404 与兼容副本；不再维护单独的手写搜索摘要。
- Docker 在 `linux/arm64` 与 `linux/amd64` 下完成构建。两种运行镜像各通过 55 项 HTTP 检查，包含旧 `.html` 入口、无扩展名入口、搜索文件、响应头、隐藏文件拦截、404 与方法限制。
- 本机无痕 Chrome 访问 ARM 容器，20 个页面在 1440×1000 和 390×844 下各检查一遍（共 40 组），并检查 768px 平板布局。未发现页面横向溢出、破图、JavaScript 异常、CSP 违规或外部网络请求。
- 交互覆盖首页设备页签与点歌演示、七组中文/英文关键词搜索与键盘导航、代码复制、手机本页目录与侧栏、下载地址生成、回环提示、非法协议、空地址及凭据地址拒绝。下载表单未连接输入的 NAS。
- 实际进程为 UID/GID `101:101`，无 Node/npm，capabilities 为零，`NoNewPrivs=1`。只读根文件系统、16 MiB 临时盘、64 MiB 内存、0.5 CPU、64 个 PID 限制与回环端口映射均已核对。
- Docker Desktop 本机测得空闲约 3.4 MiB，24 个并发客户端的 1,200 次请求验证期间约 4.1 MiB；请求全部成功，未发生 OOM 或容器重启。这是本次本机验证样本，不是 NAS 或公网容量保证；构建阶段内存另计。
- npm 审计包含构建依赖，本次未报告已知漏洞。运行镜像使用 Trivy 0.76.2 和当日更新的漏洞库检查，未报告 HIGH/CRITICAL 漏洞；不代表不存在尚未披露或扫描范围之外的问题。基础镜像版本与摘要固定在 Dockerfile，后续仍需更新和复查。

浏览器报告与截图位于任务临时目录 `/private/tmp/singverse-website-astro-qa/`，镜像扫描报告位于 `/private/tmp/singverse-website-image-scan/cache/`，均不进入网站源码或发布包。x86 容器通过 Docker Desktop 仿真验证，未作实体 x86 NAS 验收。默认网络采用独立 bridge 并仅发布回环端口，不承诺网络层的出站封禁；公网 HTTPS 与 HSTS 由外层代理配置。

本次未连接生产 NAS、真实歌曲目录、手机/电视设备或 GPU，未推送镜像或发布网站。外部元数据平台、AI、音源、微信与硬件链路的可用性不能由官网验证证明；业务功能仍以实际部署版本为准。
