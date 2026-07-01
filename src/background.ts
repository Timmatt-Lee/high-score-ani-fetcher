// This file is required for Playwright to reliably detect the extension ID
// and is also useful for handling extension lifecycle events (like installation)
console.log("Service worker initialized.");

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("index.html");

  // Check if the extension tab is already open
  const tabs = await chrome.tabs.query({ url });

  if (tabs.length > 0 && tabs[0].id && tabs[0].windowId) {
    // Switch to the tab and focus the window if already open
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // Otherwise, open a new tab
    await chrome.tabs.create({ url });
  }
});
