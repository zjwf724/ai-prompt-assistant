// 数据管理模块
// 负责数据加载、保存和同步

class DataManager {
  constructor() {
    this.prompts = {};
    this.settings = {};
    this.starredPrompts = [];
  }

  /**
   * 加载所有数据（并行加载）
   */
  async loadAll() {
    try {
      const [prompts, settings, starredPrompts] = await Promise.all([
        chrome.runtime.sendMessage({ type: MSG.GET_PROMPTS }),
        chrome.runtime.sendMessage({ type: MSG.GET_SETTINGS }),
        chrome.runtime.sendMessage({ type: MSG.GET_STARRED_PROMPTS })
      ]);

      this.prompts = prompts || {};
      this.settings = settings || {};
      this.starredPrompts = this.cleanStarredPrompts(starredPrompts || []);

      return { prompts: this.prompts, settings: this.settings, starredPrompts: this.starredPrompts };
    } catch (error) {
      console.error('加载数据失败:', error);
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
      chrome.runtime.sendMessage({
        type: MSG.SAVE_STARRED_PROMPTS,
        starredPrompts: validStarred
      }).catch(e => console.error('保存清理后的星标数据失败:', e));
    }

    this.starredPrompts = validStarred;
    return validStarred;
  }

  /**
   * 获取站点配置（导出备份时需要）
   */
  async getAiSites() {
    const sites = await chrome.runtime.sendMessage({ type: MSG.GET_AI_SITES });
    return sites || [];
  }

  /**
   * 构建完整备份（提示词 + 星标 + 设置 + 站点）
   */
  async exportAll() {
    return buildExport({
      prompts: this.prompts,
      settings: this.settings,
      starredPrompts: this.starredPrompts,
      aiSites: await this.getAiSites()
    });
  }

  /**
   * 导入备份：校验合并后经后台写入，返回新增统计
   * @param {Object} raw - JSON 解析后的备份对象
   * @returns {Promise<{addedPrompts: number, addedSites: number}>}
   */
  async importData(raw) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('无效的数据格式');
    }

    const merged = applyImport({
      prompts: this.prompts,
      settings: this.settings,
      starredPrompts: this.starredPrompts,
      aiSites: await this.getAiSites()
    }, raw);

    const payload = {};
    if (merged.prompts !== null) payload.prompts = merged.prompts;
    if (merged.starredPrompts !== null) payload.starredPrompts = merged.starredPrompts;
    if (merged.settings !== null) payload.settings = merged.settings;
    if (merged.aiSites !== null) payload.aiSites = merged.aiSites;

    if (Object.keys(payload).length === 0) {
      throw new Error('文件中没有可导入的数据');
    }

    await chrome.runtime.sendMessage({ type: MSG.IMPORT_DATA, data: payload });
    await this.loadAll();
    return { addedPrompts: merged.addedPrompts, addedSites: merged.addedSites };
  }

  /**
   * 保存提示词
   */
  async savePrompt(category, prompt) {
    await chrome.runtime.sendMessage({
      type: MSG.SAVE_PROMPT,
      data: { category, prompt }
    });
    await this.loadAll();
  }

  /**
   * 删除提示词
   */
  async deletePrompt(category, index) {
    await chrome.runtime.sendMessage({
      type: MSG.DELETE_PROMPT,
      data: { category, index }
    });
    await this.loadAll();
  }

  /**
   * 移动/更新提示词（同分类即原地更新，跨分类移动；保留原 id 以维持星标）
   */
  async movePrompt(fromCategory, fromIndex, toCategory, prompt) {
    await chrome.runtime.sendMessage({
      type: MSG.MOVE_PROMPT,
      data: { fromCategory, fromIndex, toCategory, prompt }
    });
    await this.loadAll();
  }

  /**
   * 更新星标
   */
  async updateStarred(starredPrompts) {
    await chrome.runtime.sendMessage({
      type: MSG.SAVE_STARRED_PROMPTS,
      starredPrompts
    });
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
