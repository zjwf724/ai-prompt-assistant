// Content Script - 在AI网站中运行
// 负责检测输入框、显示提示图标和处理用户交互

class PromptAssistant {
  constructor() {
    this.prompts = {};
    this.settings = {};
    this.inputElements = [];
    this.iconElements = new Map();
    this.currentPopup = null;
    this.currentSite = this.detectSite();
    this.floatingIcon = null;          // 单一悬浮球
    this.currentFocusedInput = null;    // 当前聚焦的输入框
    this.init();
  }

  // 检测当前AI网站
  detectSite() {
    const hostname = window.location.hostname;

    // 检查豆包（支持所有子域名）
    if (hostname.endsWith('.doubao.com') || hostname === 'doubao.com') {
      return '豆包';
    }

    // 检查 z.ai（支持所有子域名）
    if (hostname.endsWith('.z.ai') || hostname === 'z.ai') {
      return 'zAI';
    }

    // 检查 designkit.cn
    if (hostname.endsWith('.designkit.cn') || hostname === 'designkit.cn') {
      return 'DesignKit';
    }

    const sites = {
      'chat.deepseek.com': 'DeepSeek',
      'yuanbao.tencent.com': '腾讯元宝'
    };
    return sites[hostname] || 'Unknown';
  }

  // 动态注入CSS样式
  injectStyles() {
    // 检查是否已经注入
    if (document.getElementById('prompt-assistant-styles')) {
      return;
    }

    const styles = `
      /* 提示图标样式 */
      .prompt-assistant-icon {
        opacity: 0.5;
        transition: all 0.2s ease;
        pointer-events: auto;
        position: fixed;
        z-index: 999999;
        background-color: #4CAF50;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 10px rgba(0,0,0,0.25);
        border: 2px solid white;
        cursor: pointer;
        transform: scale(1);
      }

      .prompt-assistant-icon:hover {
        opacity: 1 !important;
        transform: scale(1.15);
        box-shadow: 0 5px 15px rgba(76, 175, 80, 0.4);
      }

      /* 提示词弹窗样式 - 全新设计 */
      .prompt-assistant-popup {
        position: fixed !important;
        width: 480px;
        max-width: calc(100vw - 40px);
        max-height: 70vh;
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05);
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 2147483647 !important; /* 最大32位整数，确保在最顶层 */
        animation: popupFadeIn 0.2s ease;
        /* 防止被网站CSS影响 */
        transform: none !important;
        filter: none !important;
        will-change: auto !important;
        isolation: isolate; /* 创建新的层叠上下文 */
      }

      @keyframes popupFadeIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .popup-header {
        padding: 0;
        background: transparent;
        display: flex;
        flex-direction: column;
        border-bottom: 1px solid #eee;
      }

      .popup-header-top {
        padding: 12px 16px 0;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .popup-header h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #222;
      }

      .close-btn {
        background: #f5f5f5;
        border: none;
        color: #666;
        font-size: 18px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        transition: all 0.15s;
        line-height: 1;
      }

      .close-btn:hover {
        background: #e0e0e0;
        color: #333;
      }

      /* 搜索框 */
      .popup-search {
        padding: 12px 16px;
        border-bottom: 1px solid #f0f0f0;
      }

      .popup-search input {
        width: 100%;
        padding: 10px 14px 10px 36px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        font-size: 14px;
        box-sizing: border-box;
        background: #f9f9f9;
        transition: all 0.2s;
      }

      .popup-search input:focus {
        outline: none;
        border-color: #4CAF50;
        background: #fff;
        box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
      }

      .popup-search-wrapper {
        position: relative;
      }

      .popup-search-wrapper svg {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: #999;
        pointer-events: none;
      }

      /* 筛选标签 */
      .popup-filters {
        padding: 8px 16px;
        display: flex;
        gap: 8px;
        border-bottom: 1px solid #f0f0f0;
        overflow-x: auto;
      }

      .popup-filters::-webkit-scrollbar {
        height: 0;
      }

      .filter-tag {
        padding: 6px 14px;
        background: #f5f5f5;
        border: none;
        border-radius: 20px;
        font-size: 13px;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s;
        color: #666;
      }

      .filter-tag:hover {
        background: #e8e8e8;
      }

      .filter-tag.active {
        background: #4CAF50;
        color: white;
      }

      .popup-content {
        padding: 12px 16px;
        max-height: calc(70vh - 150px);
        overflow-y: auto;
      }

      /* 两列布局 */
      .prompt-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }

      .prompt-category-title {
        font-size: 13px;
        font-weight: 600;
        color: #888;
        margin: 12px 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .prompt-category-title:first-child {
        margin-top: 0;
      }

      .prompt-item {
        position: relative;
        padding: 12px;
        background: #f7f7f7;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 2px solid transparent;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .prompt-item:hover {
        background: #fff;
        border-color: #4CAF50;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      }

      .prompt-title {
        font-weight: 500;
        color: #222;
        font-size: 14px;
        line-height: 1.3;
      }

      .prompt-preview {
        color: #888;
        font-size: 12px;
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      /* 隐藏的提示项 */
      .prompt-item.hidden {
        display: none;
      }

      /* 无结果提示 */
      .no-results {
        text-align: center;
        padding: 40px 20px;
        color: #999;
        font-size: 14px;
      }

      .add-prompt-btn {
        width: 100%;
        padding: 12px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background 0.15s ease;
        margin-top: 12px;
      }

      .add-prompt-btn:hover {
        background: #45a049;
      }

      .add-prompt-btn:active {
        transform: scale(0.98);
      }

      .no-prompts {
        text-align: center;
        color: #999;
        padding: 60px 20px;
        font-size: 14px;
      }

      /* 对话框样式 */
      .prompt-assistant-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000001;
        animation: dialogFadeIn 0.2s ease;
      }

      @keyframes dialogFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .dialog-content {
        background: white;
        padding: 24px;
        border-radius: 12px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
      }

      .dialog-content h3 {
        margin: 0 0 20px 0;
        font-size: 20px;
        color: #333;
      }

      .form-group {
        margin-bottom: 16px;
      }

      .form-group label {
        display: block;
        margin-bottom: 6px;
        color: #555;
        font-weight: 500;
        font-size: 14px;
      }

      .form-group input,
      .form-group textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        transition: border-color 0.2s;
        box-sizing: border-box;
        font-family: inherit;
      }

      .form-group input:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: #4CAF50;
        box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
      }

      .form-group textarea {
        min-height: 80px;
        resize: vertical;
      }

      .dialog-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 24px;
      }

      .dialog-actions button {
        padding: 8px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }

      .cancel-btn {
        background: #f5f5f5;
        color: #666;
      }

      .cancel-btn:hover {
        background: #e0e0e0;
      }

      .save-btn {
        background: #4CAF50;
        color: white;
      }

      .save-btn:hover {
        background: #45a049;
      }

      /* 文本按钮 */
      .text-btn {
        background: transparent;
        color: #4CAF50;
        padding: 8px 12px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        transition: color 0.2s;
      }

      .text-btn:hover {
        color: #45a049;
        text-decoration: underline;
      }

      /* 对话框操作按钮右侧区域 */
      .dialog-actions-right {
        display: flex;
        gap: 12px;
        margin-left: auto;
      }

      .dialog-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 24px;
      }

      /* 分类选择器 */
      .category-select-wrapper {
        position: relative;
      }

      .category-select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        background: white;
        cursor: pointer;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }

      .category-select:focus {
        outline: none;
        border-color: #4CAF50;
        box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
      }

      .new-category-input {
        margin-top: 8px;
      }

      .new-category-input input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
      }

      /* 分类管理对话框 */
      .category-manager-dialog {
        max-width: 450px;
      }

      .category-list {
        max-height: 300px;
        overflow-y: auto;
        margin-bottom: 16px;
      }

      .category-section {
        margin-bottom: 16px;
      }

      .category-section h4 {
        font-size: 12px;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 8px 0;
      }

      .category-items {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .category-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: #f7f7f7;
        border-radius: 6px;
        transition: background 0.2s;
      }

      .category-item:hover {
        background: #f0f0f0;
      }

      .category-item.default {
        background: #f0f7f4;
      }

      .category-name {
        flex: 1;
        font-size: 14px;
        color: #333;
      }

      .category-badge {
        font-size: 11px;
        padding: 2px 8px;
        background: #4CAF50;
        color: white;
        border-radius: 10px;
      }

      .category-count {
        font-size: 12px;
        color: #888;
        padding: 2px 8px;
        background: #e0e0e0;
        border-radius: 10px;
      }

      .category-rename-btn,
      .category-delete-btn {
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
      }

      .category-rename-btn svg,
      .category-delete-btn svg {
        width: 14px;
        height: 14px;
        color: #666;
      }

      .category-rename-btn:hover {
        background: #4CAF50;
      }

      .category-rename-btn:hover svg {
        color: white;
      }

      .category-delete-btn:hover {
        background: #d32f2f;
      }

      .category-delete-btn:hover svg {
        color: white;
      }

      .category-rename-input {
        flex: 1;
        padding: 6px 8px;
        border: 1px solid #4CAF50;
        border-radius: 4px;
        font-size: 14px;
      }

      .add-category-section {
        padding: 12px;
        background: #f7f7f7;
        border-radius: 8px;
        margin-bottom: 16px;
      }

      .add-category-input-group {
        display: flex;
        gap: 8px;
      }

      .add-category-input-group input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
      }

      .add-category-input-group input:focus {
        outline: none;
        border-color: #4CAF50;
      }

      .add-category-btn {
        padding: 8px 16px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .add-category-btn:hover {
        background: #45a049;
      }

      .no-custom-categories {
        text-align: center;
        color: #999;
        font-size: 14px;
        padding: 20px;
        font-style: italic;
      }

      /* Toast 提示样式 */
      .prompt-assistant-toast {
        position: fixed;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 24px;
        font-size: 14px;
        z-index: 1000002;
        animation: toastFadeIn 0.2s ease;
        transition: opacity 0.3s ease;
      }

      @keyframes toastFadeIn {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }

      /* 顶部操作按钮组 */
      .header-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .mode-toggle-btn {
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: #f5f5f5;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .mode-toggle-btn svg {
        width: 18px;
        height: 18px;
        color: #666;
      }

      .mode-toggle-btn:hover {
        background: #e8e8e8;
      }

      .mode-toggle-btn.active {
        background: #4CAF50;
      }

      .mode-toggle-btn.active svg {
        color: white;
      }

      .mode-toggle-btn#delete-mode-btn.active {
        background: #d32f2f;
      }

      /* 提示词项操作按钮 */
      .item-mode-actions {
        display: none;
        position: absolute;
        top: 6px;
        right: 6px;
        gap: 4px;
      }

      /* 编辑模式：显示编辑按钮 */
      .prompt-assistant-popup.edit-mode .item-mode-actions,
      .prompt-assistant-popup.delete-mode .item-mode-actions {
        display: flex;
      }

      /* 编辑模式：只显示编辑按钮 */
      .prompt-assistant-popup.edit-mode .item-delete-btn {
        display: none;
      }

      /* 删除模式：只显示删除按钮 */
      .prompt-assistant-popup.delete-mode .item-edit-btn {
        display: none;
      }

      /* 删除模式：悬停时显示红色边框 */
      .prompt-assistant-popup.delete-mode .prompt-item:hover {
        border-color: #d32f2f;
        background: #ffebee;
      }

      /* 模式下提示词可点击 */
      .prompt-assistant-popup.edit-mode .prompt-item,
      .prompt-assistant-popup.delete-mode .prompt-item {
        cursor: default;
      }

      .prompt-assistant-popup.edit-mode .item-action-btn,
      .prompt-assistant-popup.delete-mode .item-action-btn {
        cursor: pointer;
      }

      .item-action-btn {
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
      }

      .item-action-btn svg {
        width: 14px;
        height: 14px;
        color: #666;
      }

      .item-edit-btn:hover {
        background: #4CAF50;
      }

      .item-edit-btn:hover svg {
        color: white;
      }

      .item-delete-btn:hover {
        background: #d32f2f;
      }

      .item-delete-btn:hover svg {
        color: white;
      }

      /* 确认删除对话框 */
      .confirm-dialog {
        text-align: center;
      }

      .confirm-dialog p {
        color: #666;
        margin: 16px 0 24px;
        font-size: 14px;
      }

      .confirm-dialog-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .delete-confirm-btn {
        background: #d32f2f;
        color: white;
      }

      .delete-confirm-btn:hover {
        background: #c62828;
      }

      /* 暗色主题支持 */
      @media (prefers-color-scheme: dark) {
        .prompt-assistant-popup {
          background: #1e1e1e;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
        }

        .popup-header {
          background: #2e7d32;
        }

        .prompt-item {
          background: #2a2a2a;
        }

        .prompt-item:hover {
          background: #1b5e20;
        }

        .prompt-title {
          color: #e0e0e0;
        }

        .prompt-preview {
          color: #999;
        }

        .no-prompts {
          color: #777;
        }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = 'prompt-assistant-styles';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  // 初始化
  async init() {
    const hostname = window.location.hostname;
    console.log(`[插件初始化] hostname: ${hostname}, 检测到的网站: ${this.currentSite}`);

    // 如果检测到Unknown网站，尝试用通用选择器
    if (this.currentSite === 'Unknown') {
      console.warn('[插件初始化] 未识别的网站，将使用默认选择器');
    }

    console.log(`AI Prompt Assistant 已激活 - 当前网站: ${this.currentSite}`);

    try {
      // 获取数据和设置
      await this.loadData();

      // 检查当前网站是否在启用列表中
      const enabledSites = await chrome.runtime.sendMessage({ type: 'GET_ENABLED_SITES' });
      const currentHostname = window.location.hostname;

      console.log('[网站检查] 启用的网站列表:', enabledSites);
      console.log('[网站检查] 当前hostname:', currentHostname);

      // 更灵活的匹配逻辑
      const isSiteEnabled = enabledSites.some(site => {
        console.log(`[网站检查] 检查匹配: "${site}" vs "${currentHostname}"`);

        // 处理 .domain.com 格式
        if (site.startsWith('.')) {
          const baseDomain = site.substring(1);
          const match = currentHostname.endsWith(baseDomain) || currentHostname === baseDomain;
          console.log(`[网站检查] 子域名格式: "${baseDomain}" -> ${match}`);
          return match;
        }
        // 处理 domain.com 格式
        const match = currentHostname.includes(site) || currentHostname === site;
        console.log(`[网站检查] 完全匹配: "${site}" -> ${match}`);
        return match;
      });

      console.log('[网站检查] 最终是否启用:', isSiteEnabled);

      if (!isSiteEnabled) {
        console.log(`当前网站 ${currentHostname} 未启用，插件将不工作`);
        return;
      }

      // 动态注入CSS样式（仅在启用的网站上注入）
      this.injectStyles();

      // 立即创建悬浮球（预加载，确保用户点击时立即可用）
      this.createFloatingIcon();

      // 查找输入框
      this.findInputElements();

      // 监听DOM变化
      this.observeChanges();

      // 监听来自popup的消息
      this.setupMessageListener();

      // 启动定期清理漂浮图标（每2秒检查一次）
      this.startFloatingIconCleanup();
    } catch (error) {
      console.error('AI Prompt Assistant 初始化失败:', error);
    }
  }

  // 定期清理漂浮图标
  startFloatingIconCleanup() {
    if (this.floatingCleanupInterval) {
      clearInterval(this.floatingCleanupInterval);
    }

    this.floatingCleanupInterval = setInterval(() => {
      this.cleanupFloatingIcons();
    }, 2000);
  }

  // 清理漂浮图标（适配单一悬浮球机制）
  cleanupFloatingIcons() {
    // 如果有多个图标（可能是旧机制残留），只保留主悬浮球
    const allIcons = document.querySelectorAll('.prompt-assistant-icon');
    if (allIcons.length <= 1) return;

    console.log(`[清理] 发现 ${allIcons.length} 个图标，保留主悬浮球`);

    // 找到主悬浮球（带 id 的）
    const mainIcon = document.getElementById('prompt-assistant-floating-icon');

    allIcons.forEach(icon => {
      if (icon !== mainIcon && icon.parentNode) {
        icon.remove();
      }
    });
  }

  // 加载存储的数据
  async loadData() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PROMPTS' });
      this.prompts = response || {};

      const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      this.settings = settingsResponse || {};
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  }

  // 查找输入框元素
  findInputElements() {
    // 根据不同网站的特征选择器
    const selectors = {
      'DeepSeek': [
        'textarea[placeholder*="输入"]',
        'textarea[placeholder*="message"]',
        'div[contenteditable="true"]',
        'textarea'
      ],
      '豆包': [
        // 豆包可能使用的选择器
        'div[contenteditable="true"]',
        'div[role="textbox"]',
        'textarea[placeholder*="问"]',
        'textarea[placeholder*="输入"]',
        'div[class*="editor"]',
        'div[class*="Editor"]',
        'div[class*="input"]',
        'div[class*="Input"]',
        'textarea',
        // 更通用的选择器
        '[contenteditable]',
        '[role="textbox"]'
      ],
      '腾讯元宝': [
        'div[contenteditable="true"]',
        'textarea',
        'div[class*="input"]',
        'div[class*="editor"]'
      ],
      'zAI': [
        // z.ai 可能使用的选择器
        'div[contenteditable="true"]',
        'div[role="textbox"]',
        'textarea',
        'div[class*="editor"]',
        'div[class*="Editor"]',
        'div[class*="input"]',
        'div[class*="Input"]',
        'div[class*="textarea"]',
        'div[class*="Textarea"]',
        'div[class*="message"]',
        'div[class*="prompt"]',
        '[contenteditable]',
        '[role="textbox"]'
      ],
      'DesignKit': [
        // designkit.cn 可能使用的选择器
        'div[contenteditable="true"]',
        'div[role="textbox"]',
        'textarea',
        'div[class*="editor"]',
        'div[class*="Editor"]',
        'div[class*="input"]',
        'div[class*="Input"]',
        'div[class*="textarea"]',
        'div[class*="Textarea"]',
        'div[class*="message"]',
        'div[class*="prompt"]',
        '[contenteditable]',
        '[role="textbox"]'
      ],
      'default': [
        'textarea',
        'div[contenteditable="true"]',
        'input[type="text"]',
        '[role="textbox"]',
        '[contenteditable]'
      ]
    };

    const siteSelectors = selectors[this.currentSite] || selectors.default;
    const allInputs = new Set();

    // 收集所有输入框
    siteSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (this.isTextInput(element)) {
          allInputs.add(element);
        }
      });
    });

    const allInputsArray = Array.from(allInputs);
    console.log(`[查找输入框] 共找到 ${allInputsArray.length} 个输入框`);

    // 移除已不存在的输入框的监听器
    const removedInputs = this.inputElements.filter(element => !allInputs.has(element));
    removedInputs.forEach(element => {
      if (element._focusHandler) {
        element.removeEventListener('focus', element._focusHandler);
      }
    });

    // 为所有输入框添加焦点监听（包括已存在的）
    allInputsArray.forEach(element => {
      if (!element._focusHandler) {
        // 创建焦点处理器
        element._focusHandler = () => {
          console.log('[输入框获得焦点]', element);
          this.handleInputFocus(element);
        };
        element.addEventListener('focus', element._focusHandler, true);
      }
    });

    // 更新输入框列表
    this.inputElements = allInputsArray;

    // 如果还没有悬浮球，创建一个
    if (!this.floatingIcon) {
      this.createFloatingIcon();
    } else {
      // 如果有当前焦点元素，更新图标位置
      if (this.currentFocusedInput) {
        this.positionIcon(this.floatingIcon, this.currentFocusedInput);
      }
    }
  }

  // 处理输入框获得焦点
  handleInputFocus(inputElement) {
    this.currentFocusedInput = inputElement;

    if (this.floatingIcon) {
      // 显示图标
      this.floatingIcon.style.opacity = '1';
      this.floatingIcon.style.pointerEvents = 'auto';
      // 移动图标到当前输入框
      this.positionIcon(this.floatingIcon, inputElement);
    }
  }

  // 创建单一的悬浮球
  createFloatingIcon() {
    const icon = document.createElement('div');
    icon.className = 'prompt-assistant-icon';
    icon.id = 'prompt-assistant-floating-icon';
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
        <circle cx="19" cy="5" r="3" fill="#4CAF50"/>
      </svg>
    `;

    // 初始半透明可见，默认定位在右侧中间
    icon.style.opacity = '0.5';
    icon.style.pointerEvents = 'auto';
    icon.style.position = 'fixed';
    icon.style.right = '8px';
    icon.style.top = '50%';
    icon.style.transform = 'translateY(-50%)';
    icon.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

    // 点击事件
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 如果有聚焦的输入框，使用它
      if (this.currentFocusedInput) {
        this.showPromptPopup(icon, this.currentFocusedInput);
        return;
      }

      // 如果没有聚焦的输入框，尝试找到第一个可用输入框
      let targetInput = null;

      // 优先使用已缓存的输入框列表
      if (this.inputElements.length > 0) {
        targetInput = this.inputElements[0];
      } else {
        // 如果缓存为空，实时查找
        const selectors = ['textarea', 'div[contenteditable="true"]', 'input[type="text"]', '[role="textbox"]'];
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && this.isTextInput(element)) {
            targetInput = element;
            break;
          }
        }
      }

      if (targetInput) {
        // 聚焦找到的输入框并显示弹窗
        targetInput.focus();
        this.currentFocusedInput = targetInput;
        this.handleInputFocus(targetInput);
        this.showPromptPopup(icon, targetInput);
      } else {
        console.warn('[悬浮球点击] 未找到可用的输入框');
        this.showToast('请先点击输入框');
      }
    });

    // 鼠标悬停高亮
    icon.addEventListener('mouseenter', () => {
      icon.style.opacity = '1';
      icon.style.transform = 'scale(1.15)';
    });

    icon.addEventListener('mouseleave', () => {
      if (!this.currentFocusedInput || document.activeElement !== this.currentFocusedInput) {
        icon.style.opacity = '0.5';
      }
      icon.style.transform = 'scale(1)';
    });

    document.body.appendChild(icon);
    this.floatingIcon = icon;
    console.log('[创建悬浮球] 悬浮球已创建');
  }

  // 判断是否为文本输入元素
  isTextInput(element) {
    const tagName = element.tagName.toLowerCase();
    const inputType = element.type ? element.type.toLowerCase() : '';

    if (tagName === 'textarea') return true;
    if (tagName === 'input' && (inputType === 'text' || inputType === 'search')) return true;
    if (tagName === 'div' && element.getAttribute('contenteditable') === 'true') return true;

    return false;
  }

  // 添加提示图标（已废弃，使用 createFloatingIcon 替代）
  addPromptIcon(inputElement) {
    // 此函数已被新的焦点跟随机制替代
    console.warn('[addPromptIcon] 此函数已废弃，请使用 createFloatingIcon');
  }

  // 定位图标 - 跟随输入框位置，支持动画过渡
  positionIcon(icon, inputElement) {
    // 检查输入框是否仍然有效
    if (!inputElement || !inputElement.isConnected) {
      return;
    }

    const rect = inputElement.getBoundingClientRect();
    const iconSize = 36;
    const margin = 8;
    const rightEdge = 8; // 距离窗口右侧边缘的距离

    // 视口边界
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // 检查输入框是否可见
    const inputVisible = rect.bottom > 0 &&
                        rect.top < viewportHeight &&
                        rect.width > 0 &&
                        rect.height > 0;

    // 如果输入框完全不可见，隐藏图标
    if (!inputVisible) {
      icon.style.opacity = '0';
      return;
    }

    // 计算垂直位置：跟随输入框的垂直中心
    let top = rect.top + (rect.height / 2) - (iconSize / 2);

    // 边界检查：确保图标不会超出视口
    if (top < margin) {
      top = margin;
    }
    if (top + iconSize > viewportHeight - margin) {
      top = viewportHeight - iconSize - margin;
    }

    // 获取用户设置的位置偏好
    const iconPosition = this.settings.iconPosition || 'right';

    // 计算水平位置
    let left;
    if (iconPosition === 'left') {
      // 左侧：输入框左边
      left = rect.left - iconSize - margin;
      if (left < margin) {
        left = rect.right + margin; // 如果放不下，放到右边
      }
    } else {
      // 右侧：窗口右侧贴边
      left = viewportWidth - iconSize - rightEdge;
    }

    // 应用定位
    icon.style.position = 'fixed';
    icon.style.left = `${left}px`;
    icon.style.top = `${top}px`;
    icon.style.right = 'auto';
    icon.style.bottom = 'auto';
    icon.style.zIndex = '999999';

    // 平滑过渡动画
    icon.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
  }

  // 显示提示词弹出窗口 - 全新设计
  showPromptPopup(icon, inputElement) {
    // 如果已有弹窗，先关闭
    if (this.currentPopup) {
      this.closePopup();
    }

    const popup = document.createElement('div');
    popup.className = 'prompt-assistant-popup';

    // 扁平化所有提示词（用于搜索和两列显示）
    const allPrompts = [];
    Object.entries(this.prompts).forEach(([category, prompts]) => {
      prompts.forEach((prompt, index) => {
        allPrompts.push({ ...prompt, category, index });
      });
    });

    // 构建HTML
    popup.innerHTML = `
      <div class="popup-header">
        <div class="popup-header-top">
          <h2>快速提示词</h2>
          <div class="header-actions">
            <button class="mode-toggle-btn" id="edit-mode-btn" title="编辑模式">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
              </svg>
            </button>
            <button class="mode-toggle-btn" id="delete-mode-btn" title="删除模式">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/>
              </svg>
            </button>
            <button class="close-btn">×</button>
          </div>
        </div>
        <div class="popup-search">
          <div class="popup-search-wrapper">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
            </svg>
            <input type="text" placeholder="搜索提示词..." id="prompt-search-input">
          </div>
        </div>
        <div class="popup-filters">
          <button class="filter-tag active" data-filter="all">全部 (${allPrompts.length})</button>
          ${Object.keys(this.prompts).map(cat => `
            <button class="filter-tag" data-filter="${cat}">${cat}</button>
          `).join('')}
        </div>
      </div>
      <div class="popup-content">
        <div class="prompt-grid" id="prompt-grid">
          ${allPrompts.length === 0 ? '<div class="no-prompts">暂无提示词，请先在插件设置中添加</div>' :
            allPrompts.map(prompt => `
              <div class="prompt-item" data-category="${prompt.category}" data-index="${prompt.index}">
                <div class="prompt-title">${this.escapeHtml(prompt.title)}</div>
                <div class="prompt-preview">${this.escapeHtml(prompt.content)}</div>
                <div class="item-mode-actions">
                  <button class="item-action-btn item-edit-btn" data-category="${prompt.category}" data-index="${prompt.index}" title="编辑">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                    </svg>
                  </button>
                  <button class="item-action-btn item-delete-btn" data-category="${prompt.category}" data-index="${prompt.index}" title="删除">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>
            `).join('')
          }
        </div>
        <button class="add-prompt-btn">+ 添加新提示词</button>
      </div>
    `;

    // 插入到 document.documentElement 而不是 body，避免被 body 的 transform 影响
    // 使用 prepend 确保在其他元素之前
    if (document.documentElement) {
      document.documentElement.appendChild(popup);
    } else {
      document.body.appendChild(popup);
    }

    // 智能定位弹窗（确保在视口内完整显示）
    const iconRect = icon.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 水平定位策略：优先在悬浮球左侧，空间不足则右侧
    let left;
    if (iconRect.left - popupRect.width - margin >= margin) {
      // 左侧有足够空间
      left = iconRect.left - popupRect.width - margin;
    } else if (iconRect.right + popupRect.width + margin <= viewportWidth - margin) {
      // 右侧有足够空间
      left = iconRect.right + margin;
    } else {
      // 两侧都不够，居中显示
      left = Math.max(margin, (viewportWidth - popupRect.width) / 2);
    }

    // 垂直定位策略：优先与悬浮球顶部对齐，空间不足则向下调整
    let top = iconRect.top;

    // 确保底部不超出视口
    if (top + popupRect.height > viewportHeight - margin) {
      top = viewportHeight - popupRect.height - margin;
    }

    // 确保顶部不超出视口
    if (top < margin) {
      top = margin;
    }

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.maxHeight = `${viewportHeight - top * 2}px`; // 动态设置最大高度

    this.currentPopup = popup;

    // 添加事件监听
    this.setupPopupEvents(popup, inputElement);
  }

  // 设置弹窗事件
  setupPopupEvents(popup, inputElement) {
    // 存储当前过滤状态
    let currentFilter = 'all';
    let currentSearch = '';
    let currentMode = 'normal'; // 'normal', 'edit', 'delete'

    // 切换模式函数
    const setMode = (mode) => {
      currentMode = mode;
      popup.classList.remove('edit-mode', 'delete-mode');

      if (mode === 'edit') {
        popup.classList.add('edit-mode');
        popup.querySelector('#edit-mode-btn').classList.add('active');
        popup.querySelector('#delete-mode-btn').classList.remove('active');
      } else if (mode === 'delete') {
        popup.classList.add('delete-mode');
        popup.querySelector('#delete-mode-btn').classList.add('active');
        popup.querySelector('#edit-mode-btn').classList.remove('active');
      } else {
        popup.querySelector('#edit-mode-btn').classList.remove('active');
        popup.querySelector('#delete-mode-btn').classList.remove('active');
      }
    };

    // 编辑模式切换按钮
    popup.querySelector('#edit-mode-btn').addEventListener('click', () => {
      if (currentMode === 'edit') {
        setMode('normal');
      } else {
        setMode('edit');
      }
    });

    // 删除模式切换按钮
    popup.querySelector('#delete-mode-btn').addEventListener('click', () => {
      if (currentMode === 'delete') {
        setMode('normal');
      } else {
        setMode('delete');
      }
    });

    // 过滤提示词的函数
    const filterPrompts = () => {
      const promptItems = popup.querySelectorAll('.prompt-item');
      let visibleCount = 0;

      promptItems.forEach(item => {
        const category = item.dataset.category;
        const title = item.querySelector('.prompt-title').textContent;
        const preview = item.querySelector('.prompt-preview').textContent;

        // 检查分类过滤
        const matchesFilter = currentFilter === 'all' || category === currentFilter;

        // 检查搜索过滤
        const searchText = currentSearch.toLowerCase();
        const matchesSearch = !searchText ||
          title.toLowerCase().includes(searchText) ||
          preview.toLowerCase().includes(searchText);

        if (matchesFilter && matchesSearch) {
          item.classList.remove('hidden');
          visibleCount++;
        } else {
          item.classList.add('hidden');
        }
      });

      // 显示/隐藏无结果提示
      let noResults = popup.querySelector('.no-results');
      if (visibleCount === 0 && !noResults) {
        noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.textContent = currentSearch ? '没有找到匹配的提示词' : '该分类下暂无提示词';
        popup.querySelector('.prompt-grid').appendChild(noResults);
      } else if (visibleCount > 0 && noResults) {
        noResults.remove();
      }
    };

    // 搜索输入事件
    const searchInput = popup.querySelector('#prompt-search-input');
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      filterPrompts();
    });

    // 过滤标签点击事件
    popup.querySelectorAll('.filter-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        // 更新激活状态
        popup.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');

        // 更新当前过滤
        currentFilter = tag.dataset.filter;
        filterPrompts();
      });
    });

    // 关闭按钮
    popup.querySelector('.close-btn').addEventListener('click', () => {
      this.closePopup();
    });

    // 点击外部关闭
    const closeOnOutsideClick = (e) => {
      if (!popup.contains(e.target)) {
        this.closePopup();
        document.removeEventListener('click', closeOnOutsideClick);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeOnOutsideClick);
    }, 100);

    // 提示词点击事件（点击提示词主体插入内容）
    popup.querySelectorAll('.prompt-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // 在编辑/删除模式下，点击操作按钮时不执行插入
        if (e.target.closest('.item-action-btn')) {
          return;
        }

        // 在编辑/删除模式下，点击提示词主体也不执行插入
        if (currentMode !== 'normal') {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const category = item.dataset.category;
        const index = parseInt(item.dataset.index);
        const prompt = this.prompts[category][index];

        // 确保输入框仍然有效且可操作
        if (inputElement && inputElement.isConnected) {
          // 重新聚焦输入框（确保状态正确）
          inputElement.focus();

          // 延迟一小段时间执行插入，确保焦点完全生效
          setTimeout(() => {
            this.insertPrompt(inputElement, prompt.content);

            // 延迟关闭弹窗，让用户看到插入成功
            setTimeout(() => {
              this.closePopup();
              // 显示成功提示
              this.showToast(`已插入: ${prompt.title}`);
            }, 100);
          }, 20);
        } else {
          console.error('输入框不可用');
          this.showToast('插入失败：输入框不可用');
          this.closePopup();
        }
      });
    });

    // 编辑按钮点击事件
    popup.querySelectorAll('.item-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const category = btn.dataset.category;
        const index = parseInt(btn.dataset.index);
        this.showEditPromptDialog(category, index);
      });
    });

    // 删除按钮点击事件
    popup.querySelectorAll('.item-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const category = btn.dataset.category;
        const index = parseInt(btn.dataset.index);
        const prompt = this.prompts[category][index];
        this.showDeleteConfirmDialog(category, index, prompt.title);
      });
    });

    // 添加新提示词
    popup.querySelector('.add-prompt-btn').addEventListener('click', () => {
      // 传递当前选中的分类过滤器
      this.showAddPromptDialog(currentFilter === 'all' ? null : currentFilter);
    });
  }

  // 插入提示词 - 修复光标位置，确保始终在插入内容后面
  insertPrompt(inputElement, content) {
    // 确保输入框获得焦点
    inputElement.focus();

    // 等待一小段时间确保焦点生效
    setTimeout(() => {
      try {
        if (inputElement.tagName.toLowerCase() === 'textarea' || inputElement.tagName.toLowerCase() === 'input') {
          // 重新获取光标位置（因为可能已经变化）
          const start = inputElement.selectionStart || 0;
          const end = inputElement.selectionEnd || 0;
          const value = inputElement.value || '';

          // 在光标位置插入内容
          const newValue = value.substring(0, start) + content + value.substring(end);
          inputElement.value = newValue;

          // 计算新的光标位置（在插入内容的末尾）
          const newCursorPos = start + content.length;

          // 立即设置光标位置
          inputElement.setSelectionRange(newCursorPos, newCursorPos);

          // 滚动到光标位置（确保长文本可见）
          inputElement.scrollTop = inputElement.scrollHeight;

          // 触发输入事件（确保应用能感知到变化）
          const inputEvent = new Event('input', { bubbles: true, cancelable: true });
          inputElement.dispatchEvent(inputEvent);

          // 也触发 change 事件（某些应用可能监听这个）
          const changeEvent = new Event('change', { bubbles: true, cancelable: true });
          inputElement.dispatchEvent(changeEvent);

          // 对于 React 应用，可能需要触发更复杂的事件
          const reactEvent = new Event('keydown', { bubbles: true, cancelable: true });
          reactEvent.key = 'a'; // 模拟按键
          inputElement.dispatchEvent(reactEvent);

          // 关键：在所有事件触发后，再次确保光标位置正确
          // 这是因为某些框架（如 React）可能会在事件处理后重置光标
          setTimeout(() => {
            inputElement.setSelectionRange(newCursorPos, newCursorPos);

            // 再次滚动到光标位置（确保长文本可见）
            inputElement.scrollTop = inputElement.scrollHeight;

            // 额外验证：检查光标位置是否正确
            if (inputElement.selectionStart !== newCursorPos || inputElement.selectionEnd !== newCursorPos) {
              console.warn('光标位置被重置，重新设置');
              inputElement.setSelectionRange(newCursorPos, newCursorPos);
              inputElement.scrollTop = inputElement.scrollHeight;
            }
          }, 5);

        } else if (inputElement.getAttribute('contenteditable') === 'true') {
          // 对于 contenteditable 元素

          // 步骤1: 获取或创建选区，确保在输入框内且在末尾
          let selection = window.getSelection();
          let range;

          if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
            // 确保选区在目标元素内
            if (!inputElement.contains(range.commonAncestorContainer)) {
              range = document.createRange();
              range.selectNodeContents(inputElement);
              range.collapse(false);
            }
          } else {
            range = document.createRange();
            range.selectNodeContents(inputElement);
            range.collapse(false);
          }

          // 步骤2: 删除选中的内容（如果有）
          range.deleteContents();

          // 步骤3: 插入新内容
          const textNode = document.createTextNode(content);
          range.insertNode(textNode);

          // 步骤4: 立即将光标移动到插入内容的末尾
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);

          // 步骤5: 确保输入框获得焦点
          inputElement.focus();

          // 步骤6: 创建强制设置光标的函数（可重复调用）
          const forceSetCursor = () => {
            try {
              const sel = window.getSelection();
              const r = document.createRange();
              r.setStartAfter(textNode);
              r.setEndAfter(textNode);
              sel.removeAllRanges();
              sel.addRange(r);
              inputElement.focus();
              return true;
            } catch (e) {
              console.warn('设置光标失败:', e);
              return false;
            }
          };

          // 步骤7: 触发输入事件（让应用感知变化）
          const inputEvent = new Event('input', { bubbles: true, cancelable: true });
          inputElement.dispatchEvent(inputEvent);

          // 步骤8: 立即再次设置光标（抢在框架之前）
          forceSetCursor();

          // 步骤9: 触发其他可能需要的事件
          const changeEvent = new Event('change', { bubbles: true, cancelable: true });
          inputElement.dispatchEvent(changeEvent);

          // React 特殊处理
          if (inputElement._reactFiber || inputElement._reactInternalInstance) {
            const keydownEvent = new KeyboardEvent('keydown', { bubbles: true, key: 'Insert' });
            inputElement.dispatchEvent(keydownEvent);
          }

          // 步骤10: 滚动到插入位置
          setTimeout(() => {
            try {
              if (textNode.parentElement && textNode.parentElement.scrollIntoView) {
                textNode.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } else if (inputElement.scrollTop !== undefined) {
                inputElement.scrollTop = inputElement.scrollHeight;
              }
            } catch (e) {
              console.warn('滚动失败:', e);
            }
          }, 0);

          // 步骤11: 持续监控和强制设置光标（针对腾讯元宝等顽固框架）
          // 使用更激进的策略：多次重置，时间间隔更短但次数更多
          const monitorTimes = [5, 15, 30, 50, 80, 120, 200];
          monitorTimes.forEach((delay, index) => {
            setTimeout(() => {
              const currentSel = window.getSelection();
              if (currentSel.rangeCount === 0) return;

              const currentRange = currentSel.getRangeAt(0);
              const startContainer = currentRange.startContainer;
              const startOffset = currentRange.startOffset;

              // 检查光标是否在正确位置（更宽松的条件）
              let isCorrect = false;

              // 条件1: 在 textNode 内部，且 offset 在末尾
              if (startContainer === textNode && startOffset === textNode.length) {
                isCorrect = true;
              }
              // 条件2: 在 textNode 之后（textNode 是前一个兄弟节点）
              else if (startContainer === inputElement && startOffset > 0) {
                const prevNode = inputElement.childNodes[startOffset - 1];
                if (prevNode === textNode) {
                  isCorrect = true;
                }
              }
              // 条件3: 在 textNode 之后（通过 childNodes 判断）
              else if (startContainer === inputElement) {
                // 检查当前光标位置的前一个节点是否是 textNode
                const nodes = Array.from(inputElement.childNodes);
                const textNodeIndex = nodes.indexOf(textNode);
                if (textNodeIndex >= 0 && startOffset > textNodeIndex) {
                  isCorrect = true;
                }
              }

              if (!isCorrect) {
                console.log(`光标位置异常(第${index + 1}次尝试 ${delay}ms)，强制重置`);
                forceSetCursor();
              }
            }, delay);
          });

        }

        console.log('提示词插入成功，光标位置:',
          inputElement.tagName.toLowerCase() === 'textarea' || inputElement.tagName.toLowerCase() === 'input'
            ? `位置 ${inputElement.selectionStart}`
            : 'ContentEditable 已设置'
        );
      } catch (error) {
        console.error('插入提示词时出错:', error);
        // 降级方案：直接追加到末尾
        try {
          if (inputElement.tagName.toLowerCase() === 'textarea' || inputElement.tagName.toLowerCase() === 'input') {
            const oldValue = inputElement.value || '';
            inputElement.value = oldValue + content;
            const newPos = oldValue.length + content.length;
            inputElement.setSelectionRange(newPos, newPos);
            inputElement.scrollTop = inputElement.scrollHeight;
          } else if (inputElement.getAttribute('contenteditable') === 'true') {
            inputElement.textContent += content;
          }
          inputElement.focus();
          const event = new Event('input', { bubbles: true });
          inputElement.dispatchEvent(event);
          console.log('降级方案成功');
        } catch (fallbackError) {
          console.error('降级方案也失败:', fallbackError);
        }
      }
    }, 10);
  }

  // 显示添加提示词对话框
  showAddPromptDialog(preselectCategory = null) {
    this.closePopup();

    // 获取所有分类
    const categories = Object.keys(this.prompts);
    const defaultCategories = ['角色扮演', '写作助手', '学习辅助'];

    // 辅助函数：检查是否需要预选
    const isSelected = (cat) => preselectCategory && cat === preselectCategory ? 'selected' : '';

    const dialog = document.createElement('div');
    dialog.className = 'prompt-assistant-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>添加新提示词</h3>
        <div class="form-group">
          <label>分类：</label>
          <div class="category-select-wrapper">
            <select id="prompt-category" class="category-select">
              <option value="">-- 选择分类 --</option>
              ${defaultCategories.map(cat =>
                `<option value="${this.escapeHtml(cat)}" ${isSelected(cat)}>${this.escapeHtml(cat)}</option>`
              ).join('')}
              ${categories.filter(cat => !defaultCategories.includes(cat)).map(cat =>
                `<option value="${this.escapeHtml(cat)}" ${isSelected(cat)}>${this.escapeHtml(cat)}</option>`
              ).join('')}
              <option value="__new__">+ 新建分类...</option>
            </select>
          </div>
          <div class="new-category-input" id="new-category-input" style="display: none;">
            <input type="text" id="prompt-new-category" placeholder="输入新分类名称">
          </div>
        </div>
        <div class="form-group">
          <label>标题：</label>
          <input type="text" id="prompt-title" placeholder="简短描述">
        </div>
        <div class="form-group">
          <label>内容：</label>
          <textarea id="prompt-content" placeholder="提示词内容"></textarea>
        </div>
        <div class="dialog-actions">
          <button class="text-btn" id="manage-categories-btn">管理分类</button>
          <div class="dialog-actions-right">
            <button class="cancel-btn">取消</button>
            <button class="save-btn">保存</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // 分类选择变化
    const categorySelect = dialog.querySelector('#prompt-category');
    const newCategoryInput = dialog.querySelector('#new-category-input');

    categorySelect.addEventListener('change', () => {
      if (categorySelect.value === '__new__') {
        newCategoryInput.style.display = 'block';
        dialog.querySelector('#prompt-new-category').focus();
      } else {
        newCategoryInput.style.display = 'none';
      }
    });

    // 管理分类按钮
    dialog.querySelector('#manage-categories-btn').addEventListener('click', () => {
      dialog.remove();
      this.showCategoryManagerDialog();
    });

    // 事件监听
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
      dialog.remove();
    });

    dialog.querySelector('.save-btn').addEventListener('click', async () => {
      let category = categorySelect.value;
      const newCategory = dialog.querySelector('#prompt-new-category').value.trim();
      const title = dialog.querySelector('#prompt-title').value.trim();
      const content = dialog.querySelector('#prompt-content').value.trim();

      // 如果选择新建分类
      if (category === '__new__') {
        category = newCategory || '';
      }

      if (category && title && content) {
        await chrome.runtime.sendMessage({
          type: 'SAVE_PROMPT',
          data: {
            category,
            prompt: { title, content }
          }
        });

        // 重新加载数据
        await this.loadData();
        dialog.remove();

        // 显示成功提示
        this.showToast('提示词已保存');

        // 重新打开弹窗
        const icon = document.querySelector('.prompt-assistant-icon');
        if (icon) {
          let inputElement = null;
          this.iconElements.forEach((el, input) => {
            if (el === icon) inputElement = input;
          });
          if (inputElement) {
            this.showPromptPopup(icon, inputElement);
          }
        }
      } else {
        this.showToast('请填写完整信息');
      }
    });

    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });
  }

  // 显示编辑提示词对话框
  showEditPromptDialog(category, index) {
    // 关闭当前弹窗
    this.closePopup();

    const prompt = this.prompts[category][index];
    if (!prompt) return;

    // 获取所有分类
    const categories = Object.keys(this.prompts);
    const defaultCategories = ['角色扮演', '写作助手', '学习辅助'];

    const dialog = document.createElement('div');
    dialog.className = 'prompt-assistant-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>编辑提示词</h3>
        <div class="form-group">
          <label>分类：</label>
          <div class="category-select-wrapper">
            <select id="edit-prompt-category" class="category-select">
              ${defaultCategories.map(cat =>
                `<option value="${this.escapeHtml(cat)}" ${cat === category ? 'selected' : ''}>${this.escapeHtml(cat)}</option>`
              ).join('')}
              ${categories.filter(cat => !defaultCategories.includes(cat)).map(cat =>
                `<option value="${this.escapeHtml(cat)}" ${cat === category ? 'selected' : ''}>${this.escapeHtml(cat)}</option>`
              ).join('')}
              <option value="__new__">+ 新建分类...</option>
            </select>
          </div>
          <div class="new-category-input" id="edit-new-category-input" style="display: none;">
            <input type="text" id="edit-prompt-new-category" placeholder="输入新分类名称">
          </div>
        </div>
        <div class="form-group">
          <label>标题：</label>
          <input type="text" id="edit-prompt-title" value="${this.escapeHtml(prompt.title)}" placeholder="简短描述">
        </div>
        <div class="form-group">
          <label>内容：</label>
          <textarea id="edit-prompt-content" placeholder="提示词内容">${this.escapeHtml(prompt.content)}</textarea>
        </div>
        <div class="dialog-actions">
          <button class="text-btn" id="edit-manage-categories-btn">管理分类</button>
          <div class="dialog-actions-right">
            <button class="cancel-btn">取消</button>
            <button class="save-btn">保存修改</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // 分类选择变化
    const categorySelect = dialog.querySelector('#edit-prompt-category');
    const newCategoryInput = dialog.querySelector('#edit-new-category-input');

    categorySelect.addEventListener('change', () => {
      if (categorySelect.value === '__new__') {
        newCategoryInput.style.display = 'block';
        dialog.querySelector('#edit-prompt-new-category').focus();
      } else {
        newCategoryInput.style.display = 'none';
      }
    });

    // 管理分类按钮
    dialog.querySelector('#edit-manage-categories-btn').addEventListener('click', () => {
      dialog.remove();
      this.showCategoryManagerDialog();
    });

    // 事件监听
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
      dialog.remove();
    });

    dialog.querySelector('.save-btn').addEventListener('click', async () => {
      let newCategory = categorySelect.value;
      const newCategoryName = dialog.querySelector('#edit-prompt-new-category').value.trim();
      const newTitle = dialog.querySelector('#edit-prompt-title').value.trim();
      const newContent = dialog.querySelector('#edit-prompt-content').value.trim();

      // 如果选择新建分类
      if (newCategory === '__new__') {
        newCategory = newCategoryName || '';
      }

      if (newCategory && newTitle && newContent) {
        // 先删除旧的提示词
        await chrome.runtime.sendMessage({
          type: 'DELETE_PROMPT',
          data: { category, index }
        });

        // 添加新的提示词（可能分类不同）
        await chrome.runtime.sendMessage({
          type: 'SAVE_PROMPT',
          data: {
            category: newCategory,
            prompt: { title: newTitle, content: newContent }
          }
        });

        // 重新加载数据
        await this.loadData();
        dialog.remove();

        // 显示成功提示
        this.showToast('提示词已更新');

        // 重新打开弹窗
        const icon = document.querySelector('.prompt-assistant-icon');
        if (icon) {
          let inputElement = null;
          this.iconElements.forEach((el, input) => {
            if (el === icon) inputElement = input;
          });
          if (inputElement) {
            this.showPromptPopup(icon, inputElement);
          }
        }
      } else {
        this.showToast('请填写完整信息');
      }
    });

    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });
  }

  // 显示删除确认对话框
  showDeleteConfirmDialog(category, index, title) {
    const dialog = document.createElement('div');
    dialog.className = 'prompt-assistant-dialog';
    dialog.innerHTML = `
      <div class="dialog-content confirm-dialog">
        <h3>确认删除</h3>
        <p>确定要删除提示词「${this.escapeHtml(title)}」吗？<br>此操作无法撤销。</p>
        <div class="confirm-dialog-actions">
          <button class="cancel-btn">取消</button>
          <button class="delete-confirm-btn">确认删除</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // 事件监听
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
      dialog.remove();
    });

    dialog.querySelector('.delete-confirm-btn').addEventListener('click', async () => {
      await chrome.runtime.sendMessage({
        type: 'DELETE_PROMPT',
        data: { category, index }
      });

      // 重新加载数据
      await this.loadData();
      dialog.remove();

      // 刷新弹窗（重新渲染）
      if (this.currentPopup) {
        this.currentPopup.remove();
        // 重新显示弹窗
        const icon = document.querySelector('.prompt-assistant-icon');
        if (icon) {
          // 找到对应的输入框
          let inputElement = null;
          this.iconElements.forEach((el, input) => {
            if (el === icon) inputElement = input;
          });
          if (inputElement) {
            this.showPromptPopup(icon, inputElement);
          }
        }
      }

      // 显示成功提示
      this.showToast('提示词已删除');
    });

    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });
  }

  // 显示分类管理对话框
  showCategoryManagerDialog() {
    const categories = Object.keys(this.prompts);
    const defaultCategories = ['角色扮演', '写作助手', '学习辅助'];
    const customCategories = categories.filter(cat => !defaultCategories.includes(cat));

    const dialog = document.createElement('div');
    dialog.className = 'prompt-assistant-dialog';
    dialog.innerHTML = `
      <div class="dialog-content category-manager-dialog">
        <h3>分类管理</h3>
        <div class="category-list">
          <div class="category-section">
            <h4>默认分类</h4>
            <div class="category-items">
              ${defaultCategories.map(cat => `
                <div class="category-item default">
                  <span class="category-name">${this.escapeHtml(cat)}</span>
                  <span class="category-badge">默认</span>
                </div>
              `).join('')}
            </div>
          </div>
          ${customCategories.length > 0 ? `
            <div class="category-section">
              <h4>自定义分类</h4>
              <div class="category-items">
                ${customCategories.map(cat => `
                  <div class="category-item" data-category="${this.escapeHtml(cat)}">
                    <span class="category-name">${this.escapeHtml(cat)}</span>
                    <span class="category-count">${this.prompts[cat].length}</span>
                    <button class="category-rename-btn" title="重命名" data-category="${this.escapeHtml(cat)}">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                      </svg>
                    </button>
                    <button class="category-delete-btn" title="删除" data-category="${this.escapeHtml(cat)}">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/>
                      </svg>
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : '<p class="no-custom-categories">暂无自定义分类</p>'}
        </div>
        <div class="add-category-section">
          <div class="add-category-input-group">
            <input type="text" id="new-category-name" placeholder="输入新分类名称">
            <button class="add-category-btn" id="add-category-btn">添加</button>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="cancel-btn">关闭</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // 添加新分类
    const addCategoryBtn = dialog.querySelector('#add-category-btn');
    const newCategoryInput = dialog.querySelector('#new-category-name');

    const addNewCategory = async () => {
      const categoryName = newCategoryInput.value.trim();
      if (!categoryName) {
        this.showToast('请输入分类名称');
        return;
      }
      if (categories.includes(categoryName)) {
        this.showToast('分类已存在');
        return;
      }

      // 添加一个空提示词到新分类（创建分类）
      await chrome.runtime.sendMessage({
        type: 'SAVE_PROMPT',
        data: {
          category: categoryName,
          prompt: {
            title: '示例提示词',
            content: '这是一个示例提示词，您可以编辑或删除它'
          }
        }
      });

      await this.loadData();
      dialog.remove();
      this.showCategoryManagerDialog();
      this.showToast('分类已添加');
    };

    addCategoryBtn.addEventListener('click', addNewCategory);
    newCategoryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addNewCategory();
    });

    // 重命名分类
    dialog.querySelectorAll('.category-rename-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const oldName = btn.dataset.category;
        const categoryItem = btn.closest('.category-item');
        const nameSpan = categoryItem.querySelector('.category-name');

        // 替换为输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldName;
        input.className = 'category-rename-input';

        const saveRename = async () => {
          const newName = input.value.trim();
          if (!newName || newName === oldName) {
            nameSpan.style.display = '';
            input.remove();
            return;
          }
          if (categories.includes(newName)) {
            this.showToast('分类已存在');
            return;
          }

          // 将该分类下所有提示词移动到新分类
          const prompts = this.prompts[oldName];
          for (const prompt of prompts) {
            await chrome.runtime.sendMessage({
              type: 'SAVE_PROMPT',
              data: {
                category: newName,
                prompt
              }
            });
          }

          // 删除旧分类下的所有提示词
          for (let i = prompts.length - 1; i >= 0; i--) {
            await chrome.runtime.sendMessage({
              type: 'DELETE_PROMPT',
              data: { category: oldName, index: 0 }
            });
          }

          await this.loadData();
          dialog.remove();
          this.showCategoryManagerDialog();
          this.showToast('分类已重命名');
        };

        input.addEventListener('blur', saveRename);
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            input.blur();
          }
        });

        nameSpan.style.display = 'none';
        categoryItem.insertBefore(input, nameSpan);
        input.focus();
        input.select();
      });
    });

    // 删除分类
    dialog.querySelectorAll('.category-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const categoryName = btn.dataset.category;
        const promptCount = this.prompts[categoryName].length;

        const confirmMsg = promptCount > 0
          ? `分类「${categoryName}」下有 ${promptCount} 个提示词，删除分类将同时删除这些提示词。确定删除吗？`
          : `确定删除分类「${categoryName}」吗？`;

        if (!confirm(confirmMsg)) {
          return;
        }

        // 删除该分类下所有提示词
        for (let i = promptCount - 1; i >= 0; i--) {
          await chrome.runtime.sendMessage({
            type: 'DELETE_PROMPT',
            data: { category: categoryName, index: 0 }
          });
        }

        await this.loadData();
        dialog.remove();
        this.showCategoryManagerDialog();
        this.showToast('分类已删除');
      });
    });

    // 关闭按钮
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
      dialog.remove();
      // 返回添加对话框
      this.showAddPromptDialog();
    });

    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
        // 返回添加对话框
        this.showAddPromptDialog();
      }
    });
  }

  // 关闭弹窗
  closePopup() {
    if (this.currentPopup) {
      this.currentPopup.remove();
      this.currentPopup = null;
    }
  }

  // 显示提示信息
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'prompt-assistant-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // 截断文本
  truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // HTML转义（防止XSS攻击）
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 监听DOM变化
  observeChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldRecheck = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldRecheck = true;
        }
      });

      if (shouldRecheck) {
        // 延迟检查，避免频繁调用
        clearTimeout(this.checkTimeout);
        this.checkTimeout = setTimeout(() => {
          this.findInputElements();
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 设置消息监听器
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'AI_SITE_DETECTED') {
        console.log('AI网站检测确认:', message.url);
      }

      if (message.type === 'SITES_CONFIG_UPDATED') {
        console.log('网站配置已更新，重新检查启用状态');
        // 重新加载设置并检查是否应该启用
        this.loadData().then(() => {
          const currentHostname = window.location.hostname;
          const enabledSites = message.sites || [];
          const enabledHostnames = enabledSites.filter(site => site.enabled).map(site => site.hostname);

          const isSiteEnabled = enabledHostnames.some(site => {
            if (site.startsWith('.')) {
              return currentHostname.endsWith(site.substring(1)) || currentHostname === site.substring(1);
            }
            return currentHostname.includes(site) || currentHostname === site;
          });

          if (isSiteEnabled) {
            console.log('网站已启用，重新初始化功能');
            this.findInputElements();
          } else {
            console.log('网站已禁用，清理所有图标');
            // 清理所有图标
            this.iconElements.forEach((icon) => {
              icon.remove();
            });
            this.iconElements.clear();
          }
        });
      }
    });
  }
}

// 初始化
let promptAssistant;

// 等待DOM加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    promptAssistant = new PromptAssistant();
  });
} else {
  promptAssistant = new PromptAssistant();
}

// 处理SPA路由变化
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(() => {
      promptAssistant.findInputElements();
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });
