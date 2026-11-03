# Bug 修复记录

## 点击星标按钮导致弹窗关闭

**症状**：点击星标按钮后，弹窗立即关闭

**修复时间**：2024-12-26

---

### 问题根源

数据同步功能的副作用导致弹窗被意外关闭。

### 调试过程

#### 第一次尝试：使用 `stopPropagation()`
在星标按钮的 `click` 事件中添加 `e.stopPropagation()`，试图阻止事件冒泡到外部点击检测器。

**结果**：无效 - Shadow DOM 内的 `stopPropagation()` 无法阻止事件跨越 shadow 边界

#### 第二次尝试：使用捕获阶段 `{ capture: true }`
在 document 的 click 监听器上使用捕获阶段。

**结果**：失败 - 导致分类选项卡无法点击（事件被错误拦截）

#### 第三次尝试：使用 `mousedown` 检测外部点击
将外部点击检测从 `click` 改为 `mousedown`，并在星标按钮上添加 `mousedown` 的 `stopPropagation()`。

**结果**：无效 - Shadow DOM 边界问题依然存在

#### 第四次尝试：在 popup 上添加 mousedown 拦截
```javascript
popup.addEventListener('mousedown', (e) => {
  e.stopPropagation();
}, { capture: true });
```

**结果**：无效

#### 最终解决：堆栈追踪定位真凶

添加堆栈追踪：
```javascript
closePopup() {
  console.log('[closePopup] 调用堆栈:', new Error().stack);
  // ...
}
```

**发现真正原因**：
```
at PromptAssistant.closePopup (content.js:2893)
at content.js:3004  <-- 数据同步监听器
```

### 问题代码

```javascript
// 监听星标数据更新
if (message.type === 'STARRED_DATA_UPDATED') {
  console.log('[数据同步] 星标数据已更新，重新加载');
  this.loadData().then(() => {
    if (this.currentPopup) {
      this.closePopup();  // ❌ 这里关闭了弹窗！
    }
  });
}
```

**执行流程**：
1. 用户点击星标按钮
2. 星标数据保存 → 发送 `SAVE_STARRED_PROMPTS` 消息到 background.js
3. background.js 广播 `STARRED_DATA_UPDATED` 消息到所有标签页
4. content.js 收到消息 → 执行 `closePopup()`

### 修复方案

移除数据更新时的 `closePopup()` 调用：

```javascript
// 监听提示词数据更新
if (message.type === 'PROMPTS_DATA_UPDATED') {
  console.log('[数据同步] 提示词数据已更新，重新加载');
  this.loadData();
  // 不关闭弹窗，用户可能正在使用
}

// 监听星标数据更新
if (message.type === 'STARRED_DATA_UPDATED') {
  console.log('[数据同步] 星标数据已更新，重新加载');
  this.loadData();
  // 不关闭弹窗，用户可能正在使用
}
```

### 关键教训

1. **Shadow DOM 事件传播**：`stopPropagation()` 在 Shadow DOM 内部无法阻止事件跨越 shadow 边界
2. **堆栈追踪**：当问题反复出现时，使用 `new Error().stack` 定位真正调用者
3. **副作用**：添加新功能（数据同步）时要考虑对现有功能的影响
4. **过度修复**：不要在没有准确定位问题根源前频繁修改代码

### 相关代码位置

- `content.js:2988-2998` - 数据同步监听器
- `content.js:2000-2050` - 星标按钮点击事件
- `content.js:2057-2067` - 外部点击关闭检测

---

## 未启用网站也显示悬浮球

**症状**：一些没有在启用列表中的网站也会显示悬浮球（如 `chatglm.cn`）

**修复时间**：2024-12-26

---

### 问题根源

域名匹配使用了 `includes()` 方法，导致子串误匹配。

### 问题代码

```javascript
// ❌ 错误：使用 includes 进行子串匹配
currentHostname.includes(site)
```

**误匹配示例**：
```javascript
const site = "openai.com";
const currentHostname = "chatopenai.com";  // 完全不同的域名！

currentHostname.includes(site)  // → true ❌ 错误匹配！
```

### 修复方案

使用精确匹配或子域名匹配：

```javascript
// ✓ 正确：精确匹配或子域名后缀匹配
currentHostname === site || currentHostname.endsWith('.' + site)
```

**正确匹配示例**：
```javascript
"chat.openai.com" === "openai.com"                              // false
"chat.openai.com".endsWith(".openai.com")                       // true  ✓
"chatopenai.com" === "openai.com"                               // false
"chatopenai.com".endsWith(".openai.com")                        // false ✓
```

### 修复位置

1. **content.js:2972** - `SITES_CONFIG_UPDATED` 消息处理
2. **background.js:257** - 标签页更新监听器

### 关键教训

1. **永远不要用 `includes()` 匹配域名** - 会产生子串误匹配
2. **正确的域名匹配方式**：
   - 精确匹配：`hostname === site`
   - 子域名匹配：`hostname.endsWith('.' + site)`
   - 通配符处理：`site.startsWith('.')` 时用 `hostname.endsWith(site.substring(1))`
3. **测试边界情况**：
   - 相似域名（如 `openai.com` vs `chatopenai.com`）
   - 子域名（如 `chat.openai.com`）
   - 通配符格式（如 `.openai.com`）

### 附加问题：SPA 路由监听器绕过检查

**发现时间**：2024-12-26

**问题**：除了 `includes()` 误匹配外，还有一个问题 - SPA 路由变化监听器会绕过网站启用检查直接调用 `findInputElements()`。

**问题代码**（content.js:3029）：
```javascript
// 处理SPA路由变化
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(() => {
      promptAssistant.findInputElements();  // ❌ 没检查网站是否启用！
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });
```

**修复方案**：
1. 添加 `this.isSiteEnabled` 属性（默认 false）
2. 网站启用检查通过后设置为 `true`
3. SPA 路由监听器中检查 `promptAssistant.isSiteEnabled`

```javascript
if (promptAssistant && promptAssistant.isSiteEnabled) {
  promptAssistant.findInputElements();
}
```
