# SingVerse 官网与文档

Astro + Starlight 静态站。2026-11-20 依据当前 Go、compute、客户端契约和 A3000 / 780M / RK3566 部署配置，完整重写使用文档，并加入纯浏览器 Docker Compose 生成器与逐项参数手册。

主入口：

- `/docs/index.html`：文档首页。
- `/docs/getting-started.html`：从现有镜像完成首次部署。
- `/docs/compose.html`：服务、硬件、数据库、目录、资源和代理配置生成器。
- `/docs/parameters.html`：管理端、MySQL、计算端与驱动的 56 条参数说明。
- `/docs/hardware.html`：设备映射、驱动、运行库、模型和试跑。

文档共 22 篇。旧文档正文已替换；既有页面 URL 继续保留，章节按新内容重新组织。产品首页沿用现有设计，部署入口和说明已指向新流程。官网不连接 NAS，不保存管理员凭据，也不是业务管理页面。

## 开发与检查

使用 package.json 指定的 Node 版本与已锁定依赖：

```sh
npm ci
npm run dev
```

默认监听 `127.0.0.1:5174`。生产构建才生成 Pagefind 全文索引；验证搜索使用构建预览。

```sh
npm run check
npm run preview -- --port 5184
```

- `check`：Astro 类型检查、静态构建及产物检查。
- `check:content`：检查所有页面、Markdown/MDX 命令复制、参数解释、站内链接、章节和搜索产物。

## 生成器维护

| 文件 | 用途 |
| --- | --- |
| `src/lib/deployment/compose.mjs` | 硬件默认值、字段校验、Compose 模型、YAML 输出和提示 |
| `src/lib/deployment/parameters.mjs` | 真实环境变量名称、默认值、类型、用途与修改影响 |
| `src/components/deployment/ComposeBuilder.astro` | 配置表单、预览、复制、下载和错误定位 |
| `src/components/deployment/ParameterReference.astro` | 渲染参数说明，避免人工复制多份正文 |
| `scripts/deployment-assets.mjs` | 用相同生成逻辑构建六个固定下载模板 |

生成器默认使用相对目录绑定、容器 root 和内置字面参数，不需要 `.env`、命名卷或 chown。支持同机组合、仅管理端和独立节点；数据库为 SQLite 或已有 MySQL，不自动创建 MySQL。所有输入只在当前页面内存使用，无 localStorage、sessionStorage、表单上传或 URL 参数保存。

YAML 字符串使用 JSON 引号转义并处理 Compose 的美元符号插值，避免 `$`、引号等改变用户输入。无效配置会清空预览并禁用下载，防止拿到上一次有效配置。密码仍会出现在用户主动下载的 YAML 中，界面明确提示保管。

四种运行库与硬件映射按当前 Dockerfile 区分，尤其 CUDA 的专用 Python、ROCm/RKNN 系统 Python、RKNN 库/设备树只读文件和 render 别名。生成器不探测远端标签、主机驱动或模型资格，不替代真实设备验收。

## 内容维护

内容在 `src/content/docs/*.md` / `*.mdx`，frontmatter 必须包含 title、description、slug、verifiedAt、group。导航由 `astro.config.mjs` 维护；显式章节 ID 由 `scripts/legacy-heading-ids.mjs` 处理。`scripts/legacy-routes.mjs` 保留 `/docs/index.html` 的兼容入口。

固定模板在构建时写入被忽略的 `public/deploy/` 并复制进 dist，不手工维护第二套配置。搜索索引自动包含新文档和参数正文。来源、事实边界与本轮验证记录见 [CONTENT_SOURCES.md](CONTENT_SOURCES.md)。

## 网站本身的部署

下面部署的是这个公开静态官网，不是 NAS 的 Go 管理端。已有网站 Compose 可继续使用：

```sh
docker compose up -d --build --wait
```

网站默认回环端口 18081；需要避免与同机 RK3566 测试实例冲突。生产使用 Nginx，无 Node、数据库或持久业务卷。运行容器默认 64 MiB、0.5 CPU，构建阶段内存另计。

网站的 `WEBSITE_IMAGE`、`WEBSITE_BIND`、`WEBSITE_PORT` 仅用于本仓库已有网站部署配置，与生成器输出的业务 YAML 不同。发布镜像和凭据设置见 [infra/docker/PUBLISHING.md](infra/docker/PUBLISHING.md)。正式域名确定后再配置 Astro `site` 生成 sitemap。

现有 Nginx 继续限制 GET/HEAD、隐藏文件访问和目录索引，使用与本次构建匹配的 CSP 哈希、安全响应头和 Pagefind WASM 权限；新生成器无需开放额外外域或内联脚本权限。HTTP 验证需要针对真实 Nginx 实例运行。修改 HTML 后必须重建安全头，不复用旧哈希。
