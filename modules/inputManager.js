// 输入框管理模块
// 负责查找、监听输入框元素

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
