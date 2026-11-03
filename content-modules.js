// Content Script 主入口
// 负责协调各个模块，初始化插件功能
// 必须先加载 constants.js

class PromptAssistant {
  constructor() {
    this.isSiteEnabled = false;
    this.init();
  }

  async init() {
    const hostname = window.location.hostname;
    DebugLog.log(`[插件初始化] hostname: ${hostname}`);

    try {
      // 1. 检测当前网站
      this.siteDetector = new SiteDetector();
      this.currentSite = this.siteDetector.currentSite;

      if (this.currentSite === 'Unknown') {
        DebugLog.log('[插件初始化] 未识别的网站，将使用默认选择器');
      }

      // 2. 检查网站是否启用
      this.isSiteEnabled = await this.siteDetector.isSiteEnabled();

      if (!this.isSiteEnabled) {
        DebugLog.log(`[网站检查] 当前网站 ${hostname} 未启用，插件将不工作`);
        return;
      }

      DebugLog.log(`[网站检查] 当前网站 ${hostname} 已启用，继续初始化`);

      // 3. 初始化数据管理器
      this.dataManager = new DataManager();
      await this.dataManager.loadAll();

      // 4. 初始化输入管理器
      this.inputManager = new InputManager(this.siteDetector);

      // 5. 初始化悬浮图标
      this.floatingIcon = new FloatingIcon(this.inputManager);
      this.floatingIcon.setPosition(this.dataManager.settings.iconPosition);

      // 6. 初始化对话框管理器
      this.dialogManager = new DialogManager(this.dataManager.prompts);

      // 7. 初始化弹窗管理器
      this.popupManager = new PopupManager(
        this.dataManager,
        this.dialogManager,
        this.floatingIcon,
        this.inputManager
      );

      // 8. 注入全局样式
      this.injectGlobalStyles();

      // 9. 创建悬浮球
      this.floatingIcon.create();
      this.setupFloatingIconClick();

      // 输入框聚焦时，悬浮球开始跟随其光标垂直位置
      this.inputManager.onInputFocused = (element) => {
        this.floatingIcon.startCaretTracking(element);
        this.floatingIcon.position(element);
      };

      // 页面加载/输入框动态出现时，无需聚焦，悬浮球直接停靠对齐到首个输入框首行
      this.inputManager.onInputsChanged = (inputs) => {
        const focused = this.inputManager.currentFocusedInput;
        if (focused && focused.isConnected) return;
        if (inputs.length > 0) {
          this.floatingIcon.setRestInput(inputs[0]);
        }
      };

      // 10. 查找输入框并设置监听（会触发上面的 onInputsChanged，完成初始停靠定位）
      this.inputManager.findInputElements();
      this.observeChanges();

      // 11. 监听SPA路由变化（仅在启用站点上打补丁，避免污染其他网站）
      this.setupSpaListener();

      // 12. 启动定期清理
      this.floatingIcon.startCleanup();

      // 13. 设置消息监听
      this.setupMessageListener();

      DebugLog.log('AI Prompt Assistant 初始化完成');
    } catch (error) {
      DebugLog.error('AI Prompt Assistant 初始化失败:', error);
    }
  }

  /**
   * 注入全局样式
   */
  injectGlobalStyles() {
    if (document.getElementById('prompt-assistant-styles')) {
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = 'prompt-assistant-styles';
    styleElement.textContent = getGlobalStyles();
    document.head.appendChild(styleElement);
  }

  /**
   * 设置悬浮球点击事件
   */
  setupFloatingIconClick() {
    const icon = this.floatingIcon.floatingIcon;
    if (!icon) return;

    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      let inputElement = this.inputManager.currentFocusedInput;

      if (!inputElement) {
        inputElement = this.inputManager.getFirstAvailableInput();
      }

      if (inputElement) {
        inputElement.focus();
        this.inputManager.handleInputFocus(inputElement);
        this.floatingIcon.position(inputElement);
        this.floatingIcon.show();
        this.popupManager.show(inputElement);
      } else {
        DebugLog.warn('[悬浮球点击] 未找到可用的输入框');
        this.dialogManager.showToast('请先点击输入框');
      }
    });
  }

  /**
   * 监听DOM变化（优化版：智能过滤 + 节流）
   */
  observeChanges() {
    let lastCheckTime = 0;
    const CHECK_THROTTLE = 1000; // 最多每秒检查一次

    const observer = new MutationObserver((mutations) => {
      // 智能过滤：只关注可能包含输入框的变化
      const hasRelevantChanges = mutations.some(mutation => {
        if (mutation.type !== 'childList') return false;

        // 检查新增节点是否可能包含输入框
        return Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false;

          // 快速检查：是否是输入相关元素或包含输入框的容器
          const tagName = node.tagName?.toLowerCase();
          const hasInputClass = node.className?.includes('input') ||
                               node.className?.includes('editor') ||
                               node.className?.includes('textbox');

          return tagName === 'textarea' ||
                 tagName === 'input' ||
                 node.hasAttribute?.('contenteditable') ||
                 hasInputClass ||
                 node.querySelector?.('textarea, input, [contenteditable], [role="textbox"]');
        });
      });

      if (!hasRelevantChanges) return;

      // 节流：限制检查频率
      const now = Date.now();
      if (now - lastCheckTime < CHECK_THROTTLE) {
        clearTimeout(this.checkTimeout);
        this.checkTimeout = setTimeout(() => {
          lastCheckTime = Date.now();
          this.inputManager.findInputElements();
        }, CHECK_THROTTLE);
        return;
      }

      clearTimeout(this.checkTimeout);
      this.checkTimeout = setTimeout(() => {
        lastCheckTime = Date.now();
        this.inputManager.findInputElements();
      }, DELAY.MUTATION_OBSERVER);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * 设置消息监听器（只消费广播，不回响应，故不 return true）
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      switch (message.type) {
        case MSG.SITES_CONFIG_UPDATED:
          DebugLog.log('网站配置已更新，重新检查启用状态');
          this.handleSitesConfigUpdated(message);
          break;
        case MSG.PROMPTS_DATA_UPDATED:
          DebugLog.log('[数据同步] 提示词数据已更新，重新加载');
          this.handlePromptsUpdated();
          break;
        case MSG.STARRED_DATA_UPDATED:
          DebugLog.log('[数据同步] 星标数据已更新，重新加载');
          this.dataManager.loadAll().then(() => this.popupManager?.refresh());
          break;
        case MSG.SETTINGS_UPDATED:
          DebugLog.log('[数据同步] 设置已更新，重新加载');
          this.dataManager.loadAll().then(() => this.updateFloatingIconVisibility());
          break;
      }
    });
  }

  /**
   * 提示词数据更新：先加载完成再同步给对话框/弹窗，避免拿到旧引用
   */
  async handlePromptsUpdated() {
    await this.dataManager.loadAll();
    this.dialogManager?.setPrompts(this.dataManager.prompts);
    await this.popupManager?.refresh();
  }

  /**
   * 处理网站配置更新
   */
  async handleSitesConfigUpdated(message) {
    const currentHostname = window.location.hostname;
    const enabledHostnames = (message.sites || [])
      .filter(site => site.enabled)
      .map(site => site.hostname);

    this.isSiteEnabled = enabledHostnames.some(site =>
      isHostnameMatch(currentHostname, site)
    );

    if (this.isSiteEnabled) {
      DebugLog.log('网站已启用，恢复插件功能');
      this.inputManager.findInputElements();
      // 重新启用时悬浮球可能已被 destroy，需要重建
      this.updateFloatingIconVisibility();
    } else {
      DebugLog.log('网站已禁用，清理所有图标');
      this.floatingIcon.destroy();
    }
  }

  /**
   * 更新悬浮球显示状态
   */
  updateFloatingIconVisibility() {
    const shouldShow = this.dataManager.settings.showIcon !== false;
    if (shouldShow) {
      if (!this.floatingIcon.floatingIcon) {
        this.floatingIcon.create();
        this.setupFloatingIconClick();
        this.floatingIcon.startCleanup();
      } else {
        this.floatingIcon.show();
      }
      this.floatingIcon.setPosition(this.dataManager.settings.iconPosition);
    } else {
      this.floatingIcon.hide();
    }
  }

  /**
   * 监听SPA路由变化（补丁只打在启用的站点上）
   */
  setupSpaListener() {
    if (this._spaListenerInstalled) return;
    this._spaListenerInstalled = true;

    const handleUrlChange = () => {
      setTimeout(() => {
        if (this.isSiteEnabled) {
          this.inputManager.findInputElements();
        }
      }, DELAY.SPA_ROUTE);
    };

    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function(...args) {
      originalPushState(...args);
      handleUrlChange();
    };

    history.replaceState = function(...args) {
      originalReplaceState(...args);
      handleUrlChange();
    };

    window.addEventListener('popstate', handleUrlChange);
  }
}

// 初始化（防重复注入：动态 executeScript 与注册脚本可能先后执行同一组文件）
let promptAssistant;

function bootPromptAssistant() {
  if (window.__promptAssistantInitialized) return;
  window.__promptAssistantInitialized = true;
  promptAssistant = new PromptAssistant();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootPromptAssistant);
} else {
  bootPromptAssistant();
}
