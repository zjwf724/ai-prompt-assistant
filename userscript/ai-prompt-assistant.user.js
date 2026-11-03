// ==UserScript==
// @name         AI Prompt Assistant
// @namespace    https://github.com/zjwf724/ai-prompt-assistant
// @version      1.4.1
// @description  AI网站提示词助手：输入框旁悬浮球一键插入预设提示词。光标跟随、分类/星标管理、站点自定义，数据完全本地化（无网络请求）
// @author       zjwf724
// @license      MIT
// @homepageURL  https://github.com/zjwf724/ai-prompt-assistant
// @supportURL   https://github.com/zjwf724/ai-prompt-assistant/issues
// @updateURL    https://cdn.jsdelivr.net/gh/zjwf724/ai-prompt-assistant@main/userscript/ai-prompt-assistant.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/zjwf724/ai-prompt-assistant@main/userscript/ai-prompt-assistant.user.js
// @match        https://*/*
// @match        http://localhost/*
// @match        http://127.0.0.1/*
// @run-at       document-idle
// @noframes
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_deleteValue
// @grant GM_addValueChangeListener
// @grant GM_registerMenuCommand
// ==/UserScript==

/**
 * 油猴版由 Chrome 扩展（MV3）移植而来：
 * - background.js 的消息中枢与 chrome.storage → GM_getValue/GM_setValue + DataBus
 * - 扩展 popup 管理面板 → 页内设置浮层（油猴菜单或弹窗顶栏齿轮打开）
 * - 内容脚本只在启用的站点上初始化（未启用站点直接退出，不注入任何 DOM）
 */

(function() {
  'use strict';

  // ==================== GM 存储适配层 ====================
  // 统一数据入口；写入时按 key 派发 DataBus 事件（同标签页即时同步），
  // 跨标签页同步由 GM_addValueChangeListener 完成

  const STORE_EVENT_MAP = {
    prompts: 'prompts',
    starredPrompts: 'starred',
    settings: 'settings',
    aiSites: 'sites'
  };

  const Store = {
    get(key, fallback) {
      const value = GM_getValue(key, undefined);
      return value === undefined ? fallback : value;
    },
    set(key, value) {
      GM_setValue(key, value);
      DataBus.emit(STORE_EVENT_MAP[key] || key, value);
    }
  };

  const DataBus = {
    listeners: {},
    on(event, fn) {
      (this.listeners[event] = this.listeners[event] || []).push(fn);
    },
    emit(event, payload) {
      (this.listeners[event] || []).forEach(fn => {
        try { fn(payload); } catch (e) { DebugLog.error('[DataBus]', event, e); }
      });
    }
  };

  // ==================== 常量定义 ====================

  const Z_INDEX = {
    ICON: 999999,
    POPUP: 2147483647,  // 最大32位整数
    DIALOG: 1000001,
    TOAST: 1000004  // 提示需浮于对话框之上
  };

  // ==================== 日志控制 ====================
  const LOG_LEVEL = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    DEBUG: 3
  };

  const CURRENT_LOG_LEVEL = LOG_LEVEL.WARN;

  const DebugLog = {
    log(...args) {
      if (CURRENT_LOG_LEVEL >= LOG_LEVEL.DEBUG) {
        console.log('[AI Prompt]', ...args);
      }
    },
    warn(...args) {
      if (CURRENT_LOG_LEVEL >= LOG_LEVEL.WARN) {
        console.warn('[AI Prompt]', ...args);
      }
    },
    error(...args) {
      if (CURRENT_LOG_LEVEL >= LOG_LEVEL.ERROR) {
        console.error('[AI Prompt]', ...args);
      }
    }
  };

  // ==================== 延迟配置（毫秒）====================
  const DELAY = {
    CLEANUP_INTERVAL: 30000,
    MUTATION_OBSERVER: 500,
    SPA_ROUTE: 1000,
    TOAST_SHOW: 2000,
    TOAST_FADE: 300,
    POPUP_CLOSE_DELAY: 100,
    ICON_REPOSITION_DELAY: 10
  };

  // ==================== 布局常量 ====================
  const LAYOUT = {
    ICON: {
      SIZE: 36,
      MARGIN: 8,
      RIGHT_EDGE: 8,
      HOVER_SCALE: 1.15
    },
    POPUP: {
      WIDTH: 480,
      MAX_HEIGHT: 600,
      MARGIN: 12,
      BORDER_RADIUS: 16
    }
  };

  // ==================== 版本号 ====================
  const EXT_VERSION = '1.4.1';

  // ==================== 默认数据 ====================
  const DEFAULT_PROMPTS = {
    "角色扮演": [
      {
        id: "p_default_1",
        title: "专业翻译",
        content: "请扮演一位专业的翻译家，将以下内容翻译成中文，保持原文的专业性和准确性："
      },
      {
        id: "p_default_2",
        title: "代码助手",
        content: "请作为一位经验丰富的程序员，帮我分析以下代码并提供优化建议："
      }
    ],
    "写作助手": [
      {
        id: "p_default_3",
        title: "润色文本",
        content: "请帮我润色以下文本，使其更加流畅和专业："
      },
      {
        id: "p_default_4",
        title: "总结要点",
        content: "请总结以下内容的核心要点，使用条目式列出："
      }
    ],
    "学习辅助": [
      {
        id: "p_default_5",
        title: "解释概念",
        content: "请用通俗易懂的语言解释以下概念："
      },
      {
        id: "p_default_6",
        title: "制定计划",
        content: "请帮我制定一个详细的学习计划，针对以下主题："
      }
    ]
  };

  const DEFAULT_AI_SITES = [
    { name: "DeepSeek", hostname: "chat.deepseek.com", enabled: true },
    { name: "豆包", hostname: ".doubao.com", enabled: true },
    { name: "腾讯元宝", hostname: "yuanbao.tencent.com", enabled: true }
  ];

  const DEFAULT_SETTINGS = {
    showIcon: true,
    autoDetect: true,
    theme: 'auto',
    iconPosition: 'right'
  };

  // ==================== 网站选择器配置 ====================
  const SITE_SELECTORS = {
    'DeepSeek': [
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="message"]',
      'div[contenteditable="true"]',
      'textarea'
    ],
    '豆包': [
      'div[contenteditable="true"]',
      'div[role="textbox"]',
      'textarea[placeholder*="问"]',
      'textarea[placeholder*="输入"]',
      'div[class*="editor"]',
      'div[class*="Editor"]',
      'div[class*="input"]',
      'div[class*="Input"]',
      'textarea',
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

  // ==================== ID 生成 ====================

  let _idCounter = 0;

  function generateId() {
    return 'p' + Date.now().toString(36) + '_' + (++_idCounter);
  }

  // ==================== 导入合并（与扩展版 constants.js 的 applyImport 语义一致） ====================

  /**
   * 合并导入的备份数据（与 Chrome 扩展版备份格式双向兼容）
   * - prompts：逐条校验，按 id 去重（重复导入幂等）
   * - starredPrompts：按 id 去重合并
   * - settings：白名单键 + 类型校验
   * - aiSites：按 hostname 合并（已有则覆盖属性，没有则追加）
   * @returns {Object} 未导入的分区为 null，附 addedPrompts/addedSites 统计
   */
  function applyImport(current, incoming) {
    const result = { prompts: null, starredPrompts: null, settings: null, aiSites: null, addedPrompts: 0, addedSites: 0 };

    if (incoming.prompts && typeof incoming.prompts === 'object') {
      const merged = { ...(current.prompts || {}) };
      const existingIds = new Set();
      Object.values(current.prompts || {}).forEach(arr =>
        (arr || []).forEach(p => p.id && existingIds.add(p.id))
      );

      for (const [category, prompts] of Object.entries(incoming.prompts)) {
        if (typeof category !== 'string' || !category.trim() || !Array.isArray(prompts)) continue;
        const target = merged[category] || (merged[category] = []);

        for (const p of prompts) {
          if (!p || typeof p !== 'object') continue;
          if (typeof p.title !== 'string' || !p.title.trim()) continue;
          if (typeof p.content !== 'string' || !p.content.trim()) continue;
          if (p.id && existingIds.has(p.id)) continue;

          const entry = {
            id: p.id || generateId(),
            title: p.title.trim(),
            content: p.content.trim()
          };
          existingIds.add(entry.id);
          target.push(entry);
          result.addedPrompts++;
        }
      }
      result.prompts = merged;
    }

    if (Array.isArray(incoming.starredPrompts)) {
      const mergedStarred = Array.isArray(current.starredPrompts) ? [...current.starredPrompts] : [];
      const seen = new Set(mergedStarred.map(s => s.id));

      for (const s of incoming.starredPrompts) {
        if (!s || typeof s !== 'object' || typeof s.id !== 'string' || seen.has(s.id)) continue;
        mergedStarred.push({
          id: s.id,
          category: typeof s.category === 'string' ? s.category : '',
          title: typeof s.title === 'string' ? s.title : ''
        });
        seen.add(s.id);
      }
      result.starredPrompts = mergedStarred;
    }

    if (incoming.settings && typeof incoming.settings === 'object') {
      const allowedTypes = { showIcon: 'boolean', iconPosition: 'string', autoDetect: 'boolean', theme: 'string' };
      const mergedSettings = { ...(current.settings || {}) };
      for (const [key, type] of Object.entries(allowedTypes)) {
        if (key in incoming.settings && typeof incoming.settings[key] === type) {
          mergedSettings[key] = incoming.settings[key];
        }
      }
      result.settings = mergedSettings;
    }

    if (Array.isArray(incoming.aiSites)) {
      const mergedSites = Array.isArray(current.aiSites) ? [...current.aiSites] : [];
      const byHostname = new Map(mergedSites.map(s => [s.hostname, s]));

      for (const s of incoming.aiSites) {
        if (!s || typeof s !== 'object' || typeof s.hostname !== 'string' || !s.hostname.trim()) continue;
        const entry = {
          name: (typeof s.name === 'string' && s.name.trim()) ? s.name.trim() : s.hostname.trim(),
          hostname: s.hostname.trim(),
          enabled: s.enabled !== false
        };
        const existing = byHostname.get(entry.hostname);
        if (existing) {
          Object.assign(existing, entry);
        } else {
          mergedSites.push(entry);
          byHostname.set(entry.hostname, entry);
          result.addedSites++;
        }
      }
      result.aiSites = mergedSites;
    }

    return result;
  }

  // ==================== 辅助函数 ====================

  function detectSite(hostname) {
    if (hostname.endsWith('.doubao.com') || hostname === 'doubao.com') {
      return '豆包';
    }
    if (hostname.endsWith('.z.ai') || hostname === 'z.ai') {
      return 'zAI';
    }
    if (hostname.endsWith('.designkit.cn') || hostname === 'designkit.cn') {
      return 'DesignKit';
    }

    const sites = {
      'chat.deepseek.com': 'DeepSeek',
      'yuanbao.tencent.com': '腾讯元宝'
    };
    return sites[hostname] || 'Unknown';
  }

  function isHostnameMatch(hostname, sitePattern) {
    if (sitePattern.startsWith('.')) {
      const baseDomain = sitePattern.substring(1);
      // 必须精确等于或以 "."+baseDomain 结尾，防止 fakedoubao.com 误匹配 .doubao.com
      return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
    }
    return hostname === sitePattern || hostname.endsWith('.' + sitePattern);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    // innerHTML 只转义 < > &，属性插值场景还需转义引号
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ==================== 网站检测模块 ====================

  class SiteDetector {
    constructor() {
      this.currentSite = detectSite(window.location.hostname);
    }

    /**
     * 当前网站是否在启用列表中（GM 存储直读，同步方法）
     */
    isSiteEnabled() {
      const sites = Store.get('aiSites', DEFAULT_AI_SITES) || [];
      const enabledSites = sites.filter(s => s.enabled).map(s => s.hostname);
      const currentHostname = window.location.hostname;

      if (enabledSites.length === 0) {
        DebugLog.log('[网站检查] 启用网站列表为空');
        return false;
      }
      return enabledSites.some(site => isHostnameMatch(currentHostname, site));
    }
  }

  // ==================== 输入框管理模块 ====================

  class InputManager {
    constructor(siteDetector) {
      this.siteDetector = siteDetector;
      this.inputElements = [];
      this.currentFocusedInput = null;
      // 由 PromptAssistant 注入：输入框聚焦时的回调（悬浮球据此跟随光标）
      this.onInputFocused = null;
      // 由 PromptAssistant 注入：输入框列表变化时的回调（页面加载/动态出现输入框）
      this.onInputsChanged = null;
    }

    /**
     * 查找页面中的输入框元素
     */
    findInputElements() {
      const site = this.siteDetector.currentSite;
      const selectors = SITE_SELECTORS[site] || SITE_SELECTORS.default;
      const allInputs = new Set();

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (this.isTextInput(element)) {
            allInputs.add(element);
          }
        });
      });

      const allInputsArray = Array.from(allInputs);
      DebugLog.log(`[查找输入框] 共找到 ${allInputsArray.length} 个输入框`);

      // 移除已不存在的输入框的监听器（capture 标志必须与添加时一致才能真正移除）
      const removedInputs = this.inputElements.filter(element => !allInputs.has(element));
      removedInputs.forEach(element => {
        if (element._focusHandler) {
          element.removeEventListener('focus', element._focusHandler, true);
        }
      });

      // 为所有输入框添加焦点监听
      allInputsArray.forEach(element => {
        if (!element._focusHandler) {
          element._focusHandler = () => {
            DebugLog.log('[输入框获得焦点]', element);
            this.handleInputFocus(element);
          };
          element.addEventListener('focus', element._focusHandler, true);
        }
      });

      this.inputElements = allInputsArray;
      if (this.onInputsChanged) {
        this.onInputsChanged(allInputsArray);
      }
      return allInputsArray;
    }

    /**
     * 判断是否为文本输入元素
     * 注意：role="textbox" 但非 contenteditable 的元素不在此列——
     * PromptInserter 无法向其写入内容，选中也无意义
     */
    isTextInput(element) {
      const tagName = element.tagName.toLowerCase();
      const inputType = element.type ? element.type.toLowerCase() : '';

      if (tagName === 'textarea') return true;
      if (tagName === 'input' && (inputType === 'text' || inputType === 'search')) return true;
      // isContentEditable 覆盖 contenteditable="" 与任意标签，比精确比对 "true" 更宽容
      if (element.isContentEditable) return true;

      return false;
    }

    /**
     * 处理输入框获得焦点
     */
    handleInputFocus(inputElement) {
      this.currentFocusedInput = inputElement;
      if (this.onInputFocused) {
        this.onInputFocused(inputElement);
      }
    }

    /**
     * 获取第一个可用的输入框
     */
    getFirstAvailableInput() {
      if (this.inputElements.length > 0) {
        return this.inputElements[0];
      }

      // 实时查找
      const selectors = ['textarea', 'div[contenteditable="true"]', 'input[type="text"]', '[role="textbox"]'];
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && this.isTextInput(element)) {
          return element;
        }
      }
      return null;
    }
  }

  // ==================== 悬浮图标模块 ====================

  class FloatingIcon {
    constructor(inputManager) {
      this.inputManager = inputManager;
      this.floatingIcon = null;
      this.floatingCleanupInterval = null;
      this._createRetries = 0;
      this._maxCreateRetries = 10;
      this.iconPosition = 'right';
      // 光标跟随状态
      this._trackedInput = null;
      this._caretReposition = null;
      this._caretSelectionHandler = null;
      this._caretWindowScrollHandler = null;
      this._rafId = null;
      this._caretMirror = null;
      // 未聚焦时的停靠状态（对齐到输入框首行）
      this._restInput = null;
      this._restScrollHandler = null;
      this._restRafId = null;
    }

    /**
     * 更新图标位置配置
     */
    setPosition(position) {
      this.iconPosition = position || 'right';
      if (this.floatingIcon) {
        const currentInput = this.inputManager.currentFocusedInput;
        if (currentInput) {
          this.position(currentInput);
        }
      }
    }

    /**
     * 创建悬浮球
     */
    create() {
      if (!document.body) {
        if (this._createRetries < this._maxCreateRetries) {
          this._createRetries++;
          setTimeout(() => this.create(), 100);
        }
        return;
      }
      this._createRetries = 0;

      const existingIcon = document.getElementById('prompt-assistant-floating-icon');
      if (existingIcon) {
        this.floatingIcon = existingIcon;
        return;
      }

      const icon = document.createElement('div');
      icon.className = 'prompt-assistant-icon';
      icon.id = 'prompt-assistant-floating-icon';
      icon.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" style="color: white;">
          <path fill="white" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
          <circle cx="19" cy="5" r="3" fill="#FFD700"/>
        </svg>
      `;

      icon.style.cssText = `
        opacity: 0.5 !important;
        pointer-events: auto !important;
        position: fixed !important;
        right: ${LAYOUT.ICON.RIGHT_EDGE}px !important;
        top: calc(50% - ${LAYOUT.ICON.SIZE / 2}px) !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        z-index: ${Z_INDEX.ICON} !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        visibility: visible !important;
        width: ${LAYOUT.ICON.SIZE}px !important;
        height: ${LAYOUT.ICON.SIZE}px !important;
        background-color: #4CAF50 !important;
        border-radius: 50% !important;
        box-shadow: 0 3px 10px rgba(0,0,0,0.25) !important;
        border: 2px solid white !important;
        cursor: pointer !important;
      `;

      // 缩放交给 CSS :hover 规则（transform-origin 默认居中，不会位移），
      // 这里只处理"输入框聚焦时保持高亮"的透明度
      icon.addEventListener('mouseenter', () => {
        icon.style.opacity = '1';
      });

      icon.addEventListener('mouseleave', () => {
        if (!this.inputManager.currentFocusedInput ||
            document.activeElement !== this.inputManager.currentFocusedInput) {
          icon.style.opacity = '0.5';
        }
      });

      document.body.appendChild(icon);
      this.floatingIcon = icon;

      DebugLog.log('[创建悬浮球] 悬浮球已创建');
    }

    /**
     * 定位图标到输入框
     */
    position(inputElement) {
      if (!inputElement || !inputElement.isConnected || !this.floatingIcon) return;

      const rect = inputElement.getBoundingClientRect();
      const iconSize = LAYOUT.ICON.SIZE;
      const margin = LAYOUT.ICON.MARGIN;
      const rightEdge = LAYOUT.ICON.RIGHT_EDGE;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const inputVisible = rect.bottom > 0 && rect.top < viewportHeight &&
                           rect.width > 0 && rect.height > 0;

      if (!inputVisible) {
        this.floatingIcon.style.opacity = '0';
        // 透明时不可点击，避免挡住页面元素
        this.floatingIcon.style.pointerEvents = 'none';
        return;
      }

      // 优先跟随输入光标所在行；取不到光标位置时退回输入框垂直居中
      const caretY = this.getCaretCenterY(inputElement);
      let top = caretY !== null
        ? caretY - (iconSize / 2)
        : rect.top + (rect.height / 2) - (iconSize / 2);

      if (top < margin) top = margin;
      if (top + iconSize > viewportHeight - margin) {
        top = viewportHeight - iconSize - margin;
      }

      let left;
      if (this.iconPosition === 'left') {
        left = margin;
      } else {
        left = viewportWidth - iconSize - rightEdge;
      }

      this.floatingIcon.style.position = 'fixed';
      this.floatingIcon.style.left = `${left}px`;
      this.floatingIcon.style.top = `${top}px`;
      this.floatingIcon.style.right = 'auto';
      this.floatingIcon.style.bottom = 'auto';
      // 被设置（showIcon=false / 输入框不可见）隐藏时保持不可点击
      if (this.floatingIcon.style.opacity !== '0') {
        this.floatingIcon.style.pointerEvents = 'auto';
      }
    }

    /**
     * 获取输入光标中心的视口 Y 坐标；无法确定时返回 null
     */
    getCaretCenterY(inputElement) {
      try {
        if (inputElement.isContentEditable) {
          const selection = window.getSelection();
          if (!(selection && selection.rangeCount > 0 && inputElement.contains(selection.anchorNode))) {
            return null;
          }
          const range = selection.getRangeAt(0);
          // 折叠选区 getBoundingClientRect 常返回全零矩形，必须先试 getClientRects
          const rects = range.getClientRects();
          if (rects.length > 0) {
            const r = rects[rects.length - 1];
            return r.top + r.height / 2;
          }
          const probeRect = this.probeCollapsedRange(range);
          if (probeRect) {
            return probeRect.top + probeRect.height / 2;
          }
          return null;
        }

        if (inputElement.selectionStart == null) return null;
        return this.getTextareaCaretY(inputElement, inputElement.selectionStart);
      } catch (e) {
        return null;
      }
    }

    /**
     * 折叠选区无几何信息时，向相邻字符扩展一个字符的探测区间来测行位置
     * 只读操作，不修改页面 DOM
     */
    probeCollapsedRange(range) {
      const probe = range.cloneRange();
      const node = probe.endContainer;
      try {
        if (node.nodeType !== Node.TEXT_NODE) return null;

        if (probe.endOffset < node.data.length) {
          probe.setEnd(node, probe.endOffset + 1);
        } else if (probe.endOffset > 0) {
          probe.setStart(node, probe.endOffset - 1);
        } else {
          return null;
        }

        const rects = probe.getClientRects();
        if (rects.length > 0) return rects[rects.length - 1];
      } catch (e) {
        // 忽略，走兜底逻辑
      }
      return null;
    }

    /**
     * 用镜像元素测量 textarea/input 中光标所在行的视口 Y 坐标
     * 镜像复制光标前的文本并继承排版样式，兼容自动换行
     */
    getTextareaCaretY(inputElement, caretIndex) {
      if (!this._caretMirror) {
        const mirror = document.createElement('div');
        mirror.setAttribute('aria-hidden', 'true');
        Object.assign(mirror.style, {
          position: 'absolute',
          left: '-9999px',
          top: '0',
          visibility: 'hidden',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word'
        });
        document.body.appendChild(mirror);
        this._caretMirror = mirror;
      }

      const mirror = this._caretMirror;
      const style = window.getComputedStyle(inputElement);
      const elementRect = inputElement.getBoundingClientRect();

      [
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
        'lineHeight', 'textIndent', 'wordSpacing', 'wordBreak', 'overflowWrap', 'tabSize'
      ].forEach(prop => { mirror.style[prop] = style[prop]; });

      // 用 border-box 模型复制实际宽度，保证内容宽度严格一致
      // （computed style 的 width 受 box-sizing 语义影响，直接复制可能算错换行）
      mirror.style.boxSizing = 'border-box';
      mirror.style.width = elementRect.width + 'px';

      mirror.textContent = '';
      mirror.appendChild(document.createTextNode(inputElement.value.substring(0, caretIndex)));
      const marker = document.createElement('span');
      marker.textContent = '\u200b';
      mirror.appendChild(marker);

      const markerRect = marker.getBoundingClientRect();
      const delta = markerRect.top - mirror.getBoundingClientRect().top;
      const caretTop = elementRect.top + delta - inputElement.scrollTop;

      // 标记的行内盒在行盒中垂直居中，用标记自身中心即光标行的中心；
      // 拿不到标记高度时退回 line-height 估算
      if (markerRect.height > 0) {
        return caretTop + markerRect.height / 2;
      }
      const lineHeight = parseFloat(style.lineHeight) ||
                         parseFloat(style.fontSize) * 1.2;
      return caretTop + lineHeight / 2;
    }

    /**
     * 开始跟随指定输入框的光标垂直位置（切换输入框时自动迁移监听）
     */
    startCaretTracking(inputElement) {
      if (this._trackedInput === inputElement) return;
      this.stopCaretTracking();

      this._trackedInput = inputElement;

      const reposition = () => {
        if (this._trackedInput !== inputElement || !inputElement.isConnected) return;
        // rAF 合并同一帧内的多次触发，避免频繁重排
        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = requestAnimationFrame(() => {
          this._rafId = null;
          this.position(inputElement);
        });
      };
      this._caretReposition = reposition;

      ['keyup', 'click', 'input', 'scroll'].forEach(evt => {
        inputElement.addEventListener(evt, reposition, { passive: true });
      });

      // 方向键移动光标触发 selectionchange；页面滚动改变光标的视口位置
      this._caretSelectionHandler = () => {
        const active = document.activeElement;
        if (active === inputElement || inputElement.contains(active)) {
          reposition();
        }
      };
      document.addEventListener('selectionchange', this._caretSelectionHandler, { passive: true });

      this._caretWindowScrollHandler = reposition;
      window.addEventListener('scroll', reposition, { passive: true });
    }

    /**
     * 停止光标跟随并清理全部监听
     */
    stopCaretTracking() {
      if (this._trackedInput && this._caretReposition) {
        ['keyup', 'click', 'input', 'scroll'].forEach(evt => {
          this._trackedInput.removeEventListener(evt, this._caretReposition);
        });
      }
      if (this._caretSelectionHandler) {
        document.removeEventListener('selectionchange', this._caretSelectionHandler);
      }
      if (this._caretWindowScrollHandler) {
        window.removeEventListener('scroll', this._caretWindowScrollHandler);
      }
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
      }
      this._trackedInput = null;
      this._caretReposition = null;
      this._caretSelectionHandler = null;
      this._caretWindowScrollHandler = null;
      this._rafId = null;
    }

    /**
     * 未聚焦时的停靠位置：对齐到输入框首行（光标默认所在行），
     * 并跟随页面滚动保持对齐；开始光标跟随后由跟踪逻辑接管
     */
    setRestInput(inputElement) {
      this._restInput = inputElement;

      if (!this._restScrollHandler) {
        this._restScrollHandler = () => {
          if (this._trackedInput || !this._restInput || !this._restInput.isConnected) return;
          if (this._restRafId) cancelAnimationFrame(this._restRafId);
          this._restRafId = requestAnimationFrame(() => {
            this._restRafId = null;
            if (this._trackedInput || !this._restInput || !this._restInput.isConnected) return;
            this.position(this._restInput);
          });
        };
        window.addEventListener('scroll', this._restScrollHandler, { passive: true });
      }

      if (!this._trackedInput && inputElement && inputElement.isConnected) {
        this.position(inputElement);
      }
    }

    /**
     * 显示图标
     */
    show() {
      if (this.floatingIcon) {
        this.floatingIcon.style.opacity = '1';
        this.floatingIcon.style.pointerEvents = 'auto';
      }
    }

    /**
     * 隐藏图标
     */
    hide() {
      if (this.floatingIcon) {
        this.floatingIcon.style.opacity = '0';
        this.floatingIcon.style.pointerEvents = 'none';
      }
    }

    /**
     * 启动定期清理
     */
    startCleanup() {
      if (this.floatingCleanupInterval) {
        clearInterval(this.floatingCleanupInterval);
      }

      this.floatingCleanupInterval = setInterval(() => {
        this.cleanup();
      }, DELAY.CLEANUP_INTERVAL);
    }

    /**
     * 清理多余的图标
     */
    cleanup() {
      const allIcons = document.querySelectorAll('.prompt-assistant-icon');
      if (allIcons.length <= 1) return;

      DebugLog.log(`[清理] 发现 ${allIcons.length} 个图标，保留主悬浮球`);

      const mainIcon = document.getElementById('prompt-assistant-floating-icon');
      allIcons.forEach(icon => {
        if (icon !== mainIcon && icon.parentNode) {
          icon.remove();
        }
      });
    }

    /**
     * 销毁图标
     */
    destroy() {
      this.stopCaretTracking();
      if (this._restScrollHandler) {
        window.removeEventListener('scroll', this._restScrollHandler);
      }
      if (this._restRafId) {
        cancelAnimationFrame(this._restRafId);
      }
      this._restInput = null;
      this._restScrollHandler = null;
      this._restRafId = null;
      if (this._caretMirror && this._caretMirror.parentNode) {
        this._caretMirror.remove();
      }
      this._caretMirror = null;
      if (this.floatingCleanupInterval) {
        clearInterval(this.floatingCleanupInterval);
      }
      if (this.floatingIcon && this.floatingIcon.parentNode) {
        this.floatingIcon.remove();
      }
      this.floatingIcon = null;
    }
  }

  // ==================== 数据管理模块（GM 存储） ====================

  class DataManager {
    constructor() {
      this.prompts = {};
      this.settings = {};
      this.starredPrompts = [];
    }

    /**
     * 加载所有数据
     */
    async loadAll() {
      try {
        this.prompts = Store.get('prompts', null) || DEFAULT_PROMPTS;
        this.settings = { ...DEFAULT_SETTINGS, ...(Store.get('settings', null) || {}) };
        const starred = Store.get('starredPrompts', null) || [];
        this.starredPrompts = this.cleanStarredPrompts(starred);
        return { prompts: this.prompts, settings: this.settings, starredPrompts: this.starredPrompts };
      } catch (error) {
        DebugLog.error('加载数据失败:', error);
        return { prompts: {}, settings: {}, starredPrompts: [] };
      }
    }

    /**
     * 清理无效的星标引用
     */
    cleanStarredPrompts(starredList) {
      const validStarred = [];
      const seen = new Set();

      starredList.forEach(star => {
        const promptId = star.id;
        if (!promptId) return;

        for (const category of Object.keys(this.prompts)) {
          const prompt = this.prompts[category].find(p => p.id === promptId);
          if (prompt) {
            if (!seen.has(promptId)) {
              seen.add(promptId);
              validStarred.push({
                id: promptId,
                category,
                title: star.title || prompt.title
              });
            }
            break;
          }
        }
      });

      // 如果清理后有变化，保存清理后的数据
      if (validStarred.length !== starredList.length) {
        Store.set('starredPrompts', validStarred);
      }

      this.starredPrompts = validStarred;
      return validStarred;
    }

    /**
     * 保存提示词（追加）
     */
    async savePrompt(category, prompt) {
      if (!this.prompts[category]) {
        this.prompts[category] = [];
      }
      this.prompts[category].push({ ...prompt, id: prompt.id || generateId() });
      Store.set('prompts', this.prompts);
    }

    /**
     * 删除提示词
     */
    async deletePrompt(category, index) {
      if (!(this.prompts[category] && this.prompts[category][index])) return;
      this.prompts[category].splice(index, 1);
      if (this.prompts[category].length === 0) {
        delete this.prompts[category];
      }
      Store.set('prompts', this.prompts);
    }

    /**
     * 移动/更新提示词（同分类即原地更新，跨分类移动；保留原 id 以维持星标）
     */
    async movePrompt(fromCategory, fromIndex, toCategory, prompt) {
      if (!(this.prompts[fromCategory] && this.prompts[fromCategory][fromIndex])) return;
      this.prompts[fromCategory].splice(fromIndex, 1);
      if (this.prompts[fromCategory].length === 0) {
        delete this.prompts[fromCategory];
      }
      if (!this.prompts[toCategory]) {
        this.prompts[toCategory] = [];
      }
      this.prompts[toCategory].push({ ...prompt, id: prompt.id || generateId() });
      Store.set('prompts', this.prompts);
    }

    /**
     * 更新星标
     */
    async updateStarred(starredPrompts) {
      Store.set('starredPrompts', starredPrompts);
      this.starredPrompts = starredPrompts;
    }

    /**
     * 切换星标状态
     */
    async toggleStar(category, index, title) {
      const prompt = this.prompts[category]?.[index];
      if (!prompt || !prompt.id) return false;

      const promptId = prompt.id;
      const isStarred = this.starredPrompts.some(s => s.id === promptId);

      if (isStarred) {
        this.starredPrompts = this.starredPrompts.filter(s => s.id !== promptId);
      } else {
        this.starredPrompts.push({ id: promptId, category, title });
      }

      await this.updateStarred(this.starredPrompts);
      return !isStarred;
    }

    /**
     * 检查提示词是否已星标
     */
    isStarred(category, index) {
      const prompt = this.prompts[category]?.[index];
      if (!prompt || !prompt.id) return false;
      return this.starredPrompts.some(s => s.id === prompt.id);
    }

    /**
     * 获取所有分类
     */
    getCategories() {
      return Object.keys(this.prompts);
    }

    /**
     * 获取默认分类
     */
    getDefaultCategories() {
      return ['角色扮演', '写作助手', '学习辅助'];
    }
  }

  // ==================== 对话框管理模块 ====================

  class DialogManager {
    constructor(prompts) {
      this.prompts = prompts;
      this.container = document.body;
    }

    setPrompts(prompts) {
      this.prompts = prompts;
    }

    setContainer(container) {
      this.container = container || document.body;
    }

    /**
     * 显示添加提示词对话框
     */
    showAddPromptDialog(onSave, preselectCategory = null) {
      const categories = Object.keys(this.prompts);
      const defaultCategories = ['角色扮演', '写作助手', '学习辅助'];
      const customCategories = categories.filter(cat => !defaultCategories.includes(cat));

      const isSelected = (cat) => preselectCategory && cat === preselectCategory ? 'selected' : '';

      const dialog = this.createDialog(`
        <div class="dialog-content">
          <h3>添加新提示词</h3>
          <div class="form-group">
            <label>分类：</label>
            <div class="category-select-wrapper">
              <select id="prompt-category" class="category-select">
                <option value="">-- 选择分类 --</option>
                ${defaultCategories.map(cat =>
                  `<option value="${escapeHtml(cat)}" ${isSelected(cat)}>${escapeHtml(cat)}</option>`
                ).join('')}
                ${customCategories.map(cat =>
                  `<option value="${escapeHtml(cat)}" ${isSelected(cat)}>${escapeHtml(cat)}</option>`
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
      `);

      this.setupAddPromptEvents(dialog, onSave);
      this.container.appendChild(dialog);
    }

    /**
     * 显示编辑提示词对话框
     */
    showEditPromptDialog(category, index, onSave) {
      const prompt = this.prompts[category]?.[index];
      if (!prompt) return;

      const categories = Object.keys(this.prompts);

      const dialog = this.createDialog(`
        <div class="dialog-content">
          <h3>编辑提示词</h3>
          <div class="form-group">
            <label>分类：</label>
            <div class="category-select-wrapper">
              <select id="edit-prompt-category" class="category-select">
                ${categories.map(cat =>
                  `<option value="${escapeHtml(cat)}" ${cat === category ? 'selected' : ''}>${escapeHtml(cat)}</option>`
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
            <input type="text" id="edit-prompt-title" value="${escapeHtml(prompt.title)}" placeholder="简短描述">
          </div>
          <div class="form-group">
            <label>内容：</label>
            <textarea id="edit-prompt-content" placeholder="提示词内容">${escapeHtml(prompt.content)}</textarea>
          </div>
          <div class="dialog-actions">
            <button class="text-btn" id="edit-delete-prompt-btn">删除</button>
            <div class="dialog-actions-right">
              <button class="cancel-btn">取消</button>
              <button class="save-btn">保存修改</button>
            </div>
          </div>
        </div>
      `);

      this.setupEditPromptEvents(dialog, category, index, onSave);
      this.container.appendChild(dialog);
    }

    /**
     * 显示删除确认对话框
     */
    showDeleteConfirmDialog(category, index, title, onConfirm) {
      const dialog = this.createDialog(`
        <div class="dialog-content confirm-dialog">
          <h3>确认删除</h3>
          <p>确定要删除提示词「${escapeHtml(title)}」吗？<br>此操作无法撤销。</p>
          <div class="confirm-dialog-actions">
            <button class="cancel-btn">取消</button>
            <button class="delete-confirm-btn">确认删除</button>
          </div>
        </div>
      `);

      dialog.querySelector('.cancel-btn').addEventListener('click', () => dialog.remove());
      dialog.querySelector('.delete-confirm-btn').addEventListener('click', () => {
        onConfirm();
        dialog.remove();
      });

      // 必须与当前弹窗同容器（Shadow DOM 内），否则会被弹窗的 z-index 遮挡
      this.container.appendChild(dialog);
    }

    /**
     * 创建对话框容器
     */
    createDialog(htmlContent) {
      const dialog = document.createElement('div');
      dialog.className = 'prompt-assistant-dialog';
      dialog.innerHTML = htmlContent;

      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          dialog.remove();
        }
      });

      return dialog;
    }

    /**
     * 设置添加提示词对话框事件
     */
    setupAddPromptEvents(dialog, onSave) {
      const categorySelect = dialog.querySelector('#prompt-category');
      const newCategoryInput = dialog.querySelector('#new-category-input');

      categorySelect.addEventListener('change', () => {
        newCategoryInput.style.display = categorySelect.value === '__new__' ? 'block' : 'none';
      });

      dialog.querySelector('.cancel-btn').addEventListener('click', () => dialog.remove());

      dialog.querySelector('#manage-categories-btn')?.addEventListener('click', () => {
        this.showToast('请在设置面板中管理分类');
      });

      dialog.querySelector('.save-btn').addEventListener('click', () => {
        let category = categorySelect.value;
        const newCategory = dialog.querySelector('#prompt-new-category').value.trim();
        const title = dialog.querySelector('#prompt-title').value.trim();
        const content = dialog.querySelector('#prompt-content').value.trim();

        if (category === '__new__') {
          category = newCategory || '';
        }

        if (category && title && content) {
          onSave({ category, title, content });
          dialog.remove();
        } else {
          this.showToast('请填写完整信息');
        }
      });
    }

    /**
     * 设置编辑提示词对话框事件
     */
    setupEditPromptEvents(dialog, originalCategory, originalIndex, onSave) {
      const categorySelect = dialog.querySelector('#edit-prompt-category');
      const newCategoryInput = dialog.querySelector('#edit-new-category-input');

      categorySelect.addEventListener('change', () => {
        newCategoryInput.style.display = categorySelect.value === '__new__' ? 'block' : 'none';
      });

      dialog.querySelector('.cancel-btn').addEventListener('click', () => dialog.remove());

      dialog.querySelector('.save-btn').addEventListener('click', () => {
        let newCategory = categorySelect.value;
        const newCategoryName = dialog.querySelector('#edit-prompt-new-category').value.trim();
        const newTitle = dialog.querySelector('#edit-prompt-title').value.trim();
        const newContent = dialog.querySelector('#edit-prompt-content').value.trim();

        if (newCategory === '__new__') {
          newCategory = newCategoryName || '';
        }

        if (newCategory && newTitle && newContent) {
          onSave({ category: newCategory, title: newTitle, content: newContent });
          dialog.remove();
        } else {
          this.showToast('请填写完整信息');
        }
      });

      dialog.querySelector('#edit-delete-prompt-btn').addEventListener('click', () => {
        const prompt = this.prompts[originalCategory]?.[originalIndex];
        if (prompt) {
          this.showDeleteConfirmDialog(originalCategory, originalIndex, prompt.title, () => {
            onSave({ delete: true, category: originalCategory, index: originalIndex });
          });
          dialog.remove();
        }
      });
    }

    /**
     * 显示提示信息
     */
    showToast(message) {
      const toast = document.createElement('div');
      toast.className = 'prompt-assistant-toast';
      toast.textContent = message;
      this.container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), DELAY.TOAST_FADE);
      }, DELAY.TOAST_SHOW);
    }
  }

  // ==================== 弹窗管理模块 ====================

  class PopupManager {
    constructor(dataManager, dialogManager, floatingIcon, inputManager) {
      this.dataManager = dataManager;
      this.dialogManager = dialogManager;
      this.floatingIcon = floatingIcon;
      this.inputManager = inputManager;
      this.currentPopup = null;
      this.currentPopupShadowRoot = null;
      this.currentTargetInput = null;
    }

    /**
     * 显示提示词弹窗
     */
    show(inputElement) {
      // 如果已有弹窗，先关闭
      if (this.currentPopup) {
        this.close();
      }

      const iconRect = this.floatingIcon.floatingIcon.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popupWidth = LAYOUT.POPUP.WIDTH;
      const popupHeight = Math.min(LAYOUT.POPUP.MAX_HEIGHT, viewportHeight - 40);
      const margin = LAYOUT.POPUP.MARGIN;

      // 计算位置
      let left;
      if (iconRect.left - popupWidth - margin >= margin) {
        left = iconRect.left - popupWidth - margin;
      } else if (iconRect.right + popupWidth + margin <= viewportWidth - margin) {
        left = iconRect.right + margin;
      } else {
        left = Math.max(margin, (viewportWidth - popupWidth) / 2);
      }

      let top = iconRect.top + (iconRect.height / 2) - (popupHeight / 2);
      if (top + popupHeight > viewportHeight - margin) {
        top = viewportHeight - popupHeight - margin;
      }
      if (top < margin) {
        top = margin;
      }

      // 创建 Shadow DOM 容器
      const shadowHost = document.createElement('div');
      shadowHost.className = 'prompt-assistant-shadow-host';
      shadowHost.style.cssText = `
        position: fixed !important;
        left: ${left}px !important;
        top: ${top}px !important;
        width: ${popupWidth}px !important;
        height: ${popupHeight}px !important;
        z-index: ${Z_INDEX.POPUP} !important;
        margin: 0 !important;
        padding: 0 !important;
      `;

      const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

      // 添加样式
      const style = document.createElement('style');
      style.textContent = getPopupStyles(popupHeight);
      shadowRoot.appendChild(style);

      // 构建弹窗内容
      const popup = this.createPopupElement(shadowRoot);
      shadowRoot.appendChild(popup);

      document.body.appendChild(shadowHost);

      this.currentPopup = shadowHost;
      this.currentPopupShadowRoot = shadowRoot;
      this.currentTargetInput = inputElement;
      this.dialogManager.setContainer(shadowRoot);

      // 设置事件监听
      this.setupEvents(shadowRoot, inputElement);
    }

    /**
     * 数据变更后重建弹窗内容（保持弹窗打开，并保留搜索/筛选/模式状态）
     */
    async refresh() {
      if (!this.currentPopupShadowRoot) return;

      await this.dataManager.loadAll();
      this.dialogManager.setPrompts(this.dataManager.prompts);

      const shadowRoot = this.currentPopupShadowRoot;
      const oldPopup = shadowRoot.querySelector('.prompt-assistant-popup');

      // 星标点击、跨标签页同步都会触发刷新，不能丢掉用户当前的交互状态
      const preserved = {
        search: shadowRoot.querySelector('#prompt-search-input')?.value || '',
        filter: shadowRoot.querySelector('.filter-tag.active')?.dataset.filter || 'all',
        mode: oldPopup?.classList.contains('edit-mode') ? 'edit'
            : oldPopup?.classList.contains('delete-mode') ? 'delete'
            : 'normal'
      };

      oldPopup?.remove();
      shadowRoot.appendChild(this.createPopupElement(shadowRoot));
      this.setupEvents(shadowRoot, this.currentTargetInput, preserved);
    }

    /**
     * 创建弹窗元素
     */
    createPopupElement(shadowRoot) {
      const allPrompts = [];
      Object.entries(this.dataManager.prompts).forEach(([category, prompts]) => {
        prompts.forEach((prompt, index) => {
          allPrompts.push({ ...prompt, category, index });
        });
      });

      const starredPrompts = this.dataManager.starredPrompts || [];

      const categoryTagsHtml = Object.keys(this.dataManager.prompts).map(cat =>
        `<button class="filter-tag" data-filter="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
      ).join('');

      let promptItemsHtml = '';
      if (allPrompts.length === 0) {
        promptItemsHtml = '<div class="no-prompts">暂无提示词，点击右上角 + 添加</div>';
      } else {
        promptItemsHtml = allPrompts.map(prompt => {
          const isStarred = this.dataManager.isStarred(prompt.category, prompt.index);
          return `<div class="prompt-item" data-category="${escapeHtml(prompt.category)}" data-index="${prompt.index}" data-starred="${isStarred}">
          <div class="prompt-header">
            <div class="prompt-title">${escapeHtml(prompt.title)}</div>
            <button class="star-btn ${isStarred ? 'starred' : ''}" data-category="${escapeHtml(prompt.category)}" data-index="${prompt.index}" title="星标">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1l2 4.5 4.8.4-3.5 3.3.8 4.8-4.8-2.5-4.8 2.5.8-4.8-3.5-3.3 4.8-.4z"/>
              </svg>
            </button>
          </div>
          <div class="prompt-preview">${escapeHtml(prompt.content)}</div>
          <div class="item-mode-actions">
            <button class="item-action-btn item-edit-btn" data-category="${escapeHtml(prompt.category)}" data-index="${prompt.index}" title="编辑">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
              </svg>
            </button>
            <button class="item-action-btn item-delete-btn" data-category="${escapeHtml(prompt.category)}" data-index="${prompt.index}" title="删除">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>`;
        }).join('');
      }

      const popup = document.createElement('div');
      popup.className = 'prompt-assistant-popup';
      popup.innerHTML = `
      <div class="popup-header">
        <div class="popup-header-top">
          <h2>快速提示词</h2>
          <div class="header-actions">
            <button class="mode-toggle-btn add-prompt-btn" id="add-prompt-btn" title="添加提示词">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1z"/>
              </svg>
            </button>
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
            <button class="mode-toggle-btn" id="settings-btn" title="设置">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.53 1.53 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.53 1.53 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.534 1.534 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"/>
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
          <button class="filter-tag filter-starred" data-filter="starred">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: middle; margin-right: 2px;">
              <path d="M8 1l2 4.5 4.8.4-3.5 3.3.8 4.8-4.8-2.5-4.8 2.5.8-4.8-3.5-3.3 4.8-.4z"/>
            </svg>
            星标 (${starredPrompts.length})
          </button>
          ${categoryTagsHtml}
        </div>
      </div>
      <div class="popup-content">
        <div class="prompt-grid" id="prompt-grid">
          ${promptItemsHtml}
        </div>
      </div>
    `;

      return popup;
    }

    /**
     * 设置弹窗事件
     * preservedState: refresh() 重建时传入，恢复搜索/筛选/模式状态
     */
    setupEvents(shadowRoot, inputElement, preservedState = null) {
      const popup = shadowRoot.querySelector('.prompt-assistant-popup');
      // 筛选值需仍存在于标签中（分类可能已被删除），否则退回 all
      const filterStillExists = preservedState?.filter &&
        shadowRoot.querySelector(`.filter-tag[data-filter="${CSS.escape(preservedState.filter)}"]`);
      let currentFilter = filterStillExists ? preservedState.filter : 'all';
      let currentSearch = preservedState?.search || '';
      let currentMode = 'normal';

      // 关闭按钮
      shadowRoot.querySelector('.close-btn').addEventListener('click', () => this.close());

      // 打开设置（页内浮层，替代扩展 popup）
      shadowRoot.getElementById('settings-btn').addEventListener('click', () => {
        this.close();
        settingsPanel.open();
      });

      // 模式切换
      const setMode = (mode) => {
        currentMode = mode;
        popup.classList.remove('edit-mode', 'delete-mode');
        if (mode === 'edit') {
          popup.classList.add('edit-mode');
          shadowRoot.getElementById('edit-mode-btn').classList.add('active');
          shadowRoot.getElementById('delete-mode-btn').classList.remove('active');
        } else if (mode === 'delete') {
          popup.classList.add('delete-mode');
          shadowRoot.getElementById('delete-mode-btn').classList.add('active');
          shadowRoot.getElementById('edit-mode-btn').classList.remove('active');
        } else {
          shadowRoot.getElementById('edit-mode-btn').classList.remove('active');
          shadowRoot.getElementById('delete-mode-btn').classList.remove('active');
        }
      };

      shadowRoot.getElementById('edit-mode-btn').addEventListener('click', () => {
        setMode(currentMode === 'edit' ? 'normal' : 'edit');
      });

      shadowRoot.getElementById('delete-mode-btn').addEventListener('click', () => {
        setMode(currentMode === 'delete' ? 'normal' : 'delete');
      });

      // 搜索和过滤
      const filterPrompts = () => {
        const promptItems = shadowRoot.querySelectorAll('.prompt-item');
        let visibleCount = 0;

        promptItems.forEach(item => {
          const category = item.dataset.category;
          const index = parseInt(item.dataset.index);
          const title = item.querySelector('.prompt-title').textContent;
          const preview = item.querySelector('.prompt-preview').textContent;

          let matchesFilter = currentFilter === 'all';
          if (currentFilter === 'starred') {
            matchesFilter = this.dataManager.isStarred(category, index);
          } else if (currentFilter !== 'all') {
            matchesFilter = category === currentFilter;
          }

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
        let noResults = shadowRoot.querySelector('.no-results');
        if (visibleCount === 0 && !noResults) {
          noResults = document.createElement('div');
          noResults.className = 'no-results';
          noResults.textContent = currentSearch ? '没有找到匹配的提示词' : '该分类下暂无提示词';
          shadowRoot.querySelector('.prompt-grid').appendChild(noResults);
        } else if (visibleCount > 0 && noResults) {
          noResults.remove();
        }
      };

      shadowRoot.querySelector('#prompt-search-input').addEventListener('input', (e) => {
        currentSearch = e.target.value;
        filterPrompts();
      });

      shadowRoot.querySelectorAll('.filter-tag').forEach(tag => {
        tag.addEventListener('click', () => {
          shadowRoot.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
          tag.classList.add('active');
          currentFilter = tag.dataset.filter;
          filterPrompts();
        });
      });

      // 恢复刷新前的搜索/筛选/模式状态
      if (currentSearch) {
        shadowRoot.querySelector('#prompt-search-input').value = currentSearch;
      }
      if (currentFilter !== 'all') {
        shadowRoot.querySelectorAll('.filter-tag').forEach(t =>
          t.classList.toggle('active', t.dataset.filter === currentFilter));
      }
      if (preservedState?.mode === 'edit' || preservedState?.mode === 'delete') {
        setMode(preservedState.mode);
      }
      if (currentSearch || currentFilter !== 'all') {
        filterPrompts();
      }

      // 星标按钮
      shadowRoot.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const category = btn.dataset.category;
          const index = parseInt(btn.dataset.index);
          const promptItem = btn.closest('.prompt-item');
          const promptTitle = promptItem.querySelector('.prompt-title').textContent;

          const isStarred = await this.dataManager.toggleStar(category, index, promptTitle);

          btn.classList.toggle('starred', isStarred);
          promptItem.dataset.starred = String(isStarred);

          // 更新星标数量显示
          const starredCountTag = shadowRoot.querySelector('.filter-starred');
          if (starredCountTag) {
            starredCountTag.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: middle; margin-right: 2px;">
                <path d="M8 1l2 4.5 4.8.4-3.5 3.3.8 4.8-4.8-2.5-4.8 2.5.8-4.8-3.5-3.3 4.8-.4z"/>
              </svg>
              星标 (${this.dataManager.starredPrompts.length})
            `;
          }

          if (currentFilter === 'starred') {
            filterPrompts();
          }
        });
      });

      // 提示词点击
      shadowRoot.querySelectorAll('.prompt-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.closest('.item-action-btn') || e.target.closest('.star-btn')) {
            return;
          }
          if (currentMode !== 'normal') {
            return;
          }

          e.preventDefault();
          e.stopPropagation();

          const category = item.dataset.category;
          const index = parseInt(item.dataset.index);
          const prompt = this.dataManager.prompts[category][index];

          if (inputElement && inputElement.isConnected) {
            inputElement.focus();

            setTimeout(() => {
              PromptInserter.insert(inputElement, prompt.content);

              setTimeout(() => {
                this.dialogManager.showToast(`已插入: ${prompt.title}`);
                this.close();
              }, DELAY.POPUP_CLOSE_DELAY);
            }, 20);
          } else {
            this.dialogManager.showToast('插入失败：输入框不可用');
            this.close();
          }
        });
      });

      // 编辑按钮
      shadowRoot.querySelectorAll('.item-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const category = btn.dataset.category;
          const index = parseInt(btn.dataset.index);

          this.dialogManager.showEditPromptDialog(category, index, async (data) => {
            if (data.delete) {
              await this.dataManager.deletePrompt(category, index);
              this.dialogManager.showToast('提示词已删除');
            } else {
              // 走移动/更新语义，保留原 id（星标依赖 id），避免编辑变成复制
              const original = this.dataManager.prompts[category]?.[index];
              await this.dataManager.movePrompt(category, index, data.category, {
                id: original?.id,
                title: data.title,
                content: data.content
              });
              this.dialogManager.showToast('提示词已更新');
            }
            await this.refresh();
          });
        });
      });

      // 删除按钮
      shadowRoot.querySelectorAll('.item-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const category = btn.dataset.category;
          const index = parseInt(btn.dataset.index);
          const prompt = this.dataManager.prompts[category][index];

          this.dialogManager.showDeleteConfirmDialog(category, index, prompt.title, async () => {
            await this.dataManager.deletePrompt(category, index);
            this.dialogManager.showToast('提示词已删除');
            await this.refresh();
          });
        });
      });

      // 添加新提示词（顶部按钮）
      shadowRoot.getElementById('add-prompt-btn').addEventListener('click', () => {
        this.dialogManager.showAddPromptDialog(async (data) => {
          await this.dataManager.savePrompt(data.category, {
            title: data.title,
            content: data.content
          });
          this.dialogManager.showToast('提示词已保存');
          await this.refresh();
        }, currentFilter === 'all' ? null : currentFilter);
      });

      // 点击外部关闭
      const closeOnOutsideClick = (e) => {
        const path = e.composedPath();
        if (!path.includes(this.currentPopup)) {
          this.close();
          document.removeEventListener('click', closeOnOutsideClick);
        }
      };
      setTimeout(() => {
        document.addEventListener('click', closeOnOutsideClick);
      }, 100);
    }

    /**
     * 关闭弹窗
     */
    close() {
      if (this.currentPopup) {
        this.currentPopup.remove();
        this.currentPopup = null;
        this.currentPopupShadowRoot = null;
        this.currentTargetInput = null;
        this.dialogManager.setContainer(document.body);
      }
    }
  }

  // ==================== 提示词插入模块 ====================

  class PromptInserter {
    static insert(inputElement, content) {
      inputElement.focus();

      setTimeout(() => {
        try {
          const tagName = inputElement.tagName.toLowerCase();

          if (tagName === 'textarea' || tagName === 'input') {
            this.insertIntoTextArea(inputElement, content);
          } else if (inputElement.isContentEditable) {
            this.insertIntoContentEditable(inputElement, content);
          }

          DebugLog.log('提示词插入成功');
        } catch (error) {
          DebugLog.error('插入提示词时出错:', error);
          this.fallbackInsert(inputElement, content);
        }
      }, 10);
    }

    /**
     * 取原生 value setter（受控组件会在实例上劫持 value 属性，原型 setter 不受影响）
     */
    static getNativeValueSetter(inputElement) {
      const proto = inputElement.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      return Object.getOwnPropertyDescriptor(proto, 'value')?.set || null;
    }

    static insertIntoTextArea(inputElement, content) {
      const start = inputElement.selectionStart ?? inputElement.value.length;
      const end = inputElement.selectionEnd ?? start;
      const value = inputElement.value || '';

      const newValue = value.substring(0, start) + content + value.substring(end);

      // React/Vue 等受控组件会在失焦/重渲染时用内部状态覆盖直接赋值
      // （表现为点击页面空白后内容消失），必须走原生 setter + input 事件
      const nativeSetter = this.getNativeValueSetter(inputElement);
      if (nativeSetter) {
        nativeSetter.call(inputElement, newValue);
      } else {
        inputElement.value = newValue;
      }

      const newCursorPos = start + content.length;
      inputElement.setSelectionRange(newCursorPos, newCursorPos);
      inputElement.scrollTop = inputElement.scrollHeight;

      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }

    static insertIntoContentEditable(inputElement, content) {
      // 富文本编辑器（Lexical/ProseMirror 等）自管 DOM，手工插文本节点
      // 不进编辑器状态；execCommand 走浏览器编辑管线，编辑器能正常捕获
      let inserted = false;
      try {
        inputElement.focus();
        this.ensureCaretInside(inputElement);
        inserted = document.execCommand('insertText', false, content);
      } catch (e) {
        inserted = false;
      }

      if (!inserted) {
        this.insertViaRange(inputElement, content);
      }
    }

    static ensureCaretInside(inputElement) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && inputElement.contains(selection.anchorNode)) {
        return;
      }
      const range = document.createRange();
      range.selectNodeContents(inputElement);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    static insertViaRange(inputElement, content) {
      const selection = window.getSelection();
      let range;

      if (selection.rangeCount > 0 &&
          inputElement.contains(selection.getRangeAt(0).commonAncestorContainer)) {
        range = selection.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(inputElement);
        range.collapse(false);
      }

      range.deleteContents();

      const textNode = document.createTextNode(content);
      range.insertNode(textNode);

      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);

      inputElement.focus();
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }

    static fallbackInsert(inputElement, content) {
      try {
        const tagName = inputElement.tagName.toLowerCase();

        if (tagName === 'textarea' || tagName === 'input') {
          const oldValue = inputElement.value || '';
          const newValue = oldValue + content;
          const nativeSetter = this.getNativeValueSetter(inputElement);
          if (nativeSetter) {
            nativeSetter.call(inputElement, newValue);
          } else {
            inputElement.value = newValue;
          }
          const newPos = newValue.length;
          inputElement.setSelectionRange(newPos, newPos);
          inputElement.scrollTop = inputElement.scrollHeight;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (inputElement.isContentEditable) {
          inputElement.focus();
          this.ensureCaretInside(inputElement);
          if (!document.execCommand('insertText', false, content)) {
            inputElement.textContent += content;
          }
        }

        inputElement.focus();
        DebugLog.log('降级方案成功');
      } catch (fallbackError) {
        DebugLog.error('降级方案也失败:', fallbackError);
      }
    }
  }

  // ==================== 设置面板（替代扩展 popup 管理页） ====================

  class SettingsPanel {
    constructor() {
      this.overlay = null;
      this._stylesInjected = false;
    }

    open() {
      // 关闭可能打开的提示词弹窗（弹窗 z-index 更高）
      promptAssistant?.popupManager?.close();
      this.close();

      this.injectStyles();

      const settings = { ...DEFAULT_SETTINGS, ...(Store.get('settings', null) || {}) };

      const overlay = document.createElement('div');
      overlay.className = 'apa-settings-overlay';
      overlay.innerHTML = `
        <div class="apa-settings-panel">
          <div class="apa-settings-header">
            <h3>AI Prompt Assistant 设置</h3>
            <button class="apa-close-btn">×</button>
          </div>

          <div class="apa-section">
            <h4>通用设置</h4>
            <div class="apa-row">
              <span>显示悬浮球</span>
              <label class="apa-toggle">
                <input type="checkbox" id="apa-showIcon" ${settings.showIcon !== false ? 'checked' : ''}>
                <span class="apa-toggle-slider"></span>
              </label>
            </div>
            <div class="apa-row">
              <span>悬浮球位置</span>
              <div class="apa-radio-group">
                <label class="apa-radio"><input type="radio" name="apa-iconPosition" value="right" ${settings.iconPosition !== 'left' ? 'checked' : ''}><span>右侧</span></label>
                <label class="apa-radio"><input type="radio" name="apa-iconPosition" value="left" ${settings.iconPosition === 'left' ? 'checked' : ''}><span>左侧</span></label>
              </div>
            </div>
          </div>

          <div class="apa-section">
            <h4>网站管理</h4>
            <div id="apa-sites-list"></div>
            <div class="apa-add-site">
              <input type="text" id="apa-site-name" class="apa-input" placeholder="网站名称，如：智谱清言">
              <input type="text" id="apa-site-host" class="apa-input" placeholder="域名，如：chatglm.cn">
              <button id="apa-add-site-btn" class="apa-btn apa-btn-primary">添加</button>
            </div>
            <p class="apa-hint">只需域名，无需 http://；以 . 开头（如 .doubao.com）匹配所有子域名。常见 AI 平台会自动转换。</p>
          </div>

          <div class="apa-section">
            <h4>数据管理</h4>
            <div class="apa-row">
              <span>备份 / 恢复（JSON）</span>
              <div class="apa-btn-group">
                <button id="apa-export-btn" class="apa-btn apa-btn-secondary">导出</button>
                <button id="apa-import-btn" class="apa-btn apa-btn-secondary">导入</button>
                <input type="file" id="apa-import-file" accept=".json" style="display: none;">
              </div>
            </div>
          </div>

          <div class="apa-footer">v${EXT_VERSION} · 数据仅存储在本浏览器（脚本管理器存储）· MIT License</div>
        </div>
      `;

      this.overlay = overlay;
      this.bindEvents(overlay);
      this.renderSitesList(overlay);
      document.body.appendChild(overlay);
    }

    close() {
      this.overlay?.remove();
      this.overlay = null;
    }

    injectStyles() {
      if (this._stylesInjected || document.getElementById('apa-settings-styles')) {
        this._stylesInjected = true;
        return;
      }
      const style = document.createElement('style');
      style.id = 'apa-settings-styles';
      style.textContent = getSettingsStyles();
      document.head.appendChild(style);
      this._stylesInjected = true;
    }

    bindEvents(overlay) {
      overlay.querySelector('.apa-close-btn').addEventListener('click', () => this.close());
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });

      overlay.querySelector('#apa-showIcon').addEventListener('change', (e) => {
        this.saveSettings({ showIcon: e.target.checked });
      });

      overlay.querySelectorAll('input[name="apa-iconPosition"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.saveSettings({ iconPosition: e.target.value });
        });
      });

      overlay.querySelector('#apa-add-site-btn').addEventListener('click', () => this.saveSite(overlay));

      overlay.querySelector('#apa-export-btn').addEventListener('click', () => this.exportData());
      overlay.querySelector('#apa-import-btn').addEventListener('click', () => {
        overlay.querySelector('#apa-import-file').click();
      });
      overlay.querySelector('#apa-import-file').addEventListener('change', (e) => {
        this.importData(e.target.files[0], overlay);
      });
    }

    saveSettings(patch) {
      const merged = { ...DEFAULT_SETTINGS, ...(Store.get('settings', null) || {}), ...patch };
      Store.set('settings', merged);
    }

    renderSitesList(overlay) {
      const listEl = overlay.querySelector('#apa-sites-list');
      const sites = Store.get('aiSites', DEFAULT_AI_SITES) || [];

      if (sites.length === 0) {
        listEl.innerHTML = '<p class="apa-hint">暂无网站，请在下方添加</p>';
        return;
      }

      listEl.innerHTML = sites.map((site, index) => `
        <div class="apa-site-item">
          <div class="apa-site-info">
            <span class="apa-site-name">${escapeHtml(site.name)}</span>
            <span class="apa-site-host">${escapeHtml(site.hostname)}</span>
          </div>
          <div class="apa-site-actions">
            <label class="apa-toggle">
              <input type="checkbox" data-site-index="${index}" ${site.enabled ? 'checked' : ''}>
              <span class="apa-toggle-slider"></span>
            </label>
            <button class="apa-site-del" data-site-index="${index}" title="删除">×</button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const index = parseInt(e.target.dataset.siteIndex);
          const sites = Store.get('aiSites', DEFAULT_AI_SITES) || [];
          if (!sites[index]) return;
          sites[index].enabled = e.target.checked;
          Store.set('aiSites', sites);
        });
      });

      listEl.querySelectorAll('.apa-site-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.siteIndex);
          const sites = Store.get('aiSites', DEFAULT_AI_SITES) || [];
          const site = sites[index];
          if (!site) return;
          if (!confirm(`确定要删除 "${site.name}" (${site.hostname}) 吗？`)) return;
          sites.splice(index, 1);
          Store.set('aiSites', sites);
          this.renderSitesList(overlay);
        });
      });
    }

    saveSite(overlay) {
      const name = overlay.querySelector('#apa-site-name').value.trim();
      let hostname = overlay.querySelector('#apa-site-host').value.trim();

      if (!name || !hostname) {
        alert('请填写完整信息');
        return;
      }
      if (hostname.includes('http://') || hostname.includes('https://') || hostname.includes('/')) {
        alert('请输入纯域名，不需要http://或路径');
        return;
      }

      // match 逻辑不支持端口号，剥离后保存（如 localhost:3000 -> localhost）
      hostname = hostname.replace(/:\d+$/, '');
      if (!hostname) {
        alert('请输入有效域名');
        return;
      }

      // 对于常见AI平台，自动转换为 .domain.com 格式以支持所有子域名
      if (!hostname.startsWith('.')) {
        const commonPlatforms = [
          'deepseek.com', 'openai.com', 'anthropic.com', 'claude.ai',
          'google.com', 'microsoft.com', 'baidu.com', 'alibaba.com',
          'tencent.com', 'bytedance.com', 'doubao.com', 'z.ai',
          'perplexity.ai', 'poe.com', 'character.ai', 'gemini.com'
        ];
        const parts = hostname.split('.');
        if (parts.length >= 2) {
          const mainDomain = parts.slice(-2).join('.');
          if (commonPlatforms.includes(mainDomain) || commonPlatforms.some(p => hostname.endsWith(p))) {
            hostname = '.' + mainDomain;
            DebugLog.log(`[添加网站] 自动转换为子域名格式: ${hostname}`);
          }
        }
      }

      const sites = Store.get('aiSites', DEFAULT_AI_SITES) || [];
      if (sites.some(site => site.hostname === hostname)) {
        alert('该网站已存在');
        return;
      }

      sites.push({ name, hostname, enabled: true });
      Store.set('aiSites', sites);

      overlay.querySelector('#apa-site-name').value = '';
      overlay.querySelector('#apa-site-host').value = '';
      this.renderSitesList(overlay);
    }

    exportData() {
      const data = {
        prompts: Store.get('prompts', null) || {},
        settings: { ...DEFAULT_SETTINGS, ...(Store.get('settings', null) || {}) },
        starredPrompts: Store.get('starredPrompts', null) || [],
        aiSites: Store.get('aiSites', DEFAULT_AI_SITES) || [],
        exportDate: new Date().toISOString(),
        version: EXT_VERSION
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-prompts-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    importData(file, overlay) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || typeof data !== 'object') {
            throw new Error('无效的数据格式');
          }

          // 与扩展版共用语义的合并：提示词/星标按 id 去重、站点按 hostname 合并、设置白名单
          const merged = applyImport({
            prompts: Store.get('prompts', null) || {},
            settings: Store.get('settings', null) || {},
            starredPrompts: Store.get('starredPrompts', null) || [],
            aiSites: Store.get('aiSites', DEFAULT_AI_SITES) || []
          }, data);

          if (merged.prompts !== null) Store.set('prompts', merged.prompts);
          if (merged.starredPrompts !== null) Store.set('starredPrompts', merged.starredPrompts);
          if (merged.settings !== null) Store.set('settings', merged.settings);
          if (merged.aiSites !== null) Store.set('aiSites', merged.aiSites);

          if (merged.prompts === null && merged.starredPrompts === null &&
              merged.settings === null && merged.aiSites === null) {
            throw new Error('文件中没有可导入的数据');
          }

          const extra = merged.addedSites > 0 ? `、${merged.addedSites} 个站点` : '';
          alert(`导入成功：新增 ${merged.addedPrompts} 条提示词${extra}`);
          // 重新渲染当前面板（数据与设置项可能已变化）
          this.open();
        } catch (error) {
          DebugLog.error('导入失败:', error);
          alert('导入失败：' + error.message);
        }
      };
      reader.readAsText(file);
    }
  }

  // ==================== 样式 ====================

  function getPopupStyles(popupHeight) {
    const contentHeight = popupHeight - 150;
    return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    .prompt-assistant-popup {
      width: 100%;
      height: 100%;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 12px 48px rgba(0, 00, 0, 0.15);
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      display: flex;
      flex-direction: column;
    }
    .popup-header {
      padding: 0;
      background: transparent;
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid #eee;
      flex-shrink: 0;
    }
    .popup-header-top {
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .popup-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #222;
    }
    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .close-btn, .mode-toggle-btn {
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
    .close-btn:hover, .mode-toggle-btn:hover {
      background: #e0e0e0;
      color: #333;
    }
    .mode-toggle-btn.active {
      background: #4CAF50;
      color: white;
    }
    .mode-toggle-btn svg {
      width: 16px;
      height: 16px;
    }
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
    .popup-filters {
      padding: 8px 16px;
      display: flex;
      gap: 8px;
      border-bottom: 1px solid #f0f0f0;
      overflow-x: auto;
      flex-shrink: 0;
      scroll-behavior: smooth;
    }
    .popup-filters::-webkit-scrollbar {
      height: 6px;
    }
    .popup-filters::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    .popup-filters::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }
    .popup-filters::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
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
      flex: 1;
      overflow-y: auto;
      min-height: ${contentHeight}px;
    }
    .prompt-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .prompt-item {
      background: #f8f8f8;
      border-radius: 10px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      border: 2px solid transparent;
    }
    .prompt-item:hover {
      background: #f0f0f0;
      border-color: #4CAF50;
    }
    .prompt-item .prompt-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }
    .prompt-title {
      font-weight: 600;
      color: #333;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .prompt-preview {
      color: #666;
      font-size: 12px;
      line-height: 1.4;
      max-height: 2.8em;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .star-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: #ccc;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .star-btn:hover {
      color: #FFD700;
      transform: scale(1.2);
    }
    .star-btn svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
    .star-btn.starred {
      color: #FFD700;
    }
    .star-btn.starred svg {
      fill: #FFD700;
    }
    .filter-starred svg {
      fill: #FFD700;
    }
    .filter-starred.active {
      background: #FFF8E1;
      color: #F57C00;
    }
    .item-mode-actions {
      display: none;
      position: absolute;
      top: 6px;
      right: 6px;
      gap: 4px;
    }
    .edit-mode .item-mode-actions,
    .delete-mode .item-mode-actions {
      display: flex;
    }
    .edit-mode .prompt-item,
    .delete-mode .prompt-item {
      padding-right: 60px;
      cursor: default;
    }
    .item-action-btn {
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      color: #666;
    }
    .item-action-btn:hover {
      background: #4CAF50;
      color: white;
    }
    .item-edit-btn:hover {
      background: #2196F3;
    }
    .item-delete-btn:hover {
      background: #f44336;
    }
    /* 顶栏"添加"按钮：复用 mode-toggle-btn 布局，绿色区分主操作 */
    .add-prompt-btn {
      background: #4CAF50;
      color: white;
    }
    .add-prompt-btn:hover {
      background: #45a049;
      color: white;
    }
    .no-prompts {
      grid-column: 1 / -1;
      text-align: center;
      color: #999;
      padding: 40px 20px;
    }
    .hidden {
      display: none !important;
    }
    .no-results {
      grid-column: 1 / -1;
      text-align: center;
      color: #999;
      padding: 40px 20px;
    }
    .confirm-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 10000;
      min-width: 300px;
    }
    .confirm-dialog h3 {
      margin: 0 0 8px;
      font-size: 18px;
      color: #333;
    }
    .confirm-dialog p {
      color: #666;
      margin-bottom: 20px;
    }
    .confirm-dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .prompt-assistant-dialog {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000003;
      animation: dialogFadeIn 0.2s ease;
    }
    @keyframes dialogFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
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
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin: 0 0 12px;
    }
    .dialog-content p {
      color: #666;
      margin-bottom: 16px;
    }
    .form-group {
      margin-bottom: 14px;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #555;
      margin-bottom: 4px;
    }
    .form-group input[type="text"],
    .form-group textarea {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      min-height: 60px;
    }
    .form-group input[type="text"]:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #4CAF50;
      box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
    }
    .category-select-wrapper {
      position: relative;
    }
    .category-select {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      background: #f9f9f9;
      appearance: none;
      cursor: pointer;
    }
    .new-category-input {
      margin-top: 8px;
    }
    .new-category-input input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
    }
    .dialog-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
    }
    .dialog-actions-right {
      display: flex;
      gap: 8px;
    }
    .text-btn {
      background: none;
      border: none;
      color: #4CAF50;
      font-size: 12px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .text-btn:hover {
      text-decoration: underline;
    }
    .dialog-content .save-btn {
      padding: 8px 20px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    .dialog-content .save-btn:hover {
      background: #45a049;
    }
    .dialog-content .cancel-btn {
      padding: 8px 20px;
      background: #f5f5f5;
      color: #666;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .dialog-content .cancel-btn:hover {
      background: #e0e0e0;
    }
    .dialog-content .delete-confirm-btn {
      padding: 8px 20px;
      background: #d32f2f;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .dialog-content .delete-confirm-btn:hover {
      background: #b71c1c;
    }
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
      z-index: ${Z_INDEX.TOAST};
      animation: toastFadeIn 0.2s ease;
      transition: opacity 0.3s ease;
    }
    @keyframes toastFadeIn {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @media (prefers-color-scheme: dark) {
      .prompt-assistant-popup {
        background: #1e1e1e;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
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
      .dialog-content {
        background: #1e1e1e;
      }
      .dialog-content h3 {
        color: #e0e0e0;
      }
      .dialog-content label {
        color: #aaa;
      }
      .form-group input[type="text"],
      .form-group textarea {
        background: #2a2a2a;
        border-color: #444;
        color: #ddd;
      }
      .category-select {
        background: #2a2a2a;
        border-color: #444;
        color: #ddd;
      }
    }
  `;
  }

  function getGlobalStyles() {
    return `
    .prompt-assistant-icon {
      opacity: 0.5;
    }
    .prompt-assistant-icon:hover {
      opacity: 1 !important;
      transform: scale(${LAYOUT.ICON.HOVER_SCALE});
      box-shadow: 0 5px 15px rgba(76, 175, 80, 0.4);
    }
    .prompt-assistant-dialog {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: ${Z_INDEX.DIALOG};
      animation: dialogFadeIn 0.2s ease;
    }
    @keyframes dialogFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .confirm-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 10000;
      min-width: 300px;
    }
    .confirm-dialog h3 {
      margin: 0 0 8px;
      font-size: 18px;
      color: #333;
    }
    .confirm-dialog p {
      color: #666;
      margin-bottom: 20px;
    }
    .confirm-dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
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
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin: 0 0 12px;
    }
    .dialog-content p {
      color: #666;
      margin-bottom: 16px;
    }
    .form-group {
      margin-bottom: 14px;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #555;
      margin-bottom: 4px;
    }
    .form-group input[type="text"],
    .form-group textarea {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      min-height: 60px;
    }
    .form-group input[type="text"]:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #4CAF50;
      box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
    }
    .category-select-wrapper {
      position: relative;
    }
    .category-select {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      background: #f9f9f9;
      appearance: none;
      cursor: pointer;
    }
    .new-category-input {
      margin-top: 8px;
    }
    .new-category-input input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
    }
    .dialog-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
    }
    .dialog-actions-right {
      display: flex;
      gap: 8px;
    }
    .text-btn {
      background: none;
      border: none;
      color: #4CAF50;
      font-size: 12px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .text-btn:hover {
      text-decoration: underline;
    }
    .dialog-content .save-btn {
      padding: 8px 20px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    .dialog-content .save-btn:hover {
      background: #45a049;
    }
    .dialog-content .cancel-btn {
      padding: 8px 20px;
      background: #f5f5f5;
      color: #666;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .dialog-content .cancel-btn:hover {
      background: #e0e0e0;
    }
    .dialog-content .delete-confirm-btn {
      padding: 8px 20px;
      background: #d32f2f;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .dialog-content .delete-confirm-btn:hover {
      background: #b71c1c;
    }
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
      z-index: ${Z_INDEX.TOAST};
      animation: toastFadeIn 0.2s ease;
      transition: opacity 0.3s ease;
    }
    @keyframes toastFadeIn {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @media (prefers-color-scheme: dark) {
      .prompt-assistant-popup {
        background: #1e1e1e;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
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
      .dialog-content {
        background: #1e1e1e;
      }
      .dialog-content h3 {
        color: #e0e0e0;
      }
      .dialog-content label {
        color: #aaa;
      }
      .form-group input[type="text"],
      .form-group textarea {
        background: #2a2a2a;
        border-color: #444;
        color: #ddd;
      }
      .category-select {
        background: #2a2a2a;
        border-color: #444;
         color: #ddd;
      }
    }
  `;
  }

  function getSettingsStyles() {
    return `
    .apa-settings-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: ${Z_INDEX.DIALOG};
      animation: dialogFadeIn 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .apa-settings-panel {
      background: #fff;
      border-radius: 16px;
      width: 420px;
      max-width: calc(100vw - 32px);
      max-height: 80vh;
      overflow-y: auto;
      padding: 20px 24px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
      font-size: 14px;
      color: #222;
    }
    .apa-settings-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .apa-settings-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    .apa-close-btn {
      background: #f5f5f5;
      border: none;
      color: #666;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 10px;
      border-radius: 6px;
      line-height: 1;
    }
    .apa-close-btn:hover {
      background: #e0e0e0;
    }
    .apa-section {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;
    }
    .apa-section h4 {
      margin: 0 0 8px;
      font-size: 13px;
      color: #888;
      font-weight: 600;
    }
    .apa-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
    }
    .apa-site-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      border: 1px solid #eee;
      border-radius: 8px;
      margin-bottom: 6px;
    }
    .apa-site-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .apa-site-name {
      font-weight: 600;
      font-size: 13px;
    }
    .apa-site-host {
      font-size: 12px;
      color: #999;
    }
    .apa-site-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .apa-site-del {
      border: none;
      background: none;
      color: #f44336;
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .apa-toggle {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
    }
    .apa-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .apa-toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #ccc;
      border-radius: 20px;
      transition: 0.2s;
    }
    .apa-toggle-slider::before {
      content: '';
      position: absolute;
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.2s;
    }
    .apa-toggle input:checked + .apa-toggle-slider {
      background: #4CAF50;
    }
    .apa-toggle input:checked + .apa-toggle-slider::before {
      transform: translateX(16px);
    }
    .apa-radio-group {
      display: flex;
      gap: 12px;
    }
    .apa-radio {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .apa-add-site {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    .apa-input {
      flex: 1;
      min-width: 0;
      padding: 8px 10px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-size: 13px;
    }
    .apa-input:focus {
      outline: none;
      border-color: #4CAF50;
    }
    .apa-btn {
      padding: 8px 14px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      flex-shrink: 0;
    }
    .apa-btn-primary {
      background: #4CAF50;
      color: white;
    }
    .apa-btn-primary:hover {
      background: #45a049;
    }
    .apa-btn-secondary {
      background: #f5f5f5;
      color: #444;
    }
    .apa-btn-secondary:hover {
      background: #e8e8e8;
    }
    .apa-btn-group {
      display: flex;
      gap: 8px;
    }
    .apa-hint {
      font-size: 12px;
      color: #aaa;
      margin: 8px 0 0;
      line-height: 1.5;
    }
    .apa-footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;
      font-size: 11px;
      color: #bbb;
      text-align: center;
    }
    @media (prefers-color-scheme: dark) {
      .apa-settings-panel {
        background: #1e1e1e;
        color: #e0e0e0;
      }
      .apa-settings-header h3 { color: #e0e0e0; }
      .apa-section { border-top-color: #333; }
      .apa-site-item { border-color: #3a3a3a; }
      .apa-input { background: #2a2a2a; border-color: #444; color: #ddd; }
      .apa-btn-secondary { background: #2a2a2a; color: #ccc; }
      .apa-close-btn { background: #2a2a2a; color: #ccc; }
      .apa-footer { border-top-color: #333; }
    }
  `;
  }

  // ==================== 主入口 ====================

  class PromptAssistant {
    constructor() {
      this.isSiteEnabled = false;
      this._started = false;
    }

    async init() {
      this.siteDetector = new SiteDetector();
      this.currentSite = this.siteDetector.currentSite;

      if (this.currentSite === 'Unknown') {
        DebugLog.log('[插件初始化] 未识别的网站，将使用默认选择器');
      }

      // 数据/配置变化监听必须先于启动判断：
      // 本页未启用时，也能通过设置面板立即启用（无需刷新页面）
      DataBus.on('sites', (sites) => this.handleSitesConfigUpdated(sites));
      DataBus.on('prompts', () => this.handlePromptsUpdated());
      DataBus.on('starred', () => {
        this.dataManager?.loadAll().then(() => this.popupManager?.refresh());
      });
      DataBus.on('settings', () => {
        this.dataManager?.loadAll().then(() => this.updateFloatingIconVisibility());
      });

      if (!this.siteDetector.isSiteEnabled()) {
        DebugLog.log(`[网站检查] 当前网站 ${window.location.hostname} 未启用，插件待命`);
        return;
      }

      await this.start();
    }

    async start() {
      if (this._started) return;

      try {
        this._started = true;
        this.isSiteEnabled = true;

        // 1. 初始化数据管理器
        this.dataManager = new DataManager();
        await this.dataManager.loadAll();

        // 2. 初始化输入管理器
        this.inputManager = new InputManager(this.siteDetector);

        // 3. 初始化悬浮图标
        this.floatingIcon = new FloatingIcon(this.inputManager);
        this.floatingIcon.setPosition(this.dataManager.settings.iconPosition);

        // 4. 初始化对话框管理器
        this.dialogManager = new DialogManager(this.dataManager.prompts);

        // 5. 初始化弹窗管理器
        this.popupManager = new PopupManager(
          this.dataManager,
          this.dialogManager,
          this.floatingIcon,
          this.inputManager
        );

        // 6. 注入全局样式
        this.injectGlobalStyles();

        // 7. 创建悬浮球
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

        // 8. 查找输入框并设置监听（会触发 onInputsChanged，完成初始停靠定位）
        this.inputManager.findInputElements();
        this.observeChanges();

        // 9. 监听SPA路由变化（仅在启用站点上打补丁）
        this.setupSpaListener();

        // 10. 启动定期清理
        this.floatingIcon.startCleanup();

        DebugLog.log('AI Prompt Assistant 初始化完成');
      } catch (error) {
        this._started = false;
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

          return Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;

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
     * 提示词数据更新：先加载完成再同步给对话框/弹窗，避免拿到旧引用
     */
    async handlePromptsUpdated() {
      if (!this.dataManager) return;
      await this.dataManager.loadAll();
      this.dialogManager?.setPrompts(this.dataManager.prompts);
      await this.popupManager?.refresh();
    }

    /**
     * 处理网站配置更新（含未启动 → 启动的冷启动路径）
     */
    handleSitesConfigUpdated(sites) {
      const currentHostname = window.location.hostname;
      const enabledHostnames = (sites || [])
        .filter(site => site.enabled)
        .map(site => site.hostname);

      const nowEnabled = enabledHostnames.some(site =>
        isHostnameMatch(currentHostname, site)
      );

      if (nowEnabled) {
        if (!this._started) {
          DebugLog.log('网站已启用，启动插件');
          this.start();
          return;
        }
        this.isSiteEnabled = true;
        this.inputManager.findInputElements();
        // 重新启用时悬浮球可能已被 destroy，需要重建
        this.updateFloatingIconVisibility();
      } else {
        this.isSiteEnabled = false;
        DebugLog.log('网站已禁用，清理所有图标');
        this.floatingIcon?.destroy();
      }
    }

    /**
     * 更新悬浮球显示状态
     */
    updateFloatingIconVisibility() {
      if (!this.floatingIcon) return;
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

  // ==================== 启动 ====================

  const settingsPanel = new SettingsPanel();

  // 油猴菜单入口：任何页面都可用（包括未启用站点，便于就地启用）
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('⚙️ AI Prompt Assistant 设置', () => settingsPanel.open());
  }

  // 跨标签页数据同步（Tampermonkey 对本标签页的修改不触发，同标签页由 Store.set 直接派发）
  if (typeof GM_addValueChangeListener === 'function') {
    Object.keys(STORE_EVENT_MAP).forEach(key => {
      GM_addValueChangeListener(key, (name, oldValue, newValue) => {
        DataBus.emit(STORE_EVENT_MAP[key], newValue);
      });
    });
  }

  // 防重复初始化（脚本管理器重复注入保护）
  let promptAssistant;

  function bootPromptAssistant() {
    if (window.__promptAssistantInitialized) return;
    window.__promptAssistantInitialized = true;
    promptAssistant = new PromptAssistant();
    promptAssistant.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPromptAssistant);
  } else {
    bootPromptAssistant();
  }

})();
