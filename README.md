# AI Prompt Assistant

![Version](https://img.shields.io/badge/version-1.3.0-4CAF50) ![Manifest](https://img.shields.io/badge/Chrome%20MV3-supported-blue) ![License](https://img.shields.io/badge/license-MIT-green)

一个 Chrome 扩展（Manifest V3）：在 AI 聊天网站的输入框旁显示悬浮球，一键插入你预设的常用提示词。支持分类管理、星标收藏、搜索过滤、多站点自定义，数据完全保存在本地。

> 支持豆包、DeepSeek、腾讯元宝等——以及任何你手动添加的 AI 网站。

## ✨ 功能特性

- **快速插入**：点击悬浮球打开提示词面板，点选即插入当前输入框（支持 textarea 与 contenteditable）
- **光标跟随**：页面加载后悬浮球即对齐输入框首行；聚焦后跟随输入光标所在行——打字换行、点击移动光标、方向键、输入框/页面滚动时自动更新
- **提示词管理**：分类存储、添加、编辑、删除、星标收藏、搜索过滤；编辑保留 id，星标不丢失
- **站点自定义**：默认支持 DeepSeek、豆包、腾讯元宝；可启用/禁用、删除、添加任意自定义网站（常见平台自动转换为子域名匹配）
- **智能注入**：内容脚本只在启用的网站上动态注册运行，不向其他网站注入任何代码
- **数据本地化**：使用 `chrome.storage.local`，无任何网络请求；支持 JSON 导入/导出备份
- **暗色模式**：自动跟随系统主题

## 📦 默认支持的网站

| 网站名称 | 域名 | 默认状态 |
|---------|------|----------|
| DeepSeek | chat.deepseek.com | ✅ 启用 |
| 豆包 | .doubao.com（含所有子域名） | ✅ 启用 |
| 腾讯元宝 | yuanbao.tencent.com | ✅ 启用 |

> 在"支持网站管理"中添加任意 AI 聊天网站（如 z.ai、chatglm.cn 等）。

## 🚀 安装与使用

### 安装（开发者模式加载）
1. 下载或克隆本仓库
2. 打开 `chrome://extensions/`，开启右上角"开发者模式"
3. 点击"加载已解压的扩展程序"，选择本项目文件夹

### 基本使用
1. 打开任意已启用的 AI 网站（如 DeepSeek）
2. 悬浮球自动对齐输入框；点击输入框后跟随光标行
3. 点击悬浮球 → 选择提示词 → 自动插入输入框
4. 通过工具栏图标打开管理面板：添加/编辑提示词、管理分类、配置网站、导入导出数据

## 🔧 技术架构

```
ai-prompt-assistant/
├── manifest.json         # 扩展配置（内容脚本由 background 动态注册）
├── background.js         # 后台服务（数据管理 + 按启用站点动态注册内容脚本）
├── constants.js          # 消息类型/常量/工具函数（各环境共享）
├── content-modules.js    # 内容脚本主入口
├── modules/              # 内容脚本子模块
│   ├── siteDetector.js   # 站点识别与启用检查
│   ├── inputManager.js   # 输入框查找与焦点监听
│   ├── floatingIcon.js   # 悬浮球（光标跟随/停靠对齐）
│   ├── dataManager.js    # 数据加载/保存
│   ├── dialogManager.js  # 添加/编辑/删除对话框
│   ├── popupManager.js   # 提示词选择弹窗（Shadow DOM 隔离）
│   ├── promptInserter.js # 提示词插入
│   └── styles.js         # Shadow DOM / 全局样式
├── popup.html / popup.js / styles.css   # 扩展管理面板
└── .test/caret-test.html # 光标跟随回归测试页（见下文）
```

### 数据结构（chrome.storage.local）
```javascript
{
  "prompts": {
    "角色扮演": [
      { "id": "p_xxx", "title": "专业翻译", "content": "请扮演..." }
    ]
  },
  "settings": { "showIcon": true, "iconPosition": "right", "autoDetect": true, "theme": "auto" },
  "aiSites": [
    { "name": "豆包", "hostname": ".doubao.com", "enabled": true }
  ],
  "starredPrompts": [ { "id": "p_xxx", "category": "角色扮演", "title": "专业翻译" } ]
}
```

## 🧪 开发与测试

光标跟随（textarea 镜像测量 / contenteditable 选区测量）带有浏览器回归测试页：

```bash
# 在项目根目录启动本地服务
python -m http.server 8642
# 浏览器打开，页面自动运行断言，标题显示 ALL_PASS / HAS_FAIL
# http://127.0.0.1:8642/.test/caret-test.html
```

覆盖场景：多行光标定位、自动换行、输入框内部滚动、contenteditable 折叠选区、空内容兜底、未聚焦停靠。

## ⚠️ 注意事项

1. **权限说明**：
   - `storage`：存储提示词和配置
   - `scripting`：按启用的网站动态注册/注入内容脚本
   - `host_permissions (https://*/*)`：为任意用户自定义站点提供注入能力
2. **注入机制**：内容脚本只在启用的网站上运行（`chrome.scripting.registerContentScripts` 按启用域名动态注册）；修改网站配置后，已打开的匹配标签页自动补注入，无需刷新
3. **域名格式**：只需域名（如 `myai.com`），不需要协议前缀和路径；以 `.` 开头（如 `.doubao.com`）表示匹配该域名及所有子域名

## 🔒 安全与隐私

- ✅ 无网络请求，数据仅存储在本地，不收集任何用户数据
- ✅ 内容脚本只注入到启用的网站，不会在其他网站运行任何代码（包括 SPA 路由监听）
- ✅ 所有用户数据渲染前经过 HTML 转义（含属性上下文引号转义）
- ⚠️ 保留 `https://*/*` 主机权限（用于向用户自定义的启用站点注入脚本）；扩展自身不发起任何网络请求
- ✅ 开源代码，可审查

## 🐛 已知限制

- 部分 AI 网站动态加载输入框，需要等待页面完全加载（扩展已内置 MutationObserver 自动发现）
- 某些站点输入框在 iframe 内时无法识别（内容脚本默认只注入顶层框架）

## 📈 更新日志

### v1.3.0 - 2026-11-03
- ✨ 新增：悬浮球跟随输入光标垂直位置——页面加载后即对齐输入框首行（无需先聚焦），聚焦后对齐光标所在行；打字换行、点击移动光标、方向键、输入框/页面滚动时自动更新（textarea 通过镜像元素测量，兼容自动换行；contenteditable 直接读取选区坐标）
- ✨ 新增：内容弹窗"添加提示词"移至顶部工具栏，与编辑/删除模式按钮并列

### v1.2.0 - 2026-11-03
- 🐛 修复：内容弹窗"添加提示词"对话框打开即失效（事件绑定错误）
- 🐛 修复：内容弹窗编辑提示词会复制而不是更新
- 🐛 修复：删除确认对话框被提示词弹窗遮挡
- 🐛 修复：带点域名（如 `.doubao.com`）存在子串误匹配（`fakedoubao.com` 会被误判为已启用）
- 🐛 修复：站点禁用后再启用，悬浮球消失直到刷新页面
- 🐛 修复：编辑星标提示词后星标丢失（编辑现在保留提示词 id）
- 🐛 修复：悬浮球 hover 后垂直位置漂移；输入框不可见时悬浮球透明但仍可点击
- 🔒 安全：`escapeHtml` 补充引号转义，修复属性注入漏洞；popup 列表属性插值统一转义
- 🔒 安全：内容脚本改为只在启用站点动态注册注入，不再向所有 https 页面注入代码，SPA 路由监听补丁也只应用于启用站点
- ✨ 优化：网站配置变更后自动向已打开的匹配标签页补注入，无需手动刷新
- ✨ 优化：内容弹窗在添加/编辑/删除后即时刷新列表（并保留搜索/筛选状态）
- 🔧 优化：移除未使用的 `activeTab` 权限与冗余的标签页监听；统一分级日志

### v1.1.0 - 2024-12-19
- ✨ 支持网站自定义管理、启用/禁用、添加自定义 AI 网站、一键重置默认

### v1.0.0 - 初始版本
- ✅ 基础提示词管理、多平台支持、快速插入、导入导出

## 📄 许可证

[MIT](LICENSE)
