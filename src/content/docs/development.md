---
title: "源码开发与发行"
description: "区分镜像部署、源码联调、客户端打包与独立官网发布，避免把构建参数当运行参数。"
slug: "docs/development"
verifiedAt: "2026-11-20"
group: "运维"
---

## 普通部署先用镜像 {#choose}

已有镜像时使用[生成器](/docs/compose.html)。本页只面向修改源码或组织发行的人。业务主服务在 singverse-go-backend，计算服务在 singverse-compute，管理界面、亲友 H5 与下载页在 singverse-frontend；手机与 TV 各有独立仓库。

Go 构建时嵌入完整前端产物。运行环境不需要 Node 或额外前端容器；官网 singverse-website 是另一份静态网站，不是 NAS 管理端。

## 构建参数与运行参数 {#parameters}

| 参数 | 作用 | 使用阶段 |
| --- | --- | --- |
| `FRONTEND_DIST` | 明确指定完整前端产物，必须包含 admin、party、downloads | Go 源码构建 |
| `SINGVERSE_FRONTEND_PROJECT` | 本地前端源码绝对路径 | 多仓库联调 |
| `SINGVERSE_COMPUTE_PROJECT` | 显式选择 compute 检出目录 | 本地联调或 Go/compute 验证 |
| `MOBILE_RELEASE_DIR` | 有效手机 APK、release.json、SHA256SUMS 目录 | 本地客户端打包 |
| `TV_RELEASE_DIR` | 对应 TV 发行目录 | 本地客户端打包 |
| `COMPONENT_LOCK` | 已解析并校验的组件清单文件 | 可重复构建 |
| `APKSIGNER` / `AAPT` | Android 包校验工具位置 | 发行包校验 |

这些参数不会通过网站生成器写到运行容器。原生 Go 不自动加载 `.env`，运行配置见[参数手册](/docs/parameters.html)，实际原生路径需按安装目录调整。

## 本地联调与 APK {#local-releases}

按后端仓库的本地联调说明准备显式源码路径，再执行 `make docker-local-up`。这条开发路线使用自己的目录布局和构建流程，不与网站的预构建单文件路线混用。

需要本地下载页提供 APK 时，在 Go 仓库执行：

```sh
make docker-local-releases MOBILE_RELEASE_DIR=/absolute/mobile-release TV_RELEASE_DIR=/absolute/tv-release
make docker-local-up
```

工具会核对真实包名、版本、最低系统、ABI、签名和摘要。Debug 包与正式包的签名不一定兼容，缺包不能通过造清单修复。

## 发行顺序与镜像 {#publishing}

正式版本来自 `vMAJOR.MINOR.PATCH` Release。先准备手机与 TV 的签名 APK/清单，再准备完整前端发行包，Go 打包时校验并记录组件清单；compute 单独发版。Go 与 compute 的版本无需相同，运行镜像标签不带开头的 v。

Go 与 compute 分别发布到配置的 GHCR 和 Docker Hub 空间。compute 有 cuda、rocm、openvino、rknn 四种运行库，每种提供固定版本和 `latest-运行库` 标签。构建工作流成功不代替 NAS、电视或 GPU 真机验证。

## 开发验证与公开文档 {#verification}

按各仓库 README/Makefile 执行与改动相符的测试。网站参数依据 Go 的 config.go、compute 的 core/config.py 和 Dockerfile 更新；生成器要同时验证 YAML 解析、参数覆盖、硬件映射、特殊字符和浏览器下载。业务测试结果不能写成网站已替用户完成远端部署。
