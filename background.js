// 后台服务工作者
// 处理数据存储和插件生命周期管理

// 默认提示词分类
const DEFAULT_PROMPTS = {
  "角色扮演": [
    {
      title: "专业翻译",
      content: "请扮演一位专业的翻译家，将以下内容翻译成中文，保持原文的专业性和准确性："
    },
    {
      title: "代码助手",
      content: "请作为一位经验丰富的程序员，帮我分析以下代码并提供优化建议："
    }
  ],
  "写作助手": [
    {
      title: "润色文本",
      content: "请帮我润色以下文本，使其更加流畅和专业："
    },
    {
      title: "总结要点",
      content: "请总结以下内容的核心要点，使用条目式列出："
    }
  ],
  "学习辅助": [
    {
      title: "解释概念",
      content: "请用通俗易懂的语言解释以下概念："
    },
    {
      title: "制定计划",
      content: "请帮我制定一个详细的学习计划，针对以下主题："
    }
  ]
};

// 默认支持的AI网站配置
const DEFAULT_AI_SITES = [
  { name: "DeepSeek", hostname: "chat.deepseek.com", enabled: true },
  { name: "豆包", hostname: ".doubao.com", enabled: true },  // 使用 .doubao.com 匹配所有子域名
  { name: "腾讯元宝", hostname: "yuanbao.tencent.com", enabled: true },
  { name: "zAI", hostname: ".z.ai", enabled: true }  // 使用 .z.ai 匹配所有子域名
];

// 插件安装时的初始化
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // 初始化存储
    try {
      const existing = await chrome.storage.local.get(['prompts', 'settings', 'aiSites']);
      if (!existing.prompts) {
        await chrome.storage.local.set({
          prompts: DEFAULT_PROMPTS,
          settings: {
            showIcon: true,
            autoDetect: true,
            theme: 'auto'
          },
          aiSites: DEFAULT_AI_SITES
        });
      }
      // 如果没有aiSites配置，也初始化
      if (!existing.aiSites) {
        await chrome.storage.local.set({ aiSites: DEFAULT_AI_SITES });
      }
      console.log('AI Prompt Assistant 已安装并初始化');
    } catch (error) {
      console.error('初始化失败:', error);
    }
  }
});

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message);

  if (message.type === 'GET_PROMPTS') {
    // 获取所有提示词
    chrome.storage.local.get(['prompts'], (result) => {
      sendResponse(result.prompts || DEFAULT_PROMPTS);
    });
    return true; // 保持消息通道开放
  }

  if (message.type === 'SAVE_PROMPT') {
    // 保存新提示词
    chrome.storage.local.get(['prompts'], (result) => {
      const prompts = result.prompts || DEFAULT_PROMPTS;
      const { category, prompt } = message.data;

      if (!prompts[category]) {
        prompts[category] = [];
      }

      prompts[category].push(prompt);

      chrome.storage.local.set({ prompts }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === 'DELETE_PROMPT') {
    // 删除提示词
    chrome.storage.local.get(['prompts'], (result) => {
      const prompts = result.prompts || DEFAULT_PROMPTS;
      const { category, index } = message.data;

      if (prompts[category] && prompts[category][index]) {
        prompts[category].splice(index, 1);

        // 如果分类为空，删除分类
        if (prompts[category].length === 0) {
          delete prompts[category];
        }

        chrome.storage.local.set({ prompts }, () => {
          sendResponse({ success: true });
        });
      }
    });
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    // 获取设置
    chrome.storage.local.get(['settings'], (result) => {
      sendResponse(result.settings || {});
    });
    return true;
  }

  if (message.type === 'UPDATE_SETTINGS') {
    // 更新设置
    chrome.storage.local.set({ settings: message.data }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_AI_SITES') {
    // 获取AI网站配置
    chrome.storage.local.get(['aiSites'], (result) => {
      sendResponse(result.aiSites || DEFAULT_AI_SITES);
    });
    return true;
  }

  if (message.type === 'UPDATE_AI_SITES') {
    // 更新AI网站配置
    chrome.storage.local.set({ aiSites: message.data }, async () => {
      sendResponse({ success: true });

      // 通知所有AI网站标签页重新初始化
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.url && tab.url.startsWith('https://')) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'SITES_CONFIG_UPDATED',
              sites: message.data
            });
          } catch (e) {
            // 标签页可能还没有加载content script，忽略错误
          }
        }
      }
    });
    return true;
  }

  if (message.type === 'GET_ENABLED_SITES') {
    // 获取启用的网站列表（用于content script）
    chrome.storage.local.get(['aiSites'], (result) => {
      const sites = result.aiSites || DEFAULT_AI_SITES;
      const enabledSites = sites.filter(site => site.enabled).map(site => site.hostname);
      sendResponse(enabledSites);
    });
    return true;
  }

  if (message.type === 'GET_STARRED_PROMPTS') {
    // 获取星标提示词
    chrome.storage.local.get(['starredPrompts'], (result) => {
      sendResponse(result.starredPrompts || []);
    });
    return true;
  }

  if (message.type === 'SAVE_STARRED_PROMPTS') {
    // 保存星标提示词
    chrome.storage.local.set({ starredPrompts: message.starredPrompts }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// 监听标签页更新，检测AI网站
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 从存储中获取启用的网站配置
    chrome.storage.local.get(['aiSites'], (result) => {
      const sites = result.aiSites || DEFAULT_AI_SITES;
      const enabledSites = sites.filter(site => site.enabled).map(site => site.hostname);

      const isAiSite = enabledSites.some(site => tab.url.includes(site));

      if (isAiSite) {
        // 向content script发送激活信号
        chrome.tabs.sendMessage(tabId, {
          type: 'AI_SITE_DETECTED',
          url: tab.url
        }).catch(() => {
          // Content script可能还未注入
          console.log('等待content script加载...');
        });
      }
    });
  }
});