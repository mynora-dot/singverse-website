---
title: "账号、安全与恢复"
description: "完成首次改密、二次验证、会话管理和主机侧恢复，保护数据库与配套主密钥。"
slug: "docs/security"
verifiedAt: "2026-11-20"
group: "运维"
---

## 初始账号与密码 {#account}

当前是单管理员模型。只有首次空库生成 `admin/admin`，重建容器不会重置已有账号。登录后到“设置 → 账号与安全”修改账号或密码；新密码按页面要求填写，当前规则为 15–128 个 Unicode 字符。

部署环境变量不提供公共默认密码覆盖开关。若看起来重新出现初始账号，先检查是否挂载了空目录，而不是继续在新库录入数据。

## TOTP 与会话 {#mfa}

用认证器扫描页面生成的绑定码，并输入动态码完成确认。保存一次性恢复码到独立安全位置；恢复码不能单独代替账号密码。启用、重配安全设置或改密会撤销会话，按提示重新登录。

动态码不通过先检查手机与 NAS 时钟，不用关闭验证绕过时间问题。自动登录与记住输入是不同功能，设备丢失后及时处理会话和凭据。

## 忘记密码但仍有 MFA {#password-reset}

在部署主机的交互终端操作，沿用原 YAML 和数据目录：

```sh
docker compose -f docker-compose.yaml stop singverse-go-backend
docker compose -f docker-compose.yaml run --rm --no-deps singverse-go-backend --issue-password-reset
docker compose -f docker-compose.yaml up -d --no-build --wait --wait-timeout 180
```

命令要求真实 TTY 和输入 RESET 确认，生成 15 分钟一次性重置码。在登录页“忘记密码”中使用，重置密码仍保留原 MFA。不要把输出贴进工单或公开日志。

## MFA 与恢复码均丢失 {#emergency}

具有主机管理权限时先停止主服务，再使用交互紧急恢复：

```sh
docker compose -f docker-compose.yaml stop singverse-go-backend
docker compose -f docker-compose.yaml run --rm --no-deps singverse-go-backend --reset-admin
docker compose -f docker-compose.yaml up -d --no-build --wait --wait-timeout 180
```

按提示确认并输入新密码。此操作清除 MFA、恢复码、限流和会话，保留其他业务数据，不修复丢失的加密主密钥。先了解影响，不用删数据库代替恢复。

## 网络与代理 {#network}

客户端使用业务端口；同机 compute 只在内部网络开放。HTTPS 由外部代理终止，保留真实 Host，并配置 `SINGVERSE_PUBLIC_ORIGIN` 与实际可信代理。不要把所有来源设为可信代理，详见[参数说明](/docs/parameters.html#singverse-trusted-proxies)。

## 主密钥与隐私 {#key}

数据库中的加密配置依赖 `singverse-secrets/master.key`。已有密文时文件缺失或错误会阻止启动，不能生成一个新文件替代旧密钥。数据库和密钥成套备份，compute token 同样持久保存。

媒体以你的本地/WebDAV 来源为准。外部元数据、音源与 AI 请求可能访问第三方，按实际启用功能管理凭据；手机作品默认本机保存。官网生成器只在浏览器生成文件，不访问 NAS，也不保存用户输入。
