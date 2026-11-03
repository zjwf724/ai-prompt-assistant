// 提示词插入模块
// 负责将提示词插入到各种类型的输入框
// 关键约束：AI 站点的输入框几乎都是受控组件（React/Vue textarea、
// Lexical/ProseMirror 等 contenteditable 编辑器），直接改 DOM 不会进入
// 框架状态，失焦/重渲染时会被框架用旧状态覆盖（表现为"点击页面空白
// 后插入的内容消失"）。因此：
// - textarea/input：用原生原型 value setter 写值（绕过框架实例劫持），
//   再派发 input 事件让框架同步状态
// - contenteditable：优先 execCommand('insertText')，走浏览器编辑管线，
//   富文本编辑器能正常捕获；失败再退回手工 Range 插入

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
        } else if (inputElement.isContentEditable) {
          this.insertIntoContentEditable(inputElement, content);
        }

        DebugLog.log('提示词插入成功');
      } catch (error) {
        DebugLog.error('插入提示词时出错:', error);
        this.fallbackInsert(inputElement, content);
      }
    }, 10);
  }

  /**
   * 取原生 value setter（框架会在实例上劫持 value 属性，原型 setter 不受影响）
   */
  static getNativeValueSetter(inputElement) {
    const proto = inputElement.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    return Object.getOwnPropertyDescriptor(proto, 'value')?.set || null;
  }

  /**
   * 插入到 textarea 或 input
   */
  static insertIntoTextArea(inputElement, content) {
    const start = inputElement.selectionStart ?? inputElement.value.length;
    const end = inputElement.selectionEnd ?? start;
    const value = inputElement.value || '';

    const newValue = value.substring(0, start) + content + value.substring(end);

    const nativeSetter = this.getNativeValueSetter(inputElement);
    if (nativeSetter) {
      nativeSetter.call(inputElement, newValue);
    } else {
      inputElement.value = newValue;
    }

    const newCursorPos = start + content.length;
    inputElement.setSelectionRange(newCursorPos, newCursorPos);
    inputElement.scrollTop = inputElement.scrollHeight;

    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 插入到 contenteditable 元素
   */
  static insertIntoContentEditable(inputElement, content) {
    let inserted = false;
    try {
      inputElement.focus();
      this.ensureCaretInside(inputElement);
      inserted = document.execCommand('insertText', false, content);
    } catch (e) {
      inserted = false;
    }

    if (!inserted) {
      this.insertViaRange(inputElement, content);
    }
  }

  /**
   * 确保选区（光标）在目标输入框内，否则移到内容末尾
   */
  static ensureCaretInside(inputElement) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && inputElement.contains(selection.anchorNode)) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(inputElement);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * 手工 Range 插入（execCommand 不可用时的降级；不保证被编辑器状态接受）
   */
  static insertViaRange(inputElement, content) {
    const selection = window.getSelection();
    let range;

    if (selection.rangeCount > 0 &&
        inputElement.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      range = selection.getRangeAt(0);
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
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 降级插入方案（追加到末尾）
   */
  static fallbackInsert(inputElement, content) {
    try {
      const tagName = inputElement.tagName.toLowerCase();

      if (tagName === 'textarea' || tagName === 'input') {
        const oldValue = inputElement.value || '';
        const newValue = oldValue + content;
        const nativeSetter = this.getNativeValueSetter(inputElement);
        if (nativeSetter) {
          nativeSetter.call(inputElement, newValue);
        } else {
          inputElement.value = newValue;
        }
        const newPos = newValue.length;
        inputElement.setSelectionRange(newPos, newPos);
        inputElement.scrollTop = inputElement.scrollHeight;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (inputElement.isContentEditable) {
        inputElement.focus();
        this.ensureCaretInside(inputElement);
        if (!document.execCommand('insertText', false, content)) {
          inputElement.textContent += content;
        }
      }

      inputElement.focus();
      DebugLog.log('降级方案成功');
    } catch (fallbackError) {
      DebugLog.error('降级方案也失败:', fallbackError);
    }
  }
}
