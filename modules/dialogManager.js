// 对话框管理模块
// 负责创建和管理各种对话框（添加、编辑、删除提示词等）

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
      this.showToast('请点击浏览器工具栏的插件图标管理分类');
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
      setTimeout(() => toast.remove(), 300);
    }, DELAY.TOAST_SHOW);
  }
}
