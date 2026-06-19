// This file is required for Playwright to reliably detect the extension ID
// and is also useful for handling extension lifecycle events (like installation)
console.log("Service worker initialized.");

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("index.html");

  // 檢查是否已經有開啟的標籤頁
  const tabs = await chrome.tabs.query({ url });

  if (tabs.length > 0 && tabs[0].id && tabs[0].windowId) {
    // 如果已經開啟，則切換到該標籤頁並聚焦該視窗
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // 否則開啟新的標籤頁
    await chrome.tabs.create({ url });
  }
});
