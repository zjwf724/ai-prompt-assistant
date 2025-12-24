// AI Prompt Assistant Popup 脚本
// 处理弹出窗口的所有交互逻辑

class PopupManager {
  constructor() {
    this.prompts = {};
    this.settings = {};
    this.aiSites = [];
    this.editingPrompt = null; // 当前正在编辑的提示词
    this.init();
  }

  // ==================== 辅助方法 ====================

  // 通知所有标签页数据已更新
  async notifyDataUpdate(messageType = 'PROMPTS_DATA_UPDATED') {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.url && tab.url.startsWith('https://')) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: messageType });
          } catch (e) {
            // 标签页可能还没有加载content script，忽略错误
          }
        }
      }
    } catch (error) {
      console.error('通知标签页失败:', error);
    }
  }

  // ==================== 初始化 ====================
  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.renderStats();
    this.renderSettings();
    this.renderSitesList();
    this.renderPromptsList();
  }

  // 加载数据
  async loadData() {
    try {
      const result = await chrome.storage.local.get(['prompts', 'settings', 'aiSites']);
      this.prompts = result.prompts || {};
      this.settings = result.settings || { showIcon: true, iconPosition: 'right', autoDetect: true };
      this.aiSites = result.aiSites || [];
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  }

  // ==================== 事件监听 ====================
  setupEventListeners() {
    // 快速操作按钮
    document.getElementById('addPromptBtn')?.addEventListener('click', () => this.showAddPromptModal());
    document.getElementById('manageCategoriesBtn')?.addEventListener('click', () => this.showCategoryModal());
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshData());

    // 设置开关
    document.getElementById('showIconToggle')?.addEventListener('change', (e) => {
      this.updateSettings({ showIcon: e.target.checked });
    });

    // 悬浮球位置
    document.querySelectorAll('input[name="iconPosition"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.updateSettings({ iconPosition: e.target.value });
      });
    });

    // 网站管理
    document.getElementById('addSiteBtn')?.addEventListener('click', () => this.showAddSiteModal());

    // 提示词列表
    document.getElementById('clearAllBtn')?.addEventListener('click', () => this.clearAllPrompts());

    // 数据管理
    document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());
    document.getElementById('importBtn')?.addEventListener('click', () => {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile')?.addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });

    // 模态框关闭按钮
    document.querySelectorAll('[data-close], .modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.target.dataset.close || e.target.closest('.modal-overlay')?.id;
        if (modalId) this.hideModal(modalId);
      });
    });

    // 点击遮罩层关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.hideModal(overlay.id);
        }
      });
    });

    // 添加提示词表单
    document.getElementById('addPromptForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePrompt();
    });

    // 分类选择变化
    document.getElementById('categorySelect')?.addEventListener('change', (e) => {
      const newCategoryInput = document.getElementById('newCategoryInput');
      if (newCategoryInput) {
        newCategoryInput.style.display = e.target.value === '' ? 'block' : 'none';
      }
    });

    // 添加网站表单
    document.getElementById('addSiteForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSite();
    });

    // 编辑提示词表单
    document.getElementById('editPromptForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.updatePrompt();
    });

    // 删除提示词按钮（编辑模态框中）
    document.getElementById('deletePromptBtn')?.addEventListener('click', () => {
      this.deleteEditingPrompt();
    });

    // 添加分类按钮
    document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
      this.addNewCategory();
    });
  }

  // ==================== 渲染方法 ====================
  renderStats() {
    const totalPrompts = Object.values(this.prompts).reduce((sum, arr) => sum + arr.length, 0);
    const totalCategories = Object.keys(this.prompts).length;
    const enabledSites = this.aiSites.filter(site => site.enabled).length;

    document.getElementById('totalPrompts').textContent = totalPrompts;
    document.getElementById('totalCategories').textContent = totalCategories;
    document.getElementById('activeSites').textContent = enabledSites;
  }

  renderSettings() {
    const showIconToggle = document.getElementById('showIconToggle');
    if (showIconToggle) {
      showIconToggle.checked = this.settings.showIcon !== false;
    }

    // 悬浮球位置
    const position = this.settings.iconPosition || 'right';
    document.querySelectorAll('input[name="iconPosition"]').forEach(radio => {
      radio.checked = radio.value === position;
    });
  }

  renderSitesList() {
    const sitesList = document.getElementById('sitesList');
    if (!sitesList) return;

    if (this.aiSites.length === 0) {
      sitesList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">暂无网站</p>';
      return;
    }

    sitesList.innerHTML = this.aiSites.map((site, index) => `
      <div class="site-item">
        <div class="site-info">
          <span class="site-name">${this.escapeHtml(site.name)}</span>
          <span class="site-hostname">${this.escapeHtml(site.hostname)}</span>
        </div>
        <div class="site-actions">
          <label class="toggle">
            <input type="checkbox" data-site-index="${index}" ${site.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <button class="site-delete-btn" data-site-index="${index}" title="删除">
            <svg viewBox="0 0 20 20" width="14" height="14">
              <path fill="currentColor" d="M5.5 5.5A.5.5 0 0 1 6 5h8a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5Zm2 3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5ZM6 9a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H6Zm1.5-2A1.5 1.5 0 0 0 6 8.5V9h8v-.5A1.5 1.5 0 0 0 12.5 7h-5Z"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    console.log('[渲染网站列表] 当前网站列表:', this.aiSites);

    // 绑定事件
    sitesList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.siteIndex);
        this.toggleSite(index, e.target.checked);
      });
    });

    sitesList.querySelectorAll('.site-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(btn.dataset.siteIndex);
        this.deleteSite(index);
      });
    });
  }

  renderPromptsList() {
    const promptsList = document.getElementById('promptsList');
    if (!promptsList) return;

    const categories = Object.keys(this.prompts);
    if (categories.length === 0) {
      promptsList.innerHTML = '<div class="prompts-list empty">暂无提示词</div>';
      return;
    }

    promptsList.innerHTML = categories.map(category => `
      <div class="prompt-category-group">
        <div class="prompt-category-header">${this.escapeHtml(category)} (${this.prompts[category].length})</div>
        ${this.prompts[category].map((prompt, index) => `
          <div class="prompt-item" data-category="${category}" data-index="${index}">
            <div class="prompt-item-main">
              <span class="prompt-title">${this.escapeHtml(prompt.title)}</span>
              <span class="prompt-preview">${this.escapeHtml(prompt.content)}</span>
            </div>
            <button class="prompt-edit-btn" data-category="${category}" data-index="${index}" title="编辑">
              <svg viewBox="0 0 20 20" width="14" height="14">
                <path fill="currentColor" d="M3 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm0 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm0 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm0 4a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1z"/>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
    `).join('');

    // 绑定编辑事件
    promptsList.querySelectorAll('.prompt-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const category = e.currentTarget.dataset.category;
        const index = parseInt(e.currentTarget.dataset.index);
        this.showEditPromptModal(category, index);
      });
    });
  }

  // ==================== 模态框管理 ====================
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
    }
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
    }
    // 清空表单
    const form = modal?.querySelector('form');
    if (form) form.reset();
  }

  // ==================== 添加提示词 ====================
  showAddPromptModal() {
    const categorySelect = document.getElementById('categorySelect');
    const newCategoryInput = document.getElementById('newCategoryInput');

    // 填充分类选项
    const defaultCategories = ['角色扮演', '写作助手', '学习辅助'];
    const customCategories = Object.keys(this.prompts).filter(cat => !defaultCategories.includes(cat));

    categorySelect.innerHTML = `
      <option value="">-- 新建分类 --</option>
      ${defaultCategories.map(cat => `<option value="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</option>`).join('')}
      ${customCategories.map(cat => `<option value="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</option>`).join('')}
    `;

    // 隐藏新建分类输入框
    if (newCategoryInput) {
      newCategoryInput.style.display = 'none';
    }

    this.showModal('addPromptModal');
  }

  async savePrompt() {
    const categorySelect = document.getElementById('categorySelect');
    const newCategoryInput = document.getElementById('newCategoryInput');
    const titleInput = document.getElementById('promptTitle');
    const contentInput = document.getElementById('promptContent');

    const category = categorySelect.value || newCategoryInput.value.trim();
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!category || !title || !content) {
      this.showToast('请填写完整信息');
      return;
    }

    const prompt = { title, content };

    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_PROMPT',
        data: { category, prompt }
      });

      await this.loadData();
      this.renderStats();
      this.renderPromptsList();
      this.hideModal('addPromptModal');
      this.showToast('提示词已保存');
    } catch (error) {
      console.error('保存提示词失败:', error);
      this.showToast('保存失败，请重试');
    }
  }

  // ==================== 编辑提示词 ====================
  showEditPromptModal(category, index) {
    const prompt = this.prompts[category][index];
    if (!prompt) return;

    this.editingPrompt = { category, index };

    // 填充分类选项
    const categorySelect = document.getElementById('editCategorySelect');
    const categories = Object.keys(this.prompts);
    categorySelect.innerHTML = categories.map(cat =>
      `<option value="${this.escapeHtml(cat)}" ${cat === category ? 'selected' : ''}>${this.escapeHtml(cat)}</option>`
    ).join('');

    // 填充表单
    document.getElementById('editPromptTitle').value = prompt.title;
    document.getElementById('editPromptContent').value = prompt.content;

    this.showModal('editPromptModal');
  }

  async updatePrompt() {
    if (!this.editingPrompt) return;

    const newCategory = document.getElementById('editCategorySelect').value;
    const newTitle = document.getElementById('editPromptTitle').value.trim();
    const newContent = document.getElementById('editPromptContent').value.trim();

    if (!newTitle || !newContent) {
      this.showToast('请填写完整信息');
      return;
    }

    try {
      // 如果分类变了，需要先删除原来的
      if (newCategory !== this.editingPrompt.category) {
        await chrome.runtime.sendMessage({
          type: 'DELETE_PROMPT',
          data: { category: this.editingPrompt.category, index: this.editingPrompt.index }
        });
      }

      // 保存新的（或更新现有的）
      const prompt = { title: newTitle, content: newContent };

      // 如果是同一分类，通过background.js更新以确保通知所有标签页
      if (newCategory === this.editingPrompt.category) {
        this.prompts[newCategory][this.editingPrompt.index] = prompt;
        await chrome.storage.local.set({ prompts: this.prompts });
        // 通知所有标签页数据已更新
        await this.notifyDataUpdate();
      } else {
        // 不同分类，先删除再添加
        await chrome.runtime.sendMessage({
          type: 'SAVE_PROMPT',
          data: { category: newCategory, prompt }
        });
      }

      await this.loadData();
      this.renderStats();
      this.renderPromptsList();
      this.hideModal('editPromptModal');
      this.editingPrompt = null;
      this.showToast('提示词已更新');
    } catch (error) {
      console.error('更新提示词失败:', error);
      this.showToast('更新失败，请重试');
    }
  }

  async deleteEditingPrompt() {
    if (!this.editingPrompt) return;

    const { category, index } = this.editingPrompt;
    const prompt = this.prompts[category][index];

    if (!confirm(`确定要删除 "${prompt.title}" 吗？`)) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_PROMPT',
        data: { category, index }
      });

      await this.loadData();
      this.renderStats();
      this.renderPromptsList();
      this.hideModal('editPromptModal');
      this.editingPrompt = null;
      this.showToast('提示词已删除');
    } catch (error) {
      console.error('删除提示词失败:', error);
      this.showToast('删除失败，请重试');
    }
  }

  // ==================== 分类管理 ====================
  showCategoryModal() {
    this.renderCategoryList();
    this.showModal('categoryModal');
  }

  renderCategoryList() {
    const categoryList = document.getElementById('categoryList');
    if (!categoryList) return;

    const categories = Object.keys(this.prompts);
    if (categories.length === 0) {
      categoryList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">暂无分类</p>';
      return;
    }

    categoryList.innerHTML = categories.map(category => `
      <div class="category-item">
        <span class="category-name">${this.escapeHtml(category)}</span>
        <div class="category-actions">
          <span class="category-count">${this.prompts[category].length}</span>
          <button class="category-action-btn" data-action="rename" data-category="${this.escapeHtml(category)}" title="重命名">
            <svg viewBox="0 0 20 20" width="14" height="14">
              <path fill="currentColor" d="M4 4a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1zm0 4a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1zm0 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1z"/>
            </svg>
          </button>
          <button class="category-action-btn delete" data-action="delete" data-category="${this.escapeHtml(category)}" title="删除">
            <svg viewBox="0 0 20 20" width="14" height="14">
              <path fill="currentColor" d="M5.5 5.5A.5.5 0 0 1 6 5h8a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5Z"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // 绑定事件
    categoryList.querySelectorAll('.category-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const category = btn.dataset.category;
        if (action === 'rename') {
          this.renameCategory(category);
        } else if (action === 'delete') {
          this.deleteCategory(category);
        }
      });
    });
  }

  async addNewCategory() {
    const input = document.getElementById('newCategoryName');
    const name = input.value.trim();

    if (!name) {
      this.showToast('请输入分类名称');
      return;
    }

    if (this.prompts[name]) {
      this.showToast('分类已存在');
      return;
    }

    // 创建空分类（添加一个示例提示词）
    const prompt = {
      title: '示例提示词',
      content: '这是一个示例提示词，您可以编辑或删除它'
    };

    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_PROMPT',
        data: { category: name, prompt }
      });

      await this.loadData();
      this.renderStats();
      this.renderPromptsList();
      this.renderCategoryList();
      input.value = '';
      this.showToast('分类已创建');
    } catch (error) {
      console.error('创建分类失败:', error);
      this.showToast('创建失败，请重试');
    }
  }

  async renameCategory(oldName) {
    const newName = prompt('请输入新的分类名称：', oldName);
    if (!newName || newName === oldName) return;

    if (this.prompts[newName]) {
      this.showToast('分类名称已存在');
      return;
    }

    // 重命名分类
    this.prompts[newName] = this.prompts[oldName];
    delete this.prompts[oldName];

    await chrome.storage.local.set({ prompts: this.prompts });
    await this.notifyDataUpdate();
    await this.loadData();
    this.renderStats();
    this.renderPromptsList();
    this.renderCategoryList();
    this.showToast('分类已重命名');
  }

  async deleteCategory(category) {
    const count = this.prompts[category]?.length || 0;
    if (!confirm(`确定要删除分类 "${category}" 吗？该分类下的 ${count} 个提示词也将被删除。`)) {
      return;
    }

    try {
      // 直接删除整个分类
      delete this.prompts[category];
      await chrome.storage.local.set({ prompts: this.prompts });
      await this.notifyDataUpdate();

      await this.loadData();
      this.renderStats();
      this.renderPromptsList();
      this.renderCategoryList();
      this.showToast('分类已删除');
    } catch (error) {
      console.error('删除分类失败:', error);
      this.showToast('删除失败，请重试');
    }
  }

  // ==================== 网站管理 ====================
  showAddSiteModal() {
    this.showModal('addSiteModal');
  }

  async saveSite() {
    const nameInput = document.getElementById('siteName');
    const hostnameInput = document.getElementById('siteHostname');

    const name = nameInput.value.trim();
    let hostname = hostnameInput.value.trim();

    if (!name || !hostname) {
      this.showToast('请填写完整信息');
      return;
    }

    // 验证域名格式
    if (hostname.includes('http://') || hostname.includes('https://') || hostname.includes('/')) {
      this.showToast('请输入纯域名，不需要http://或路径');
      return;
    }

    // 智能处理域名格式
    // 如果用户输入的不是以 . 开头的子域名格式，检查是否应该转换为子域名匹配
    if (!hostname.startsWith('.')) {
      // 对于常见AI平台，自动转换为 .domain.com 格式以支持所有子域名
      const commonPlatforms = [
        'deepseek.com', 'openai.com', 'anthropic.com', 'claude.ai',
        'google.com', 'microsoft.com', 'baidu.com', 'alibaba.com',
        'tencent.com', 'bytedance.com', 'doubao.com', 'z.ai',
        'perplexity.ai', 'poe.com', 'character.ai', 'gemini.com'
      ];

      // 提取主域名
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const mainDomain = parts.slice(-2).join('.');
        if (commonPlatforms.includes(mainDomain) || commonPlatforms.some(p => hostname.endsWith(p))) {
          // 转换为子域名格式
          hostname = '.' + mainDomain;
          console.log(`[添加网站] 自动转换为子域名格式: ${hostname}`);
        }
      }
    }

    // 检查是否已存在（转换后再次检查）
    if (this.aiSites.some(site => site.hostname === hostname)) {
      this.showToast('该网站已存在');
      return;
    }

    const newSite = { name, hostname, enabled: true };
    console.log('[添加网站] 准备保存:', newSite);

    this.aiSites.push(newSite);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_AI_SITES',
        data: this.aiSites
      });
      console.log('[添加网站] 保存响应:', response);

      // 重新加载数据以确保同步
      await this.loadData();
      this.renderSitesList();
      this.renderStats();
      this.hideModal('addSiteModal');
      this.showToast(`网站已添加 (${hostname})`);
    } catch (error) {
      console.error('添加网站失败:', error);
      this.showToast('添加失败，请重试');
    }
  }

  async toggleSite(index, enabled) {
    this.aiSites[index].enabled = enabled;

    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_AI_SITES',
        data: this.aiSites
      });

      // 重新加载数据以确保同步
      await this.loadData();
      this.renderSitesList();
      this.renderStats();
      this.showToast(`${this.aiSites[index].name} ${enabled ? '已启用' : '已禁用'}`);
    } catch (error) {
      console.error('更新网站状态失败:', error);
      this.showToast('更新失败，请重试');
    }
  }

  async deleteSite(index) {
    const site = this.aiSites[index];
    if (!confirm(`确定要删除 "${site.name}" (${site.hostname}) 吗？`)) {
      return;
    }

    this.aiSites.splice(index, 1);

    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_AI_SITES',
        data: this.aiSites
      });

      // 重新加载数据以确保同步
      await this.loadData();
      this.renderSitesList();
      this.renderStats();
      this.showToast('网站已删除');
    } catch (error) {
      console.error('删除网站失败:', error);
      this.showToast('删除失败，请重试');
    }
  }

  // ==================== 数据管理 ====================
  async clearAllPrompts() {
    const count = Object.values(this.prompts).reduce((sum, arr) => sum + arr.length, 0);
    if (count === 0) {
      this.showToast('暂无提示词可清空');
      return;
    }

    if (!confirm(`确定要清空所有 ${count} 个提示词吗？此操作不可恢复。`)) {
      return;
    }

    try {
      await chrome.storage.local.set({ prompts: {} });
      this.prompts = {};
      await this.notifyDataUpdate();
      this.renderStats();
      this.renderPromptsList();
      this.showToast('已清空所有提示词');
    } catch (error) {
      console.error('清空提示词失败:', error);
      this.showToast('清空失败，请重试');
    }
  }

  exportData() {
    const data = {
      prompts: this.prompts,
      settings: this.settings,
      aiSites: this.aiSites,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-prompts-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.showToast('数据已导出');
  }

  async importData(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // 合并提示词
        if (data.prompts && typeof data.prompts === 'object') {
          const merged = { ...this.prompts };
          for (const [category, prompts] of Object.entries(data.prompts)) {
            if (!merged[category]) {
              merged[category] = [];
            }
            merged[category] = merged[category].concat(prompts);
          }
          await chrome.storage.local.set({ prompts: merged });
          this.prompts = merged;
          // 通知所有标签页数据已更新
          await this.notifyDataUpdate();
        }

        // 更新设置（可选）
        if (data.settings && typeof data.settings === 'object') {
          const mergedSettings = { ...this.settings, ...data.settings };
          await chrome.storage.local.set({ settings: mergedSettings });
          this.settings = mergedSettings;
        }

        await this.loadData();
        this.renderStats();
        this.renderSettings();
        this.renderPromptsList();
        this.showToast('数据导入成功');
      } catch (error) {
        console.error('导入失败:', error);
        this.showToast('导入失败：' + error.message);
      }
    };

    reader.readAsText(file);
  }

  // ==================== 设置更新 ====================
  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };

    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        data: this.settings
      });
      this.showToast('设置已更新');
    } catch (error) {
      console.error('更新设置失败:', error);
      this.showToast('更新失败，请重试');
    }
  }

  // ==================== 刷新数据 ====================
  async refreshData() {
    await this.loadData();
    this.renderStats();
    this.renderSettings();
    this.renderSitesList();
    this.renderPromptsList();
    this.showToast('数据已刷新');
  }

  // ==================== 工具方法 ====================
  showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
