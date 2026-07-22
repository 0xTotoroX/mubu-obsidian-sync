# Mubu Sync

将幕布文档单向、增量同步到 Obsidian。交互方式参考 Flomo Sync：登录一次后，可在启动时或按固定间隔自动同步。

> 当前版本是 MVP，使用幕布网页内部接口，并非幕布官方集成。接口变化可能导致插件失效。

本项目由社区独立开发，与幕布及其运营方不存在隶属、授权或合作关系。“幕布”名称仅用于说明兼容的第三方服务。

## 使用要求

- Obsidian 桌面版 1.11.4 或更高版本
- 可正常登录的幕布账号
- 网络连接；同步期间插件会直接连接幕布服务

## MVP 功能

- Obsidian 内弹出幕布登录窗口，自动捕获 `Jwt-Token`
- 手动 Token 备用模式
- 保留幕布文件夹层级
- 一个幕布文档对应一个 Markdown 文件
- 使用幕布文档 ID 跟踪改名和移动
- 对远端 `definition` 计算 SHA-256，只写入发生变化的文档
- Obsidian 启动时同步、15 分钟至 6 小时定时同步
- 幕布中删除的文档默认移动到 `Mubu/_mubu_deleted/日期/`
- 同步内容放在受管理标记内，标记外的本地补充不会被覆盖
- 基础支持嵌套节点、备注、任务、截止日期、公式、表格和远程图片

## 安装与构建

```bash
npm install
npm run check
```

将以下文件复制到仓库的 `.obsidian/plugins/mubu-sync/`：

```text
main.js
manifest.json
styles.css
```

重启 Obsidian，在“第三方插件”中启用 **Mubu Sync**，然后进入设置点击“登录幕布”。

## 发布

仓库包含 GitHub Actions 发布流程。将代码推送到公开 GitHub 仓库后，创建一个与 `manifest.json` 版本完全一致的标签即可自动运行测试、构建 Release，并分别上传 `main.js`、`manifest.json` 和 `styles.css`：

```bash
git tag 0.1.0
git push origin 0.1.0
```

首次进入官方插件目录仍需在 [Obsidian Community](https://community.obsidian.md) 的 **Plugins → New plugin** 提交公开仓库地址。

## 同步格式

新文件示例：

```markdown
---
source: mubu
mubu_id: "document-id"
---

<!-- mubu-sync:start -->
# 文档标题

- 幕布节点
  - 子节点
<!-- mubu-sync:end -->

## 我的补充
```

只有 `mubu-sync:start` 和 `mubu-sync:end` 之间的内容会被远端内容更新。删除这两个标记后，插件会跳过该文件以避免覆盖本地内容。

## 认证说明

自动登录通过 Obsidian 桌面端的 Electron `BrowserWindow` 打开幕布，并从该窗口的 session Cookie 中读取 `Jwt-Token`。捕获后的 Token 使用 Obsidian `SecretStorage` 保存，不写入插件的 `data.json`。

如果当前 Obsidian/Electron 版本不允许插件打开登录窗口，可以在 Chrome 开发者工具或其他可信方式取得自己的 `Jwt-Token`，然后在设置中手动填写。

## 已知限制

- 仅支持 Obsidian 桌面版。
- 每次同步会获取全部文档目录，并逐篇获取详情后计算 hash；目前是“增量写入”，不是“增量请求”。
- 图片目前保留幕布远程 URL，没有下载到 Obsidian 附件目录。
- 密码保护、分享给我的文档、特殊协作文档尚未专门适配。
- 幕布富文本与 Markdown 并非完全等价，颜色、折叠状态等格式可能简化。

## 网络与隐私披露

插件需要访问以下远程服务：

- `https://mubu.com`：显示幕布登录页面并取得当前登录凭证。
- `https://api2.mubu.com`：读取用户自己的文件夹、文档列表和文档内容。
- `https://document-image.mubu.com`：在同步后的 Markdown 中显示幕布文档图片。

所有同步请求均由用户设备直接发送至幕布服务。本插件不包含客户端遥测、分析统计、广告或第三方中转服务器，也不会把 Token 或文档内容发送给插件作者。

## 接口来源与实现说明

幕布接口形态参考了公开项目 [Navyum/chrome-extension-mubu-export](https://github.com/Navyum/chrome-extension-mubu-export)，本项目的 API 客户端、转换器和同步逻辑为独立实现。当前使用：

```text
POST https://api2.mubu.com/v3/api/list/get_all_documents_page
POST https://api2.mubu.com/v3/api/list/get_folder
POST https://api2.mubu.com/v3/api/list/get
POST https://api2.mubu.com/v3/api/document/edit/get
```

请仅用于同步和备份自己的内容，并遵守幕布服务条款。
