// 弹窗管理模块
// 负责显示和管理提示词选择弹窗

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
      `<button class="filter-tag" data-filter="${cat}">${escapeHtml(cat)}</button>`
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
            <button class="mode-toggle-btn" id="export-btn" title="导出备份（保存为 JSON 文件）">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <g transform="translate(0,16) scale(1,-1)">
                  <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 10.586V3a1 1 0 011-1z" clip-rule="evenodd"/>
                </g>
                <path fill-rule="evenodd" d="M3 16a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
              </svg>
            </button>
            <button class="mode-toggle-btn import-btn" id="import-btn" title="导入备份（从 JSON 文件恢复）">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 10.586V3a1 1 0 011-1zM3 16a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
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

    // 导出备份（提示词 + 星标 + 设置 + 站点）
    shadowRoot.getElementById('export-btn').addEventListener('click', async () => {
      try {
        const data = await this.dataManager.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-prompts-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.dialogManager.showToast('备份已导出');
      } catch (e) {
        this.dialogManager.showToast('导出失败，请重试');
      }
    });

    // 导入备份
    shadowRoot.getElementById('import-btn').addEventListener('click', () => {
      let input = shadowRoot.getElementById('import-file-input');
      if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'import-file-input';
        input.accept = '.json';
        input.style.display = 'none';
        shadowRoot.appendChild(input);
      }
      input.value = '';
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          const result = await this.dataManager.importData(JSON.parse(await file.text()));
          const extra = result.addedSites > 0 ? `、${result.addedSites} 个站点` : '';
          this.dialogManager.showToast(`导入成功：新增 ${result.addedPrompts} 条提示词${extra}`);
          await this.refresh();
        } catch (e) {
          this.dialogManager.showToast('导入失败：' + (e && e.message ? e.message : '文件格式错误'));
        }
      };
      input.click();
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
