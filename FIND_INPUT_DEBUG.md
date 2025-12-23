# 🔍 悬浮球消失问题诊断

## 问题描述
腾讯元宝网站上悬浮球不显示

## 已添加的调试信息
现在代码会输出详细的调试信息，请按以下步骤操作：

### 步骤1: 打开控制台
1. 访问 https://yuanbao.tencent.com
2. 按 F12 打开开发者工具
3. 切换到 Console 标签
4. 刷新页面 (F5)

### 步骤2: 查看初始输出
您应该看到类似这样的信息：
```
AI Prompt Assistant 已激活 - 当前网站: 腾讯元宝
当前域名: yuanbao.tencent.com
启用的网站列表: [...]
当前网站: yuanbao.tencent.com
网站是否启用: true/false
```

**关键问题**:
- 如果 `网站是否启用: false` → 需要在插件设置中启用腾讯元宝
- 如果 `网站是否启用: true` → 继续看下一步

### 步骤3: 查看输入框查找过程
您应该看到：
```
当前网站: 腾讯元宝
使用的选择器: [...]
选择器 "div[contenteditable="true"]" 找到 X 个元素
选择器 "div[class*="input"]" 找到 X 个元素
...
总共找到 X 个新输入框
```

**关键问题**:
- 如果所有选择器都找到 0 个元素 → 腾讯元宝使用了不同的DOM结构
- 如果找到元素但 `总共找到 0 个新输入框` → `isTextInput` 判断有问题

## 手动诊断命令

如果上面的信息不够，请在控制台运行以下命令并复制结果：

### 命令1: 查找所有可能的输入框元素
```javascript
console.log('=== 查找所有可能的输入框 ===');
const allDivs = document.querySelectorAll('div');
console.log(`页面上总共有 ${allDivs.length} 个div元素`);

// 查找有特殊属性的div
const specialDivs = Array.from(allDivs).filter(div => {
  const hasContentEditable = div.getAttribute('contenteditable');
  const hasRole = div.getAttribute('role');
  const hasPlaceholder = div.getAttribute('placeholder');
  const hasClass = div.className;

  return hasContentEditable || hasRole || hasPlaceholder ||
         (hasClass && (hasClass.includes('input') || hasClass.includes('chat') || hasClass.includes('editor')));
});

console.log('可能的输入框元素:', specialDivs.map(div => ({
  tag: div.tagName,
  className: div.className,
  id: div.id,
  contenteditable: div.getAttribute('contenteditable'),
  role: div.getAttribute('role'),
  placeholder: div.getAttribute('placeholder'),
  textLength: (div.textContent || '').length,
  innerHTML: div.innerHTML ? div.innerHTML.substring(0, 100) + '...' : 'N/A'
})));
```

### 命令2: 查找聊天输入区域
```javascript
console.log('=== 查找聊天相关元素 ===');
const chatSelectors = [
  'div[class*="chat"]',
  'div[class*="message"]',
  'div[class*="input"]',
  'div[class*="editor"]',
  'div[role="textbox"]',
  'div[role="combobox"]',
  'div[contenteditable="true"]',
  'textarea',
  'input[type="text"]'
];

chatSelectors.forEach(sel => {
  const elements = document.querySelectorAll(sel);
  if (elements.length > 0) {
    console.log(`✅ ${sel}:`, elements);
    elements.forEach((el, i) => {
      console.log(`  [${i}]`, {
        tag: el.tagName,
        className: el.className,
        id: el.id,
        role: el.getAttribute('role'),
        contenteditable: el.getAttribute('contenteditable'),
        text: (el.textContent || el.value || '').substring(0, 50)
      });
    });
  } else {
    console.log(`❌ ${sel}: 未找到`);
  }
});
```

### 命令3: 检查页面结构
```javascript
console.log('=== 页面结构分析 ===');
console.log('Body直接子元素:', document.body.children.length);
console.log('主要容器:', Array.from(document.body.children).map(el => el.tagName + (el.className ? '.' + el.className.split(' ')[0] : '')));

// 查找可能的聊天容器
const containers = Array.from(document.querySelectorAll('div')).filter(div => {
  const text = div.textContent || '';
  return text.includes('发送') || text.includes('输入') || div.className.includes('chat');
});

console.log('可能的聊天容器:', containers.slice(0, 5).map(div => ({
  tag: div.tagName,
  className: div.className,
  children: div.children.length,
  textLength: (div.textContent || '').length
})));
```

### 命令4: 检查React/Vue框架
```javascript
console.log('=== 框架检测 ===');
console.log('React:', typeof window.React !== 'undefined' ? '✅ 存在' : '❌ 不存在');
console.log('Vue:', typeof window.Vue !== 'undefined' ? '✅ 存在' : '❌ 不存在');
console.log('Angular:', typeof window.ng !== 'undefined' ? '✅ 存在' : '❌ 不存在');
console.log('jQuery:', typeof window.jQuery !== 'undefined' ? '✅ 存在' : '❌ 不存在');

// 检查输入框的框架属性
const input = document.querySelector('div[contenteditable="true"]') ||
             document.querySelector('div[class*="input"]') ||
             document.querySelector('textarea');

if (input) {
  console.log('输入框框架属性:', {
    reactFiber: input._reactFiber ? '✅ React Fiber' : '❌',
    reactInternal: input._reactInternalInstance ? '✅ React Internal' : '❌',
    vue: input.__vue__ ? '✅ Vue' : '❌',
    angular: input.__ngContext__ ? '✅ Angular' : '❌'
  });
}
```

## 常见问题和解决方案

### 问题1: 插件未启用
**症状**: `网站是否启用: false`

**解决方案**:
1. 点击浏览器右上角的插件图标
2. 打开设置页面
3. 在"支持的网站"中勾选"腾讯元宝"或添加 `yuanbao.tencent.com`
4. 刷新腾讯元宝页面

### 问题2: 选择器找不到元素
**症状**: 所有选择器都返回 0 个元素

**可能原因**:
- 腾讯元宝使用了自定义组件
- 页面是动态加载的，需要等待
- 输入框在iframe中

**解决方案**:
- 等待页面完全加载后再检查
- 运行命令2查找实际的输入框
- 我会根据实际结构添加新的选择器

### 问题3: 找到元素但悬浮球不显示
**症状**: 选择器找到元素，但 `总共找到 0 个新输入框`

**可能原因**:
- `isTextInput` 判断太严格
- 元素被标记为已处理
- 元素不可见或禁用

**解决方案**:
- 检查 `isTextInput` 的调试输出
- 运行命令3查看元素状态
- 我会放宽判断条件

### 问题4: 页面动态加载
**症状**: 刷新后悬浮球出现，但切换聊天后消失

**可能原因**:
- 腾讯元宝是SPA，页面内容动态变化
- MutationObserver没有正确监听

**解决方案**:
- 检查DOM变化监听是否工作
- 可能需要调整监听配置

## 请提供以下信息

将控制台的完整输出复制给我，特别是：

1. **初始信息** (插件激活时的输出)
2. **查找过程** (选择器查找结果)
3. **手动诊断** (运行命令1-4的结果)
4. **当前表现** (页面上是否有输入框，能否手动输入)

## 临时解决方案

如果急需使用：
1. 先使用豆包或DeepSeek
2. 或者手动复制提示词到腾讯元宝

## 预期修复时间

收到您的调试信息后，我可以在10分钟内：
1. 识别问题原因
2. 添加正确的选择器
3. 调整兼容性逻辑
4. 发布修复版本

---

**当前状态**: 已添加详细调试，等待用户提供控制台输出
**关键**: 需要知道腾讯元宝的实际DOM结构