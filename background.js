// 后台服务工作者
// 处理数据存储、内容脚本动态注册与插件生命周期管理

// 导入 constants.js（Service Worker 需要显式导入）
importScripts('constants.js');

// 动态注册的内容脚本配置（与 manifest 中移除的静态 content_scripts 对应）
const CONTENT_SCRIPT_ID = 'ai-prompt-assistant';
const CONTENT_SCRIPT_FILES = [
  'constants.js',
  'modules/siteDetector.js',
  'modules/inputManager.js',
  'modules/floatingIcon.js',
  'modules/dataManager.js',
  'modules/dialogManager.js',
  'modules/popupManager.js',
  'modules/promptInserter.js',
  'modules/styles.js',
  'content-modules.js'
];

/**
 * 将站点主机名转换为 URL 匹配模式（覆盖裸域与任意子域）
 * ".doubao.com" -> ["https://doubao.com/*", "https://*.doubao.com/*"]
 */
function hostnameToMatchPatterns(hostname) {
  const base = hostname.startsWith('.') ? hostname.slice(1) : hostname;
  return [`https://${base}/*`, `https://*.${base}/*`];
}

async function getEnabledSites() {
  const result = await chrome.storage.local.get(['aiSites']);
  const sites = result.aiSites || DEFAULT_AI_SITES;
  return sites.filter(site => site.enabled);
}

/**
 * 按启用的站点同步动态内容脚本注册（只在启用站点注入，而非所有 https 页面）
 */
async function syncContentScriptRegistration() {
  try {
    const enabled = await getEnabledSites();
    const matches = [...new Set(enabled.flatMap(site => hostnameToMatchPatterns(site.hostname)))];

    const existing = await chrome.scripting.getRegisteredContentScripts();
    if (existing.some(script => script.id === CONTENT_SCRIPT_ID)) {
      await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    }

    if (matches.length > 0) {
      await chrome.scripting.registerContentScripts([{
        id: CONTENT_SCRIPT_ID,
        matches,
        js: CONTENT_SCRIPT_FILES,
        runAt: 'document_idle',
        persistAcrossSessions: true
      }]);
    }
  } catch (e) {
    DebugLog.error('同步内容脚本注册失败:', e);
  }
}

/**
 * 向已打开且匹配启用站点的标签页补注入内容脚本
 * （注册只对未来页面生效；content-modules.js 有防重复初始化守卫）
 */
async function injectIntoExistingTabs() {
  try {
    const enabled = await getEnabledSites();
    if (enabled.length === 0) return;

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.url || !tab.url.startsWith('https://')) continue;

      let hostname;
      try {
        hostname = new URL(tab.url).hostname;
      } catch (e) {
        continue;
      }

      if (!enabled.some(site => isHostnameMatch(hostname, site.hostname))) continue;

      // 已初始化的标签页跳过：重复执行 constants.js 等文件会因顶层
      // const/let 重声明抛 SyntaxError（同一隔离环境共享全局词法作用域）
      try {
        const probe = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => !!window.__promptAssistantInitialized
        });
        if (probe?.[0]?.result) continue;
      } catch (e) {
        // 探测失败按未初始化处理，交由下方注入
      }

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: CONTENT_SCRIPT_FILES
      }).catch(() => {
        // 受保护页面（chrome:// 等）无法注入，忽略
      });
    }
  } catch (e) {
    DebugLog.error('向已打开标签页注入失败:', e);
  }
}

// 插件安装时的初始化
chrome.runtime.onInstalled.addListener(async (details) => {
  DebugLog.log('[扩展安装] 原因:', details.reason);

  if (details.reason === 'install') {
    try {
      // 检查现有数据
      const existing = await chrome.storage.local.get(['prompts', 'settings', 'aiSites']);

      // 初始化缺失的数据
      if (!existing.prompts) {
        DebugLog.log('[初始化] 设置默认提示词');
        await chrome.storage.local.set({ prompts: DEFAULT_PROMPTS });
      }
      if (!existing.settings) {
        DebugLog.log('[初始化] 设置默认设置');
        await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
      }
      if (!existing.aiSites) {
        DebugLog.log('[初始化] 设置默认AI网站');
        await chrome.storage.local.set({ aiSites: DEFAULT_AI_SITES });
      }

      await migratePromptIds();
      await syncContentScriptRegistration();
      DebugLog.log('AI Prompt Assistant 已安装并初始化');
    } catch (error) {
      DebugLog.error('初始化失败:', error);
    }
  } else if (details.reason === 'update') {
    // 更新后注册信息可能丢失（如浏览器数据迁移），重新同步
    await syncContentScriptRegistration();
  }
});

// Service Worker 冷启动时同步注册（注册默认跨会话持久，此处仅作对齐）
syncContentScriptRegistration();

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MSG.GET_PROMPTS) {
    chrome.storage.local.get(['prompts'], (result) => {
      sendResponse(result.prompts || DEFAULT_PROMPTS);
    });
    return true;
  }

  if (message.type === MSG.SAVE_PROMPT) {
    chrome.storage.local.get(['prompts'], (result) => {
      // 不回退到 DEFAULT_PROMPTS，避免已删除的默认提示词被"复活"
      const prompts = result.prompts || {};
      const { category, prompt } = message.data;

      if (!prompts[category]) {
        prompts[category] = [];
      }

      prompts[category].push({ ...prompt, id: prompt.id || generateId() });

      chrome.storage.local.set({ prompts }, async () => {
        sendResponse({ success: true });
        await broadcastToTabs(MSG.PROMPTS_DATA_UPDATED);
      });
    });
    return true;
  }

  if (message.type === MSG.DELETE_PROMPT) {
    chrome.storage.local.get(['prompts'], (result) => {
      const prompts = result.prompts || {};
      const { category, index } = message.data;

      if (prompts[category] && prompts[category][index]) {
        prompts[category].splice(index, 1);

        if (prompts[category].length === 0) {
          delete prompts[category];
        }

        chrome.storage.local.set({ prompts }, async () => {
          sendResponse({ success: true });
          await broadcastToTabs(MSG.PROMPTS_DATA_UPDATED);
        });
      } else {
        // 无论成败都回响应，避免调用方消息端口挂起
        sendResponse({ success: false });
      }
    });
    return true;
  }

  if (message.type === MSG.MOVE_PROMPT) {
    chrome.storage.local.get(['prompts'], (result) => {
      const prompts = result.prompts || {};
      const { fromCategory, fromIndex, toCategory, prompt } = message.data;

      if (prompts[fromCategory] && prompts[fromCategory][fromIndex]) {
        prompts[fromCategory].splice(fromIndex, 1);

        if (prompts[fromCategory].length === 0) {
          delete prompts[fromCategory];
        }

        if (!prompts[toCategory]) {
          prompts[toCategory] = [];
        }

        // 保留原 id（星标按 id 引用），没有才生成新 id
        prompts[toCategory].push({ ...prompt, id: prompt.id || generateId() });

        chrome.storage.local.set({ prompts }, async () => {
          sendResponse({ success: true });
          await broadcastToTabs(MSG.PROMPTS_DATA_UPDATED);
        });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }

  if (message.type === MSG.GET_SETTINGS) {
    chrome.storage.local.get(['settings'], (result) => {
      sendResponse(result.settings || DEFAULT_SETTINGS);
    });
    return true;
  }

  if (message.type === MSG.UPDATE_SETTINGS) {
    chrome.storage.local.set({ settings: message.data }, async () => {
      sendResponse({ success: true });
      await broadcastToTabs(MSG.SETTINGS_UPDATED);
    });
    return true;
  }

  if (message.type === MSG.GET_AI_SITES) {
    chrome.storage.local.get(['aiSites'], (result) => {
      sendResponse(result.aiSites || DEFAULT_AI_SITES);
    });
    return true;
  }

  if (message.type === MSG.UPDATE_AI_SITES) {
    chrome.storage.local.set({ aiSites: message.data }, async () => {
      sendResponse({ success: true });
      // 站点变化先同步注册（影响后续页面加载），再补注入已打开的标签页
      await syncContentScriptRegistration();
      await injectIntoExistingTabs();
      await broadcastToTabs(MSG.SITES_CONFIG_UPDATED, { sites: message.data });
    });
    return true;
  }

  if (message.type === MSG.GET_ENABLED_SITES) {
    chrome.storage.local.get(['aiSites'], (result) => {
      const sites = result.aiSites || DEFAULT_AI_SITES;
      const enabledSites = sites.filter(site => site.enabled).map(site => site.hostname);
      sendResponse(enabledSites);
    });
    return true;
  }

  if (message.type === MSG.IMPORT_DATA) {
    // 调用方（popup/内容脚本）已完成校验与合并，后台按分区覆盖写入
    const d = message.data || {};
    chrome.storage.local.get(['settings'], (result) => {
      const update = {};
      if (d.prompts !== undefined) update.prompts = d.prompts;
      if (d.starredPrompts !== undefined) update.starredPrompts = d.starredPrompts;
      if (d.settings !== undefined) update.settings = { ...(result.settings || DEFAULT_SETTINGS), ...d.settings };
      if (d.aiSites !== undefined) update.aiSites = d.aiSites;

      chrome.storage.local.set(update, async () => {
        sendResponse({ success: true });
        if (update.prompts !== undefined || update.starredPrompts !== undefined) {
          await broadcastToTabs(MSG.PROMPTS_DATA_UPDATED);
        }
        if (update.settings !== undefined) {
          await broadcastToTabs(MSG.SETTINGS_UPDATED);
        }
        if (update.aiSites !== undefined) {
          await syncContentScriptRegistration();
          await broadcastToTabs(MSG.SITES_CONFIG_UPDATED, { sites: update.aiSites });
        }
      });
    });
    return true;
  }

  if (message.type === MSG.GET_STARRED_PROMPTS) {
    chrome.storage.local.get(['starredPrompts'], (result) => {
      sendResponse(result.starredPrompts || []);
    });
    return true;
  }

  if (message.type === MSG.SAVE_STARRED_PROMPTS) {
    chrome.storage.local.set({ starredPrompts: message.starredPrompts }, async () => {
      sendResponse({ success: true });
      await broadcastToTabs(MSG.STARRED_DATA_UPDATED);
    });
    return true;
  }
});

/**
 * 为历史数据补充提示词 id（星标按 id 引用）
 */
async function migratePromptIds() {
  try {
    const result = await chrome.storage.local.get(['prompts', 'starredPrompts']);
    let needsUpdate = false;

    const prompts = result.prompts || {};
    for (const category of Object.keys(prompts)) {
      for (let i = 0; i < prompts[category].length; i++) {
        if (!prompts[category][i].id) {
          prompts[category][i].id = generateId();
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate) {
      await chrome.storage.local.set({ prompts });
    }

    const starred = result.starredPrompts || [];
    const needsStarMigration = starred.length > 0 && starred.some(s => !s.id && s.index !== undefined);

    if (needsStarMigration) {
      const migrated = starred.map(s => {
        if (s.id) return s;
        const prompt = prompts[s.category]?.[s.index];
        if (prompt) {
          return { id: prompt.id, category: s.category, title: s.title || prompt.title };
        }
        return null;
      }).filter(Boolean);

      await chrome.storage.local.set({ starredPrompts: migrated });
    }
  } catch (e) {
    DebugLog.error('数据迁移失败:', e);
  }
}

chrome.runtime.onStartup.addListener(() => {
  syncContentScriptRegistration();
  migratePromptIds();
});
