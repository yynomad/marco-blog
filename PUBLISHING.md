# 博客发布与通知

在 Notion「小远的博客」中把文章的「状态」设为「完成」，现有同步任务会将文章提交到 GitHub，Cloudflare Workers Builds 随后自动构建、部署。

- 「状态：已同步」表示文章已写入仓库。
- 「发布状态：待发布」表示文章有更新，尚未验证上线。
- 「发布状态：已发布」仅在验证线上版本、首页和文章地址后填写。部署后的新编辑不会被标记为已发布。

`Blog Publish Monitor` 在同步结束、main 更新时检查发布，另有每半小时一次的补充检查。GitHub 的计划任务可能延迟，所以这不是严格的实时通知服务。

通知使用现有 Telegram Bot，通过仓库的 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID` Secrets 配置。Token 不写入代码、构建产物或通知状态缓存。通知程序只使用 Node 内置功能，博客依赖安装失败时仍可运行。

通知覆盖同步失败、Cloudflare 构建失败、构建长时间未完成、线上版本或文章缺失，以及故障恢复和新内容上线。同一阶段的持续故障不重复推送，未变化的文章也不重复推送。日志和告警始终区分同步、Cloudflare 构建和线上验证。

## 依赖维护

Node 精确版本记录在 `.node-version`，npm 版本记录在 `package.json`，GitHub 使用同一环境。Cloudflare 使用仓库版本文件，不应再配置与其冲突的 `NODE_VERSION` 环境变量。

日常发布执行 `npm ci`，不会自动更新锁文件。升级工具或依赖时，在单独分支更新版本和锁文件，执行 `npm test`、`npm run build`，通过 `Validate Blog` 后再发布。

构建会生成公开的 `deployment.json`，仅含提交版本、构建时间、文章标题、路径和内容指纹，用于判断网站是否真的运行新版本。它不包含 Notion 页面 ID、Bot Token 或其他凭据。

通知状态保存在 GitHub Actions 缓存，丢失或过期后可能重新通知一次。即使 Telegram 暂时无法送达，检查任务也会失败并在 GitHub Actions 留下记录。
