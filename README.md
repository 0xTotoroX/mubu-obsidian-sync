# Mubu Sync

[English](#english) · [简体中文](#简体中文)

<a id="english"></a>

Mubu Sync is a desktop plugin that creates a reliable, one-way copy of your Mubu documents in your vault. It is designed for people who use Mubu for outlining and want durable, editable Markdown files for long-term knowledge management.

> [!IMPORTANT]
> This is an independent community project. It is not affiliated with, endorsed by, or supported by Mubu. It uses Mubu's web interfaces, which may change without notice.

## Highlights

- One-way sync from Mubu to local Markdown—your Mubu content is never edited by this plugin.
- Preserves Mubu folder hierarchy, document identity, remote renames, and moves.
- Writes only changed documents and supports startup and scheduled sync.
- Keeps personal additions safe: only the managed section of a synced file is updated.
- Converts nested outline nodes, notes, tasks, due dates, formulas, tables, and remote images.
- Archives remotely deleted documents locally instead of permanently deleting them.

## Requirements

- Desktop app version 1.11.4 or later.
- A Mubu account that can sign in normally.
- Network access to Mubu while synchronizing.

## Installation

### Community plugins

When the plugin is available in the Community directory, open **Settings → Community plugins**, search for **Mubu Sync**, install it, and enable it.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](https://github.com/bopan3/mubu-obsidian-sync/releases).
2. Create the folder `<vault>/.obsidian/plugins/mubu-sync/`.
3. Copy those three files into the folder.
4. Restart the desktop app and enable **Mubu Sync** in **Community plugins**.

## Quick start

1. Open **Settings → Mubu Sync**.
2. Select **Sign in to Mubu** and complete the sign-in window.
3. Choose a destination folder and your preferred sync schedule.
4. Select **Sync now**.

The first sync imports your available Mubu documents. Later syncs update only documents whose remote content has changed.

## How synced files work

Each document is saved as a Markdown file with its Mubu document ID in frontmatter. The plugin owns only the region between these markers:

```markdown
<!-- mubu-sync:start -->
... content synchronized from Mubu ...
<!-- mubu-sync:end -->
```

Add your own notes below the managed region—by default, the file includes a `## My notes` section for this purpose. Local content outside the markers is preserved during sync. If you remove the markers, the plugin skips that file to prevent accidental overwrites.

When a document is renamed or moved in Mubu, its matching Markdown file is moved accordingly. When a document is deleted in Mubu, its local copy is archived to:

```text
<destination>/_mubu_deleted/YYYY-MM-DD/
```

## Privacy and network access

Mubu Sync connects directly from your device to the following Mubu services:

- `https://mubu.com` — displays the sign-in page.
- `https://api2.mubu.com` — reads folders, document lists, and document content.
- `https://document-image.mubu.com` — displays images referenced by synced documents.

The plugin has no telemetry, analytics, advertising, or proxy server. Your Mubu token is stored using the desktop app's secure secret storage and is not written to the plugin settings file. Document content and credentials are not sent to the plugin author.

## Limitations

- Desktop only; mobile is not supported.
- Sync is one-way. Local edits inside the managed section are replaced by the next sync.
- The plugin fetches the full Mubu document index before determining which local files need writing.
- Images remain remote URLs rather than downloaded attachments.
- Password-protected documents, shared-with-me documents, and specialized collaboration workflows have not been fully tested.
- Mubu rich text and Markdown are not identical; colors, folding state, and some visual styles may be simplified.

## Development

```bash
npm install
npm run check
```

`npm run check` runs type checking, the test suite, and the production build.

## License and acknowledgements

Released under the [MIT License](LICENSE). The Mubu API shape was researched with reference to [Navyum/chrome-extension-mubu-export](https://github.com/Navyum/chrome-extension-mubu-export); this plugin's API client, conversion, and sync engine are independent implementations. Use the plugin only with content you are authorized to access and in accordance with Mubu's terms of service.

---

<a id="简体中文"></a>

# Mubu Sync（简体中文）

[English](#english) · [简体中文](#简体中文)

Mubu Sync 是一款桌面端社区插件，用于将幕布文档单向、稳定地同步为本地 Markdown 文件。它适合在幕布中梳理大纲、并希望在本地长期保存和编辑文档的用户。

> [!IMPORTANT]
> 本项目为独立社区项目，与幕布及其运营方不存在隶属、授权或合作关系。插件使用幕布网页接口；若接口变更，功能可能受影响。

## 核心能力

- 仅从幕布同步到本地，不会修改幕布中的内容。
- 保留文件夹层级、文档身份、远端改名和移动。
- 仅写入远端发生变化的文档，支持启动时和定时同步。
- 仅更新文件中的受管理区域，保留你的本地补充。
- 支持嵌套节点、备注、任务、截止日期、公式、表格与远程图片。
- 远端删除的文档会在本地归档，而非直接永久删除。

## 使用要求

- 桌面端版本 1.11.4 或更高。
- 可正常登录的幕布账号。
- 同步时可访问幕布服务的网络连接。

## 安装

### 社区插件安装

插件出现在社区目录后，进入 **设置 → 第三方插件**，搜索 **Mubu Sync**，安装并启用即可。

### 手动安装

1. 从最新的 [GitHub Release](https://github.com/bopan3/mubu-obsidian-sync/releases) 下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 创建 `<vault>/.obsidian/plugins/mubu-sync/` 文件夹。
3. 将上述三个文件复制到该文件夹。
4. 重启桌面端应用，并在 **第三方插件** 中启用 **Mubu Sync**。

## 快速开始

1. 打开 **设置 → Mubu Sync**。
2. 点击 **登录幕布**，并在弹出的窗口中完成登录。
3. 设置同步目标文件夹和同步频率。
4. 点击 **立即同步**。

首次同步会导入可访问的幕布文档；之后仅更新远端内容发生变化的文档。

## 同步文件与本地补充

每篇幕布文档都会生成一个 Markdown 文件，并通过 frontmatter 中的幕布文档 ID 跟踪。插件仅管理以下标记之间的内容：

```markdown
<!-- mubu-sync:start -->
... 由幕布同步的内容 ...
<!-- mubu-sync:end -->
```

请将自己的补充写在标记之外。默认生成的 `## 我的补充` 区域正是为此准备的；该区域会在同步时保留。若删除这些标记，插件会跳过该文件，避免覆盖你的本地编辑。

幕布中文档改名或移动后，本地对应文件会随之移动。若幕布中删除文档，本地副本会归档至：

```text
<同步目标>/_mubu_deleted/YYYY-MM-DD/
```

## 隐私与网络访问

插件会从你的设备直接访问以下幕布服务：

- `https://mubu.com`：显示登录页面。
- `https://api2.mubu.com`：读取文件夹、文档列表和文档内容。
- `https://document-image.mubu.com`：显示同步文档引用的图片。

插件不包含遥测、分析统计、广告或第三方中转服务。幕布登录凭证使用桌面端应用的安全密钥存储保存，不会写入插件设置文件；文档内容和凭证不会发送给插件作者。

## 已知限制

- 仅支持桌面端，暂不支持移动端。
- 同步为单向同步：受管理区域中的本地修改会在下次同步时被远端内容替换。
- 插件会先读取完整的幕布文档索引，再决定哪些本地文件需要写入。
- 图片会以远程 URL 形式保留，不会自动下载为本地附件。
- 密码保护文档、分享给我的文档和特殊协作文档尚未完整适配。
- 幕布富文本与 Markdown 并不完全等价；颜色、折叠状态和部分视觉样式可能被简化。

## 开发

```bash
npm install
npm run check
```

`npm run check` 会执行类型检查、测试和生产构建。

## 许可证与致谢

项目采用 [MIT License](LICENSE)。幕布接口形态的调研参考了 [Navyum/chrome-extension-mubu-export](https://github.com/Navyum/chrome-extension-mubu-export)；本插件的 API 客户端、转换逻辑和同步引擎均为独立实现。请仅同步有权访问的内容，并遵守幕布的服务条款。
