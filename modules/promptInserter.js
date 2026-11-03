// 提示词插入模块
// 负责将提示词插入到各种类型的输入框

class PromptInserter {
  /**
   * 插入提示词到输入框
   */
  static insert(inputElement, content) {
    inputElement.focus();

    setTimeout(() => {
      try {
        const tagName = inputElement.tagName.toLowerCase();

        if (tagName === 'textarea' || tagName === 'input') {
          this.insertIntoTextArea(inputElement, content);
        } else if (inputElement.getAttribute('contenteditable') === 'true') {
          this.insertIntoContentEditable(inputElement, content);
        }

        DebugLog.log('提示词插入成功');
      } catch (error) {
        console.error('插入提示词时出错:', error);
        this.fallbackInsert(inputElement, content);
      }
    }, 10);
  }

  /**
   * 插入到 textarea 或 input
   */
  static insertIntoTextArea(inputElement, content) {
    const start = inputElement.selectionStart || 0;
    const end = inputElement.selectionEnd || 0;
    const value = inputElement.value || '';

    const newValue = value.substring(0, start) + content + value.substring(end);
    inputElement.value = newValue;

    const newCursorPos = start + content.length;
    inputElement.setSelectionRange(newCursorPos, newCursorPos);
    inputElement.scrollTop = inputElement.scrollHeight;

    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  }

  /**
   * 插入到 contenteditable 元素
   */
  static insertIntoContentEditable(inputElement, content) {
    let selection = window.getSelection();
    let range;

    if (selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
      if (!inputElement.contains(range.commonAncestorContainer)) {
        range = document.createRange();
        range.selectNodeContents(inputElement);
        range.collapse(false);
      }
    } else {
      range = document.createRange();
      range.selectNodeContents(inputElement);
      range.collapse(false);
    }

    range.deleteContents();

    const textNode = document.createTextNode(content);
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    inputElement.focus();

    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    // 简化的光标监控（仅2次检查）
    DELAY.CURSOR_CHECK.forEach(delay => {
      setTimeout(() => {
        try {
          const sel = window.getSelection();
          const r = document.createRange();
          r.setStartAfter(textNode);
          r.setEndAfter(textNode);
          sel.removeAllRanges();
          sel.addRange(r);
          inputElement.focus();
        } catch (e) {}
      }, delay);
    });
  }

  /**
   * 降级插入方案
   */
  static fallbackInsert(inputElement, content) {
    try {
      const tagName = inputElement.tagName.toLowerCase();

      if (tagName === 'textarea' || tagName === 'input') {
        const oldValue = inputElement.value || '';
        inputElement.value = oldValue + content;
        const newPos = oldValue.length + content.length;
        inputElement.setSelectionRange(newPos, newPos);
        inputElement.scrollTop = inputElement.scrollHeight;
      } else if (inputElement.getAttribute('contenteditable') === 'true') {
        inputElement.textContent += content;
      }

      inputElement.focus();
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      DebugLog.log('降级方案成功');
    } catch (fallbackError) {
      console.error('降级方案也失败:', fallbackError);
    }
  }
}
