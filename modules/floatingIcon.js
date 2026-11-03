// 悬浮图标模块
// 负责创建和管理悬浮球

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
