# 官网镜像发布

工作流为 `.github/workflows/website-images.yml`，镜像名固定为 `singverse-website`。流程参照后端仓库独立实现，不依赖相邻项目、业务后端或客户端 Release。

## 触发与版本

先提交并推送官网源码、Dockerfile 和工作流，再为该提交创建注释标签和中文 Release 草稿。只有 `release.published` 事件执行发布，草稿和 Pre-release 跳过；普通 push、PR、单独推送 tag 不发布，不提供手动 dispatch 入口，也不增加独立测试、lint 或验收 job。[中文标签与发布说明](https://github.com/mynora-dot/singverse-go-backend/blob/main/docs/multi-repository.md#中文标签与发布说明)

Release tag 必须为 `vMAJOR.MINOR.PATCH`，例如 `v0.0.1` 对应镜像版本 `0.0.1`。版本来自 Release 标签，不需要 VERSION 文件或版本变量。工作流通过 GitHub API 校验正式 Release 并解析标签的完整提交 SHA，两个架构及发布任务都使用这一提交，不使用可变的分支 HEAD。

## 仓库配置

官网仓库的 Settings → Secrets and variables → Actions 使用与后端同名的配置。仓库之间的变量和密钥不会自动继承；也可通过组织配置显式授权官网仓库使用。

| Actions Variable | 含义 | 与后端一致的当前值 |
| --- | --- | --- |
| `GHCR_NAMESPACE` | GitHub 用户或组织；留空默认使用仓库 owner 的小写名称 | `mynora-dot` |
| `DOCKERHUB_NAMESPACE` | Docker Hub 用户或组织 | `mynora` |

两个命名空间可以不同，使用小写名称。预先创建或授权对应命名空间下的 `singverse-website` 仓库；不填写已有后端镜像的名称。

| Actions Secret | 用途 |
| --- | --- |
| `DOCKERHUB_USERNAME` | 有官网镜像推送权限的 Docker Hub 登录账号 |
| `DOCKERHUB_TOKEN` | 上述账号的访问令牌 |
| `GHCR_USERNAME`、`GHCR_TOKEN`（可选） | 自定义 GHCR 凭据；默认 `github.actor` 和工作流 `GITHUB_TOKEN` |

配置缺失会在构建前失败，两家仓库均为必需目标。GitHub 不能读回其他仓库的 Secret 值；请在官网仓库单独配置，或调整已有组织 Secret 的仓库授权，无需把凭据写入源码或聊天。

默认 GHCR 发布任务具有 `packages: write`。若 GHCR 包已提前创建，在该包的 Settings → Manage Actions access 中将官网仓库加入并授权写入；跨 owner 发布时按目标权限配置自定义凭据。`org.opencontainers.image.source` 标签指向官网源码仓库。

## 产物与重试

1. 检查正式 Release、锁定完整提交，并校验两家目标变量和密钥是否齐全。
2. 在原生 `ubuntu-24.04`、`ubuntu-24.04-arm` runner 构建 `linux/amd64`、`linux/arm64`。Dockerfile 的构建步骤保留原有 Astro 类型、内容及安全头生成检查。
3. 将每个架构的镜像保留摘要保存到 GHCR 的独立缓存包，作为发布与重试的固定来源。GitHub Release 不上传 Docker/OCI 镜像、归档清单或分片。运行镜像不含发布凭据和发布工具。
4. 使用 Skopeo 将完整多架构索引及其引用的镜像层保留摘要复制到两家仓库，只发布数字版本标签，架构清单通过摘要引用。已有固定标签摘要不同即失败，认证及网络错误不会被当作标签不存在。
5. 两家固定版本全部通过后更新 `latest`。跨仓库更新不具备事务性，更新中断时重跑同一次运行可恢复。

每个架构的逻辑归档名为 `website-amd64.oci.tar` 或 `website-arm64.oci.tar`，仅用于 runner 本地的构建与发布交接。固定镜像保存在 `ghcr.io/<GHCR_NAMESPACE>/singverse-website-buildcache:release-<version>-<SOURCE_REVISION>-website-<arch>`，与可变的构建层缓存标签隔离。恢复时按镜像摘要拉取并复核，不通过 Release 附件或 Actions artifacts 传递镜像。

失败后选择同一次运行的 Re-run failed jobs。发布任务从 GHCR 缓存恢复两个架构的镜像，构建任务重跑也先校验并复用镜像，跳过 Buildx 设置和重新构建，避免重建时间变化产生不同的固定版本内容。缓存镜像和正式固定镜像均不覆盖不同内容；不要删除这些重试缓存或移动版本 tag。修改源码或工作流后应发布新版本，重跑旧记录不会使用新代码。已有 Release 中的历史 OCI 附件不会自动删除。

Action 依赖固定到核对过的完整提交 SHA。顶层 token 只有 `contents: read`，构建和推送任务获得缓存与镜像发布所需的 `packages: write`，不再需要 Release 附件写权限。GHCR 凭据只在缓存和推送步骤使用，Docker Hub 凭据只在配置检查和推送步骤使用，通过标准输入传给 Skopeo，不作为 Docker 构建参数。

## 镜像地址与部署

`<VERSION>` 是正式 Release 标签去掉 `v` 后的版本号，以下地址不表示该版本已经发布：

| 平台 | 当前配置对应的镜像地址 |
| --- | --- |
| GHCR | `ghcr.io/mynora-dot/singverse-website:<VERSION>` |
| Docker Hub | `docker.io/mynora/singverse-website:<VERSION>` |

两家只发布数字版本 `<VERSION>` 与 `latest` 两类标签，二者均包含 `linux/amd64`、`linux/arm64`，不再额外发布架构标签。生产部署选定已发布的固定版本，由镜像清单匹配部署机架构。已有历史标签不会自动删除，数字版本会随发布累积。

在官网目录执行，按实际已发布版本替换示例：

```sh
export WEBSITE_IMAGE=docker.io/mynora/singverse-website:0.0.1
# 私有仓库先交互登录，凭据不写入命令或仓库
docker login docker.io
docker compose pull
docker compose up -d --no-build --wait
```

也可把 `WEBSITE_IMAGE` 放入本机 `.env`。本地源码构建继续使用默认 `singverse-website:local` 和 `docker compose up -d --build --wait`；使用发布镜像时执行 `--no-build`。端口、资源和安全限制保持 Compose 中的配置，网站不需要持久卷。

本地工作流语法及发布脚本检查不代表远程 Actions 已成功运行或两家正式镜像已推送。

构建层使用 `ghcr.io/<GHCR_NAMESPACE>/singverse-website-buildcache:<arch>` 的独立 registry cache，按架构隔离并使用 `mode=max`，可在不同 Release 之间复用 Node 依赖及其他未变化的构建层。使用现有 GHCR 凭据，不新增 Variables 或 Secrets；已有缓存包需允许本仓库 Actions 读写，跨 owner 凭据也需覆盖缓存包。缓存缺失正常构建，缓存导出失败不阻断正式产物。缓存不进入正式 `singverse-website` 标签列表；正式镜像仍只有数字版本和 `latest`。

官网镜像较小，不执行耗时的 SDK 卸载或磁盘合并。发布优先使用 runner 预装 Skopeo；缺失时才安装。首次构建填充缓存，后续是否命中由依赖、源码和构建指令是否变化决定。
