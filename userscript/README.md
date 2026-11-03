# AI Prompt Assistant（油猴脚本版）

Chrome 扩展 [ai-prompt-assistant](../README.md) 的 Tampermonkey/油猴移植版，功能一致，单文件、免上架、数据本地化。

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/)（或 Violentmonkey）
2. 点击安装链接，Tampermonkey 会自动弹出安装确认页，一键完成（无需下载/复制/粘贴）：

   **主链接（jsDelivr，国内直连）：**
   https://cdn.jsdelivr.net/gh/zjwf724/ai-prompt-assistant@main/userscript/ai-prompt-assistant.user.js

   **备用镜像（主链接打不开时依次尝试）：**
   - https://fastly.jsdelivr.net/gh/zjwf724/ai-prompt-assistant@main/userscript/ai-prompt-assistant.user.js
   - https://gcore.jsdelivr.net/gh/zjwf724/ai-prompt-assistant@main/userscript/ai-prompt-assistant.user.js
   - https://testingcf.jsdelivr.net/gh/zjwf724/ai-prompt-assistant@main/userscript/ai-prompt-assistant.user.js
   - https://raw.githubusercontent.com/zjwf724/ai-prompt-assistant/main/userscript/ai-prompt-assistant.user.js （GitHub 官方，境外网络）

3. 若浏览器把链接当成下载而不是弹出安装页：打开 Tampermonkey 设置 → 通用 → 将"文件访问"中的 `.user.js` 拦截开启（默认开启），再重试
4. 或手动方式：新建脚本，把 `ai-prompt-assistant.user.js` 的全部内容粘贴进去保存

> 更新地址（@updateURL/@downloadURL）同样指向 jsDelivr，国内网络下自动更新也可用；jsDelivr 对 main 分支有约 12 小时缓存，更新推送后最迟次日生效。

安装后访问已启用的 AI 网站（DeepSeek、豆包、腾讯元宝等）即可看到输入框旁的绿色悬浮球。

## 与扩展版的差异

| 扩展版 | 油猴版 |
|---|---|
| 数据存于 `chrome.storage.local` | 存于脚本管理器存储（`GM_setValue`） |
| 工具栏 popup 管理面板 | 页内设置浮层：**油猴菜单 → "AI Prompt Assistant 设置"**，或弹窗顶栏 ⚙ 齿轮 |
| 内容脚本按启用站点动态注册 | 脚本在所有 https 页面加载，未启用站点直接退出（不注入任何 DOM） |
| 跨标签页同步走 background 广播 | `GM_addValueChangeListener` |
| 商店自动更新 | `@updateURL/@downloadURL` 指向 jsDelivr CDN（国内可达，推送 main 后自动更新，约 12h 缓存延迟） |

其余功能一致：光标跟随（加载后停靠输入框首行）、分类/星标/搜索、添加/编辑/删除、站点自定义管理、JSON 导入导出、暗色模式。

## 常见问题

- **如何添加自定义网站？** 油猴菜单打开设置 → 网站管理 → 添加域名（如 `chatglm.cn`）。在未启用的网站上也能就地添加并立即生效，无需刷新。
- **数据存在哪里？** 全部在本浏览器脚本管理器的存储中，无任何网络请求。扩展版与油猴版数据互不相通，可用 JSON 导出/导入迁移；v1.4.0 起备份格式**完全互通**（含星标与站点配置），重复导入自动去重。
- **脚本在所有网站都会运行吗？** 脚本会在所有 https 页面加载（油猴脚本的常规做法），但未启用站点在入口处即退出，不创建任何 DOM、不监听任何事件。
- **与页面样式冲突？** 弹窗使用 Shadow DOM 隔离；极少数 CSP 严格的站点可能影响样式注入。

## 开发测试

端到端测试页（GM shim 模拟脚本管理器，覆盖停靠定位/弹窗/添加/插入/设置/站点开关/导入导出全链路）：

```bash
python -m http.server 8642   # 项目根目录
# 打开 http://127.0.0.1:8642/.test/userscript-test.html，标题 ALL_PASS 即通过
```

## License

[MIT](../LICENSE)
