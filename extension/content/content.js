// content.js - Content script for text selection and rewrite panel
const API_BASE_URL = 'https://your-vercel-app.vercel.app/api'; // Change to your Vercel URL

// State
let authToken = null;
let oratePanel = null;
let currentSelection = null;
let currentEventId = null;

// Load auth token on init
async function init() {
  const result = await chrome.storage.local.get(['authToken']);
  authToken = result.authToken;

  // Listen for selection changes
  document.addEventListener('mouseup', handleSelectionChange);
  document.addEventListener('keyup', handleSelectionChange);
  
  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Handle text selection
function handleSelectionChange() {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  if (text && text.length > 0) {
    currentSelection = {
      text,
      range: selection.getRangeAt(0),
    };
  }
}

// Handle messages
function handleMessage(request, sender, sendResponse) {
  if (request.action === 'rewrite') {
    handleRewrite(request.text);
  } else if (request.action === 'updateToken') {
    authToken = request.token;
  }
  sendResponse({ success: true });
}

// Create and show Orate panel
function createPanel() {
  if (oratePanel) {
    oratePanel.remove();
  }

  const panel = document.createElement('div');
  panel.id = 'orate-panel';
  panel.innerHTML = `
    <div class="orate-header">
      <span class="orate-logo">Orate</span>
      <button class="orate-close" title="Close">×</button>
    </div>
    <div class="orate-content">
      <div class="orate-loading">
        <div class="orate-spinner"></div>
        <p>Rewriting in your voice...</p>
      </div>
      <div class="orate-result hidden">
        <div class="orate-diff"></div>
        <div class="orate-actions">
          <button class="orate-btn orate-accept">Accept</button>
          <button class="orate-btn orate-edit">Edit</button>
          <button class="orate-btn orate-reject">Reject</button>
        </div>
      </div>
      <div class="orate-error hidden">
        <p class="orate-error-message"></p>
        <button class="orate-btn orate-retry">Try Again</button>
      </div>
    </div>
  `;

  // Position near selection
  if (currentSelection && currentSelection.range) {
    const rect = currentSelection.range.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 400)}px`;
    panel.style.top = `${Math.min(rect.bottom + window.scrollY + 10, window.innerHeight - 300)}px`;
    panel.style.zIndex = '999999';
  }

  // Event listeners
  panel.querySelector('.orate-close').addEventListener('click', closePanel);
  panel.querySelector('.orate-accept').addEventListener('click', handleAccept);
  panel.querySelector('.orate-edit').addEventListener('click', handleEdit);
  panel.querySelector('.orate-reject').addEventListener('click', handleReject);
  panel.querySelector('.orate-retry').addEventListener('click', () => handleRewrite(currentSelection?.text));

  document.body.appendChild(panel);
  oratePanel = panel;

  return panel;
}

// Close panel
function closePanel() {
  if (oratePanel) {
    oratePanel.remove();
    oratePanel = null;
  }
  currentEventId = null;
}

// Handle rewrite request
async function handleRewrite(text) {
  if (!text) {
    showError('No text selected');
    return;
  }

  if (!authToken) {
    showError('Please sign in to Orate first');
    return;
  }

  createPanel();
  showLoading();

  try {
    const response = await fetch(`${API_BASE_URL}/rewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to rewrite');
    }

    const result = await response.json();
    currentEventId = result.eventId;
    showResult(result.original, result.rewritten);
  } catch (error) {
    showError(error.message);
  }
}

// Show loading state
function showLoading() {
  if (!oratePanel) return;
  
  oratePanel.querySelector('.orate-loading').classList.remove('hidden');
  oratePanel.querySelector('.orate-result').classList.add('hidden');
  oratePanel.querySelector('.orate-error').classList.add('hidden');
}

// Show result with diff
function showResult(original, rewritten) {
  if (!oratePanel) return;

  const diff = computeDiff(original, rewritten);
  oratePanel.querySelector('.orate-diff').innerHTML = diff;
  
  oratePanel.querySelector('.orate-loading').classList.add('hidden');
  oratePanel.querySelector('.orate-result').classList.remove('hidden');
  oratePanel.querySelector('.orate-error').classList.add('hidden');
}

// Show error
function showError(message) {
  if (!oratePanel) {
    createPanel();
  }

  oratePanel.querySelector('.orate-error-message').textContent = message;
  oratePanel.querySelector('.orate-loading').classList.add('hidden');
  oratePanel.querySelector('.orate-result').classList.add('hidden');
  oratePanel.querySelector('.orate-error').classList.remove('hidden');
}

// Compute simple diff
function computeDiff(original, rewritten) {
  // Simple word-level diff for display
  const originalWords = original.split(/\s+/);
  const rewrittenWords = rewritten.split(/\s+/);
  
  // For now, just show the rewritten text highlighted
  return `<div class="orate-rewritten">${escapeHtml(rewritten)}</div>`;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle accept
async function handleAccept() {
  if (currentEventId) {
    await submitFeedback('accept');
  }
  
  // Try to replace text in page
  if (currentSelection && currentSelection.range) {
    const rewritten = oratePanel.querySelector('.orate-rewritten').textContent;
    currentSelection.range.deleteContents();
    currentSelection.range.insertNode(document.createTextNode(rewritten));
  }
  
  closePanel();
}

// Handle edit
async function handleEdit() {
  const diffEl = oratePanel.querySelector('.orate-diff');
  const currentText = diffEl.textContent;
  
  // Replace with editable textarea
  diffEl.innerHTML = `<textarea class="orate-edit-textarea">${escapeHtml(currentText)}</textarea>`;
  
  // Change buttons
  const actions = oratePanel.querySelector('.orate-actions');
  actions.innerHTML = `
    <button class="orate-btn orate-save-edit">Save Changes</button>
    <button class="orate-btn orate-cancel-edit">Cancel</button>
  `;
  
  actions.querySelector('.orate-save-edit').addEventListener('click', async () => {
    const editedText = diffEl.querySelector('textarea').value;
    if (currentEventId) {
      await submitFeedback('edit', editedText);
    }
    
    // Replace text
    if (currentSelection && currentSelection.range) {
      currentSelection.range.deleteContents();
      currentSelection.range.insertNode(document.createTextNode(editedText));
    }
    
    closePanel();
  });
  
  actions.querySelector('.orate-cancel-edit').addEventListener('click', closePanel);
}

// Handle reject
async function handleReject() {
  if (currentEventId) {
    await submitFeedback('reject');
  }
  closePanel();
}

// Submit feedback
async function submitFeedback(action, editedText = null) {
  try {
    await fetch(`${API_BASE_URL}/rewrite/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        eventId: currentEventId,
        action,
        editedText,
      }),
    });
  } catch (error) {
    console.error('Failed to submit feedback:', error);
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
