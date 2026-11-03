// AI Prompt Assistant - 常量定义
// 此文件包含所有消息类型、配置常量，避免硬编码

// ==================== 消息类型常量 ====================
// 统一使用 MESSAGE_TYPES，删除 MSG 别名
const MESSAGE_TYPES = {
  // 请求消息
  GET_PROMPTS: 'GET_PROMPTS',
  SAVE_PROMPT: 'SAVE_PROMPT',
  DELETE_PROMPT: 'DELETE_PROMPT',
  MOVE_PROMPT: 'MOVE_PROMPT',
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  GET_AI_SITES: 'GET_AI_SITES',
  UPDATE_AI_SITES: 'UPDATE_AI_SITES',
  GET_ENABLED_SITES: 'GET_ENABLED_SITES',
  GET_STARRED_PROMPTS: 'GET_STARRED_PROMPTS',
  SAVE_STARRED_PROMPTS: 'SAVE_STARRED_PROMPTS',
  IMPORT_DATA: 'IMPORT_DATA',

  // 广播消息
  PROMPTS_DATA_UPDATED: 'PROMPTS_DATA_UPDATED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  SITES_CONFIG_UPDATED: 'SITES_CONFIG_UPDATED',
  STARRED_DATA_UPDATED: 'STARRED_DATA_UPDATED',
  AI_SITE_DETECTED: 'AI_SITE_DETECTED'
};

// 向后兼容：创建 MSG 别名
const MSG = MESSAGE_TYPES;

// ==================== Z-Index 常量 ====================
const Z_INDEX = {
  ICON: 999999,
  POPUP: 2147483647,  // 最大32位整数
  DIALOG: 1000001,
  TOAST: 1000004  // 提示需浮于对话框之上（对话框在 Shadow DOM 内为 1000003）
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
const EXT_VERSION = '1.4.0';

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

/**
 * 构建完整备份（导出格式 v2：含星标与站点配置）
 * @param {Object} current - { prompts, settings, starredPrompts, aiSites }
 * @returns {Object}
 */
function buildExport(current) {
  return {
    prompts: current.prompts || {},
    starredPrompts: current.starredPrompts || [],
    settings: current.settings || {},
    aiSites: current.aiSites || [],
    exportDate: new Date().toISOString(),
    version: EXT_VERSION
  };
}

/**
 * 合并导入的备份数据（popup 与内容脚本共用）
 * - prompts：逐条校验（title/content 必须为非空字符串），按 id 去重（重复导入幂等）
 * - starredPrompts：按 id 去重合并
 * - settings：白名单键 + 类型校验
 * - aiSites：按 hostname 合并（已有则覆盖属性，没有则追加）
 * @param {Object} current - 现有数据 { prompts, settings, starredPrompts, aiSites }
 * @param {Object} incoming - 导入文件解析出的对象
 * @returns {Object} { prompts, starredPrompts, settings, aiSites, addedPrompts, addedSites }
 *                   未导入的分区为 null
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

// ==================== ID 生成 ====================

let _idCounter = 0;

/**
 * 生成唯一提示词ID
 * @returns {string}
 */
function generateId() {
  return 'p' + Date.now().toString(36) + '_' + (++_idCounter);
}

// ==================== 辅助函数 ====================

/**
 * 检测当前网站名称
 * @param {string} hostname
 * @returns {string}
 */
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

// ==================== 工具函数 ====================

/**
 * 检查主机名是否匹配站点模式
 * @param {string} hostname - 如 www.example.com
 * @param {string} sitePattern - 如 .example.com 或 example.com
 * @returns {boolean}
 */
function isHostnameMatch(hostname, sitePattern) {
  if (sitePattern.startsWith('.')) {
    const baseDomain = sitePattern.substring(1);
    // 必须精确等于或以 "."+baseDomain 结尾，防止 fakedoubao.com 误匹配 .doubao.com
    return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
  }
  return hostname === sitePattern || hostname.endsWith('.' + sitePattern);
}

/**
 * HTML转义（含引号），防止标签与属性上下文注入
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  if (typeof document === 'undefined') return str;
  const div = document.createElement('div');
  div.textContent = str;
  // innerHTML 只转义 < > &，属性插值场景还需转义引号
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 向所有HTTPS标签页广播消息（并行处理）
 * @param {string} messageType - 消息类型
 * @param {Object} payload - 消息负载（可选）
 * @returns {Promise<void>}
 */
async function broadcastToTabs(messageType, payload = null) {
  if (typeof chrome?.tabs?.query !== 'function') return;
  const tabs = await chrome.tabs.query({});
  const message = payload ? { type: messageType, ...payload } : { type: messageType };

  const promises = tabs
    .filter(tab => tab.url && tab.url.startsWith('https://'))
    .map(tab => chrome.tabs.sendMessage(tab.id, message).catch(() => {}));

  await Promise.all(promises);
}
