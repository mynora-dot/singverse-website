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

本次镜像发布与部署说明更新后，`npm run check` 完成内容检查与生产构建。内容检查覆盖 20 页、176 个文档章节、200 个搜索入口和 1,018 处站内资源/链接，包含共享导航的重复项。新增三个章节由现有流程自动进入站内搜索；本次没有修改视觉样式。

以下浏览器记录来自本次镜像说明更新前的官网验证，不能代替修改后的页面浏览器验收：

浏览器验证使用构建后的 `dist/` 与本机临时预览，通过已有 Playwright 和无痕 Chrome 执行。20 页在 1440×1000、390×844 下各检查一遍（共 40 组），没有页面级横向溢出、破图或 JavaScript 异常；另检查 768px 平板布局。

交互检查包含：首页设备页签与点歌演示、七组关键词搜索及键盘打开结果、部署命令复制、手机本页目录与侧栏导航、下载链接的 IPv4/HTTPS/IPv6、回环提醒、空输入、非法协议及带凭据地址。桌面与手机截图共十张，保存在任务临时目录，不进入网站源码或发布包。应用内浏览器控制连接超时，因此浏览器验证使用了本机已有的无痕 Chrome；不是 NAS、微信或硬件设备验收。

本次网站检查没有连接生产 NAS、镜像仓库、真实歌曲目录、手机/电视设备或 GPU，也没有推送镜像或发布网站。外部元数据平台、AI、音源、微信和硬件链路的可用性不由网站验证证明。
