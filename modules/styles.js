// CSS 样式模块
// 包含所有弹窗、图标、对话框等样式

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
    .confirm-btn {
      padding: 8px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .cancel-btn {
      background: #f5f5f5;
      color: #666;
    }
    .delete-confirm-btn {
      background: #d32f2f;
      color: white;
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
    .category-select:focus {
      outline: none;
      border-color: #4CAF50;
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
      transition: all 0.2s ease;
      pointer-events: auto;
      position: fixed;
      z-index: ${Z_INDEX.ICON};
      background-color: #4CAF50;
      border-radius: 50%;
      width: ${LAYOUT.ICON.SIZE}px;
      height: ${LAYOUT.ICON.SIZE}px;
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

