/**
 * Includify Background Service Worker (Manifest V3)
 */

// Default Accessibility Settings
const DEFAULT_SETTINGS = {
  fontSize: 100, // percentage
  fontFamily: 'default', // 'default' or 'opendyslexic'
  lineSpacing: 1.6,
  letterSpacing: 0, // px
  contrastMode: 'normal', // 'normal', 'dark', 'high-contrast', 'sepia', 'blue-tint'
  readingSpeed: 1.0,
  focusMode: false,
  dyslexiaMode: false,
  backendUrl: 'http://localhost:3000'
};

// Initialize settings on installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Includify Background] Extension installed/updated:', details.reason);
  
  chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (existing) => {
    const updated = { ...DEFAULT_SETTINGS, ...existing };
    chrome.storage.sync.set(updated, () => {
      console.log('[Includify Background] Accessibility settings initialized:', updated);
    });
  });
});

// Listen for keyboard command shortcuts
chrome.commands.onCommand.addListener((command) => {
  console.log('[Includify Background] Command received:', command);
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const tabId = tabs[0].id;
    
    let actionType = null;
    switch (command) {
      case 'toggle-simplify':
        actionType = 'SIMPLIFY_CONTENT';
        break;
      case 'toggle-focus':
        actionType = 'TOGGLE_FOCUS_MODE';
        break;
      case 'toggle-dyslexia':
        actionType = 'TOGGLE_DYSLEXIA_MODE';
        break;
      case 'toggle-read-aloud':
        actionType = 'TOGGLE_READ_ALOUD';
        break;
    }
    
    if (actionType) {
      chrome.tabs.sendMessage(tabId, { type: actionType, source: 'keyboard-shortcut' }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn('[Includify Background] Content script not ready on tab:', chrome.runtime.lastError.message);
        }
      });
    }
  });
});

// Listen for cross-script runtime messages and API proxies
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ status: 'PONG', version: '1.0.0' });
    return true;
  }
  
  if (request.type === 'API_CALL_SIMPLIFY') {
    fetch('http://localhost:3000/api/simplify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.payload)
    })
      .then(res => res.json())
      .then(data => sendResponse({ success: data.success !== false, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async sendResponse
  }

  if (request.type === 'API_CALL_TRANSLATE') {
    fetch('http://localhost:3000/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.payload)
    })
      .then(res => res.json())
      .then(data => sendResponse({ success: data.success !== false, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async sendResponse
  }
  
  if (request.type === 'UPDATE_BADGE') {
    const text = request.text || '';
    chrome.action.setBadgeText({ tabId: sender.tab?.id, text });
    if (request.color) {
      chrome.action.setBadgeBackgroundColor({ tabId: sender.tab?.id, color: request.color });
    }
    sendResponse({ success: true });
    return true;
  }
});
