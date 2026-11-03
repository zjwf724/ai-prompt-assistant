// 网站检测模块
// 负责检测当前网站是否为支持的AI网站

class SiteDetector {
  constructor() {
    this.currentSite = this.detectSite();
  }

  /**
   * 检测当前网站名称
   */
  detectSite() {
    return detectSite(window.location.hostname);
  }

  /**
   * 检查当前网站是否在启用列表中
   */
  async isSiteEnabled() {
    const enabledSites = await chrome.runtime.sendMessage({ type: MSG.GET_ENABLED_SITES });
    const currentHostname = window.location.hostname;

    DebugLog.log('[网站检查] 当前主机名:', currentHostname);
    DebugLog.log('[网站检查] 启用的网站列表:', enabledSites);

    if (!enabledSites || enabledSites.length === 0) {
      DebugLog.log('[网站检查] 启用网站列表为空');
      return false;
    }

    const isEnabled = enabledSites.some(site => {
      const match = isHostnameMatch(currentHostname, site);
      DebugLog.log(`[网站检查] 检查 "${currentHostname}" 匹配 "${site}": ${match}`);
      return match;
    });

    DebugLog.log('[网站检查] 最终结果:', isEnabled);
    return isEnabled;
  }
}
