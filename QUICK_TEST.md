# 🚀 腾讯元宝快速测试指南

## 当前已修复
✅ 豆包 (Doubao) - 工作正常
✅ 深度求索 (DeepSeek) - 工作正常
⚠️ 腾讯元宝 (Tencent Yuanbao) - 需要调试

## 腾讯元宝测试步骤

### 1. 准备工作
```
1. 打开腾讯元宝: https://yuanbao.tencent.com
2. 按 F12 打开开发者工具
3. 切换到 Console (控制台) 标签
4. 清空控制台 (点击垃圾桶图标)
```

### 2. 检查插件是否加载
在控制台输入：
```javascript
console.log('插件状态:', typeof window.PromptAssistant !== 'undefined' ? '已加载' : '未加载');
```

### 3. 触发问题
```
1. 点击聊天输入框
2. 应该看到悬浮球出现在右侧
3. 点击悬浮球
4. 选择任意提示词
5. 观察控制台输出和输入框变化
```

### 4. 收集信息
在控制台输入以下代码并复制结果：
```javascript
// 信息收集脚本
console.log('=== 腾讯元宝诊断信息 ===');
console.log('当前URL:', window.location.href);
console.log('当前域名:', window.location.hostname);

// 查找输入框
const selectors = [
  'div[contenteditable="true"]',
  'div[class*="input"]',
  'div[class*="chat"]',
  'textarea',
  'div[role="textbox"]',
  'div[role="combobox"]',
  'div[role="searchbox"]'
];

let foundInput = null;
selectors.forEach(sel => {
  const el = document.querySelector(sel);
  if (el) {
    console.log(`找到输入框 (${sel}):`, {
      tag: el.tagName,
      className: el.className,
      id: el.id,
      contenteditable: el.getAttribute('contenteditable'),
      role: el.getAttribute('role'),
      placeholder: el.getAttribute('placeholder'),
      textLength: (el.textContent || el.value || '').length,
      innerHTML: el.innerHTML ? el.innerHTML.substring(0, 100) + '...' : 'N/A'
    });
    foundInput = el;
  }
});

if (!foundInput) {
  console.log('未找到输入框，请手动查找:');
  console.log('尝试: document.querySelectorAll("div") 然后检查哪些有输入功能');
}

// 检查React
console.log('React存在:', typeof window.React !== 'undefined');
console.log('Vue存在:', typeof window.Vue !== 'undefined');
```

### 5. 复制完整输出
将控制台的所有输出（特别是红色错误和黄色警告）复制给我。

## 预期结果对比

### ✅ 正常情况 (豆包/DeepSeek)
```
=== 提示词插入调试信息 ===
输入框类型: div
输入框类名: [具体类名]
contenteditable: true
当前内容长度: 0
插入内容长度: 20
提示词插入成功，光标位置: ContentEditable 已设置

// 输入框显示插入的内容，光标在末尾
```

### ❌ 腾讯元宝当前情况
```
[需要您的输出]
```

## 可能的几种情况

### 情况A: 输入框类型识别错误
**表现**: 控制台显示的输入框信息不正确
**解决**: 我需要知道真实的输入框结构

### 情况B: React事件不同步
**表现**: 插入成功但界面不更新
**解决**: 需要特殊的React事件触发

### 情况C: 需要特定的延迟
**表现**: 内容稍后才出现
**解决**: 调整setTimeout的时间

### 情况D: 需要焦点特殊处理
**表现**: 插入时焦点丢失
**解决**: 改进焦点管理

## 快速反馈模板

请按以下格式提供信息：

```
腾讯元宝测试反馈
================

1. 控制台输出:
[粘贴完整控制台输出]

2. 输入框HTML结构:
[粘贴上面诊断脚本的输出]

3. 实际表现:
- 插入后输入框内容: [可见/不可见/部分可见]
- 光标位置: [正确/错误/未知]
- 手动输入是否正常: [是/否]
- 是否有错误提示: [是/否]

4. 截图 (如果方便):
[可以截图输入框插入前后的状态]
```

## 临时解决方案

如果急需使用，可以：

1. **手动复制**: 在悬浮球弹窗中点击提示词后，手动复制内容
2. **使用其他网站**: 豆包和DeepSeek已完全支持
3. **等待修复**: 提供反馈后我会快速修复

## 代码更新记录

### 本次更新内容
- ✅ 添加了腾讯元宝域名检测
- ✅ 添加了腾讯元宝输入框选择器
- ✅ 增强了调试信息输出
- ✅ 添加了多重兼容性方案
- ✅ 增强了React组件支持

### 待解决
- ⏳ 需要腾讯元宝的具体DOM结构
- ⏳ 需要测试实际的事件触发效果

---

**当前状态**: 等待用户提供腾讯元宝的调试信息
**预计修复时间**: 收到信息后10分钟内