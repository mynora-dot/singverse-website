# SingVerse 官网与文档

产品首页、客户端下载说明和 18 篇使用指南，采用 **Astro + Starlight**。首页保留现有产品视觉，文档通过 Markdown 维护，目录和 Pagefind 全文搜索在构建时生成。

源码、内容和构建统一在本项目；生产环境是一个 Nginx 容器，只提供静态文件，不运行 Node，也不连接 NAS、数据库或业务后端。当前的产品介绍、部署与使用文档无需动态接口。后续有实际动态功能时，可在本项目增加 Astro 服务端路由及对应适配器，再调整运行镜像；这需要重新配置认证、请求限制和服务端密钥，不直接套用当前静态容器。

本项目独立于 `singverse-frontend` 管理端和 NAS 下载页面，更新官网不会更新 NAS 服务或客户端。内容核对日期为 **2026-11-15**，基于相邻仓库的当前工作区；能力以实际部署版本为准。

## 本地开发与检查

Node 版本要求见 `package.json`，Docker 构建使用固定版本的工具链。依赖由 `package-lock.json` 锁定，`.npmrc` 关闭未使用框架的 peer 自动安装，Astro/Starlight 必需的 peer 显式声明。

```sh
npm ci
npm run dev
```

开发服务仅监听 `127.0.0.1:5174`，可用 `npm run dev -- --port 5184` 指定端口。搜索索引在生产构建时生成，验证搜索请构建后预览：

```sh
npm run check
npm run preview -- --port 5184
npm run check:dependencies
```

`check` 执行 Astro 类型检查、生产构建、安全响应头生成及内容检查，产物为 `dist/` 和 `.build/security-headers.conf`。内容检查覆盖旧版 20 个页面、18 篇文档的 176 个章节锚点、站内链接与搜索产物；额外生成 404 页面和文档首页兼容文件。依赖审计包含构建依赖，高危及以上问题会失败。

## Docker 部署

在本目录执行：

```sh
docker compose up -d --build --wait
```

默认访问 `http://127.0.0.1:18081`。容器限制为 64 MiB 内存、0.5 CPU、64 个进程，使用一个 Nginx worker；这些是资源上限，实际占用随连接数和访问负载变化。更新后重新执行同一命令，停止使用 `docker compose down`，网站不需要持久卷。

64 MiB 限额只针对运行容器。Node 构建阶段需要额外内存；部署主机资源很少时，在开发机或 CI 构建镜像后再分发运行。

也可使用工作流发布的固定版本镜像，部署机无需构建。以下版本号仅为格式示例，需替换为已发布版本；私有仓库先执行对应的 `docker login`：

```sh
export WEBSITE_IMAGE=ghcr.io/mynora-dot/singverse-website:0.0.1
docker compose pull
docker compose up -d --no-build --wait
```

`WEBSITE_IMAGE` 也可写入本机未跟踪的 `.env`。Docker Hub 和阿里云地址、发布凭据及重试规则见[镜像发布](infra/docker/PUBLISHING.md)。

部署后可运行 HTTP 验证，覆盖旧链接、无扩展名链接、搜索资源、响应头、404 和方法限制：

```sh
npm run check:http
# 自定义端口时显式指定目标
npm run check:http -- http://127.0.0.1:18082
docker compose logs --tail=50
```

公网使用已有 HTTPS 反向代理转发到回环端口，并在代理配置证书、HSTS 和访问限制。代理容器若独立运行，需要明确配置可达的网站入口或共享专用网络；容器中的 `127.0.0.1` 指向自身。默认使用项目独立的 bridge 网络，网站进程无需主动访问外网，但该配置不实施网络层的出站封禁。需要局域网直接访问时，部署命令可显式指定绑定地址：

```sh
WEBSITE_BIND=192.168.1.100 WEBSITE_PORT=18081 docker compose up -d --build --wait
```

不要把 NAS 管理入口、登录 Cookie、主密钥、媒体目录或 Docker socket 配给官网容器。下载页只在浏览器生成输入地址的 `/downloads/` 链接，不请求、保存或代理该 NAS 地址。

## 镜像发布

`.github/workflows/website-images.yml` 参照后端发布方式，仅在正式 GitHub Release 发布后运行。标签采用 `vMAJOR.MINOR.PATCH`；普通 push、PR、草稿及 Pre-release 不触发发布，不增加独立测试或 lint job。

工作流锁定标签提交，在原生 amd64、arm64 runner 分别构建并保存 OCI 归档，再把同一份产物发布到 GHCR、Docker Hub、阿里云 ACR，镜像名统一为 `singverse-website`。只发布数字版本 `<VERSION>` 和 `latest`，二者均包含双架构，不再额外发布架构标签；三家固定版本全部成功后更新 `latest`。已有固定标签只接受相同摘要，失败重跑复用 Release 归档。历史标签不会自动删除，数字版本随发布累积。

Actions Variables 和 Secrets 与后端同名，但需要在官网仓库配置或通过组织授权共享。完整配置见[镜像发布](infra/docker/PUBLISHING.md)。本地可运行 `npm run check:release` 检查发布脚本的版本校验、归档校验、固定标签保护及三仓库发布顺序；需要 Python 3.9 或以上版本。

## 安全设置

- 多阶段构建，运行镜像仅含 Nginx 和公开站点产物；Docker 构建上下文使用允许列表，排除本地环境变量、Git、依赖缓存与原始文档之外的工作区文件。
- UID/GID `101:101`、只读根文件系统、去除全部 capabilities、禁止提权；临时写入仅允许容量受限的 `/tmp`，不使用宿主目录挂载。
- 仅允许 GET/HEAD，隐藏文件及未知路径返回 404，关闭目录列表与服务器版本号。日志仅记录路径，不记录 URL 查询参数。
- CSP 默认禁止资源，脚本只允许同源资源与本次构建生成的 SHA-256 哈希；禁止内联事件处理、JavaScript eval、页面嵌入及对象插件。Pagefind 的 WebAssembly 使用单独的 `wasm-unsafe-eval` 权限。现有插图保留内联样式属性。
- `nosniff`、禁止嵌入、无 Referer 和摄像头/麦克风/定位禁用响应头覆盖成功和错误响应。HTTPS、HSTS 由外层 TLS 代理负责。

每次修改 HTML 后都必须重新构建，安全哈希与产物配套复制。依赖与基础镜像仍需要定期更新；`npm run check:dependencies` 审计 npm 依赖，镜像可用 `docker scout cves singverse-website:local` 或现有镜像扫描流程检查。容器隔离和响应头不能替代宿主机、反向代理及供应链维护。

## 内容维护

| 位置 | 用途 |
| --- | --- |
| `src/pages/index.astro`、`download.astro` | 产品首页与下载说明 |
| `src/content/docs/*.md` | 18 篇 Markdown 指南 |
| `src/components/`、`src/layouts/` | 共享导航、文档标题、搜索与页面布局 |
| `astro.config.mjs` | 文档分组、Starlight 及静态构建配置 |
| `scripts/legacy-anchors.json` | 已有文档路径和章节 ID，防止深链接丢失 |
| `infra/nginx/nginx.conf` | 静态文件服务及请求边界 |

文档 frontmatter 必须包含标题、描述、固定 `slug`、`verifiedAt` 与分组。章节用 `## 标题 {#原有-id}` 显式保留深链接；新增文档时更新侧栏和内容检查基准。旧 `/docs/*.html` 和无扩展名链接均可访问，站点默认部署于域名根路径。

正式域名确定后，在 `astro.config.mjs` 设置 Astro 的 `site` 再构建，以生成对应 sitemap；当前未指定正式域名，因此构建时跳过 sitemap。

搜索在构建时读取真实页面内容生成索引，查询与结果渲染均在浏览器完成，不维护额外后端服务。事实依据与功能边界见 [CONTENT_SOURCES.md](CONTENT_SOURCES.md)，设计稿、样例数据和历史验证不能作为已发布能力或设备验收结论。
