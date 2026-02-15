// background.js - Service Worker for extension
const API_BASE_URL = 'https://your-vercel-app.vercel.app/api'; // Change to your Vercel URL

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === '_execute_action') {
    // The action will open the popup
    // The content script will handle text selection
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      // Send message to content script to trigger rewrite
      chrome.tabs.sendMessage(tab.id, { action: 'triggerRewrite' });
    }
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getToken') {
    chrome.storage.local.get(['authToken']).then(result => {
      sendResponse({ token: result.authToken });
    });
    return true; // Keep channel open for async
  }
  
  if (request.action === 'setToken') {
    chrome.storage.local.set({ authToken: request.token }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'clearToken') {
    chrome.storage.local.remove(['authToken']).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle extension icon click with text selection
chrome.action.onClicked.addListener(async (tab) => {
  // Check if we have a selection
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => window.getSelection().toString().trim(),
    });
    
    const selectedText = results[0]?.result;
    
    if (selectedText) {
      // Send to content script to show panel
      chrome.tabs.sendMessage(tab.id, { 
        action: 'rewrite', 
        text: selectedText 
      });
    } else {
      // Open popup normally
      chrome.action.openPopup();
    }
  } catch (error) {
    console.error('Error checking selection:', error);
  }
});

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Orate extension installed');
    // Open onboarding page
    chrome.tabs.create({
      url: `${API_BASE_URL.replace('/api', '')}/welcome`,
    });
  }
});
